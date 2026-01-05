/*
Script: Stored Procedure para Monitoreo de Servicios Inactivos
Base de datos: DowndetectorDB (o monitoreos)
Descripcion: Detecta servicios que no han insertado datos en los ultimos 20 minutos
            y envia alerta por Telegram

Ejecucion sugerida: Programar en SQL Agent cada 15 minutos
Ejemplo: EXEC dbo.MonitorServiciosInactivos @TituloGrupoTelegram = 'Pruebas Angel telegram src'
*/

USE [DowndetectorDB] -- Cambiar por [monitoreos] si ese es el nombre de la BD
GO

IF OBJECT_ID('dbo.MonitorServiciosInactivos', 'P') IS NOT NULL
    DROP PROCEDURE dbo.MonitorServiciosInactivos
GO

CREATE PROCEDURE dbo.MonitorServiciosInactivos
    @TituloGrupoTelegram VARCHAR(1000) = 'Pruebas Angel telegram src',
    @MinutosSinDatos INT = 20,
    @MinutosEntreAlertas INT = 30,  -- Evita enviar alertas duplicadas muy seguidas
    @DiasRetencion INT = 4  -- Dias de retencion de datos historicos
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Ahora DATETIME2 = GETDATE();
    DECLARE @UmbralTiempo DATETIME2 = DATEADD(MINUTE, -@MinutosSinDatos, @Ahora);
    DECLARE @FechaDepuracion DATETIME2 = DATEADD(DAY, -@DiasRetencion, @Ahora);
    DECLARE @TituloMensaje VARCHAR(50);
    DECLARE @Mensaje VARCHAR(MAX);
    DECLARE @CantidadServiciosInactivos INT = 0;
    DECLARE @ListaServiciosInactivos VARCHAR(MAX) = '';
    DECLARE @RegistrosDepurados INT = 0;

    -- Tabla temporal para almacenar servicios inactivos
    DECLARE @ServiciosInactivos TABLE (
        ServiceID INT,
        ServiceName NVARCHAR(100),
        Domain NVARCHAR(10),
        UltimaFecha DATETIME2,
        MinutosSinDatos INT
    );

    -- Buscar servicios habilitados que no tienen datos recientes
    INSERT INTO @ServiciosInactivos (ServiceID, ServiceName, Domain, UltimaFecha, MinutosSinDatos)
    SELECT
        s.ServiceID,
        s.ServiceName,
        s.Domain,
        ISNULL(MAX(r.Date), '1900-01-01') AS UltimaFecha,
        DATEDIFF(MINUTE, ISNULL(MAX(r.Date), '1900-01-01'), @Ahora) AS MinutosSinDatos
    FROM
        Downdetector_Services s
        LEFT JOIN Downdetector_Reports r ON s.ServiceID = r.ServiceID
    WHERE
        s.IsActive = 1  -- Solo servicios habilitados
    GROUP BY
        s.ServiceID,
        s.ServiceName,
        s.Domain
    HAVING
        -- No tienen datos O los datos son muy antiguos
        ISNULL(MAX(r.Date), '1900-01-01') < @UmbralTiempo;

    -- Contar servicios inactivos
    SELECT @CantidadServiciosInactivos = COUNT(*) FROM @ServiciosInactivos;

    -- Si hay servicios inactivos, preparar y enviar alerta
    IF @CantidadServiciosInactivos > 0
    BEGIN
        -- Construir titulo
        IF @CantidadServiciosInactivos = 1
            SET @TituloMensaje = 'DownDetector - Servicio Inactivo';
        ELSE
            SET @TituloMensaje = 'DownDetector - ' + CAST(@CantidadServiciosInactivos AS VARCHAR(10)) + ' Servicios Inactivos';

        -- Construir mensaje detallado
        SET @Mensaje = 'ALERTA: Servicios sin datos recientes' + CHAR(13) + CHAR(10) + CHAR(13) + CHAR(10);
        SET @Mensaje = @Mensaje + 'Umbral configurado: ' + CAST(@MinutosSinDatos AS VARCHAR(10)) + ' minutos' + CHAR(13) + CHAR(10);
        SET @Mensaje = @Mensaje + 'Fecha de revision: ' + CONVERT(VARCHAR(23), @Ahora, 121) + CHAR(13) + CHAR(10) + CHAR(13) + CHAR(10);
        SET @Mensaje = @Mensaje + 'Servicios afectados:' + CHAR(13) + CHAR(10);
        SET @Mensaje = @Mensaje + '===================' + CHAR(13) + CHAR(10);

        -- Agregar cada servicio inactivo al mensaje
        SELECT @Mensaje = @Mensaje +
            '- ' + ServiceName + ' (' + Domain + ')' + CHAR(13) + CHAR(10) +
            '  Ultimo reporte: ' +
            CASE
                WHEN YEAR(UltimaFecha) = 1900 THEN 'Nunca'
                ELSE CONVERT(VARCHAR(23), UltimaFecha, 121)
            END + CHAR(13) + CHAR(10) +
            '  Tiempo sin datos: ' + CAST(MinutosSinDatos AS VARCHAR(10)) + ' minutos' + CHAR(13) + CHAR(10) + CHAR(13) + CHAR(10)
        FROM @ServiciosInactivos
        ORDER BY MinutosSinDatos DESC;

        -- Agregar informacion adicional
        SET @Mensaje = @Mensaje + 'Accion requerida:' + CHAR(13) + CHAR(10);
        SET @Mensaje = @Mensaje + '- Verificar que la aplicacion DownDetector API este en ejecucion' + CHAR(13) + CHAR(10);
        SET @Mensaje = @Mensaje + '- Revisar logs de la aplicacion para errores' + CHAR(13) + CHAR(10);
        SET @Mensaje = @Mensaje + '- Verificar conectividad a DownDetector.com' + CHAR(13) + CHAR(10);
        SET @Mensaje = @Mensaje + '- Revisar configuracion de servicios habilitados en services.config.json' + CHAR(13) + CHAR(10);

        -- Verificar si ya se envio una alerta reciente para evitar spam
        -- Esto requiere una tabla de control de alertas (opcional)
        -- Para simplificar, siempre enviamos la alerta

        BEGIN TRY
            -- Enviar alerta por Telegram
            EXEC dbmensajes.dbo.EnviaAlertasTelegram
                @TituloMensaje = @TituloMensaje,
                @Mensaje = @Mensaje,
                @TituloGrupoTelegram = @TituloGrupoTelegram;

            -- Log del envio (opcional - requiere tabla de log)
            PRINT 'Alerta enviada: ' + CAST(@CantidadServiciosInactivos AS VARCHAR(10)) + ' servicio(s) inactivo(s)';

        END TRY
        BEGIN CATCH
            -- Log de error
            PRINT 'Error al enviar alerta de Telegram: ' + ERROR_MESSAGE();

            -- Re-lanzar error si es critico
            -- THROW;
        END CATCH
    END
    ELSE
    BEGIN
        -- Todos los servicios tienen datos recientes
        PRINT 'Todos los servicios activos tienen datos recientes (ultimos ' +
              CAST(@MinutosSinDatos AS VARCHAR(10)) + ' minutos)';
    END

    -- ============================================
    -- DEPURACION DE REGISTROS ANTIGUOS
    -- ============================================
    BEGIN TRY
        PRINT 'Iniciando depuracion de registros antiguos...';
        PRINT 'Fecha limite: ' + CONVERT(VARCHAR(23), @FechaDepuracion, 121);

        -- Eliminar registros mas antiguos que @DiasRetencion dias
        DELETE FROM Downdetector_Reports
        WHERE Date < @FechaDepuracion;

        SET @RegistrosDepurados = @@ROWCOUNT;

        PRINT 'Registros depurados: ' + CAST(@RegistrosDepurados AS VARCHAR(10));

    END TRY
    BEGIN CATCH
        -- Log de error en depuracion
        PRINT 'Error durante depuracion de registros: ' + ERROR_MESSAGE();
        SET @RegistrosDepurados = -1;  -- Indicador de error
    END CATCH

    -- Retornar resumen
    SELECT
        @CantidadServiciosInactivos AS ServiciosInactivos,
        @MinutosSinDatos AS UmbralMinutos,
        @Ahora AS FechaRevision,
        @RegistrosDepurados AS RegistrosDepurados,
        @DiasRetencion AS DiasRetencion,
        @FechaDepuracion AS FechaLimiteDepuracion,
        CASE
            WHEN @CantidadServiciosInactivos > 0 THEN 'Alerta enviada'
            ELSE 'OK - Todos los servicios activos'
        END AS Estado;

    -- Retornar detalle de servicios inactivos
    SELECT
        ServiceName,
        Domain,
        UltimaFecha,
        MinutosSinDatos,
        CASE
            WHEN MinutosSinDatos >= 60 THEN CAST(MinutosSinDatos / 60 AS VARCHAR(10)) + ' horas'
            ELSE CAST(MinutosSinDatos AS VARCHAR(10)) + ' minutos'
        END AS TiempoSinDatos
    FROM
        @ServiciosInactivos
    ORDER BY
        MinutosSinDatos DESC;

END
GO

-- Prueba del stored procedure
PRINT '========================================';
PRINT 'Stored procedure creado exitosamente';
PRINT '========================================';
PRINT '';
PRINT 'Para ejecutar manualmente:';
PRINT 'EXEC dbo.MonitorServiciosInactivos @TituloGrupoTelegram = ''Pruebas Angel telegram src''';
PRINT '';
PRINT 'Para cambiar el umbral de tiempo:';
PRINT 'EXEC dbo.MonitorServiciosInactivos @TituloGrupoTelegram = ''Pruebas Angel telegram src'', @MinutosSinDatos = 30';
PRINT '';
PRINT 'Para programar en SQL Agent, crear un job que ejecute este SP cada 15 minutos';
GO
