-- =============================================
-- QUERIES PARA PRTG - DOWNDETECTOR API
-- =============================================
-- PRTG SQL Sensor v2 ejecuta queries SQL y grafica los resultados
-- Las columnas devueltas se convierten en canales de monitoreo
-- =============================================

-- =============================================
-- QUERY 1: ESTADO ACTUAL DE UN SERVICIO ESPECÍFICO
-- =============================================
-- Uso: Crear un sensor PRTG por cada servicio crítico
-- Reemplazar 'telegram' con el nombre del servicio deseado
-- Devuelve el último reporte con todos los valores relevantes
-- Solo alerta cuando StatusCode >= 3 (CRITICO o EMERGENCIA)
-- Valida que los datos no tengan más de 20 minutos de antigüedad

SELECT TOP 1
    r.ReportValue as 'Reportes',
    r.BaseLineValue as 'LineaBase',
    r.StatusCode as 'CodigoEstado',
    CASE
        WHEN r.BaseLineValue > 0
        THEN CAST(r.ReportValue AS FLOAT) / r.BaseLineValue
        ELSE 0
    END as 'Multiplicador',
    -- Valor para límites de alerta en PRTG (solo CRITICO o EMERGENCIA)
    CASE
        WHEN r.StatusCode >= 3 THEN 1  -- CRITICO (3) o EMERGENCIA (4) = 1
        ELSE 0                          -- NORMAL/ATENCION/ALERTA = 0
    END as 'EnAlerta',
    -- Minutos desde el último reporte (para validar frescura de datos)
    DATEDIFF(MINUTE, r.Date, GETDATE()) as 'MinutosDesdeReporte',
    -- Indicador de datos obsoletos (>20 minutos)
    CASE
        WHEN DATEDIFF(MINUTE, r.Date, GETDATE()) > 20 THEN 1
        ELSE 0
    END as 'DatosObsoletos'
FROM monitoreos.dbo.Downdetector_Reports r
INNER JOIN monitoreos.dbo.Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE s.ServiceName = 'telegram'  -- CAMBIAR POR EL SERVICIO DESEADO
    AND r.Date >= DATEADD(MINUTE, -20, GETDATE())  -- Solo datos de últimos 20 minutos
ORDER BY r.Date DESC;

-- CONFIGURACIÓN EN PRTG:
-- - Canal "Reportes": Valor actual de reportes de usuarios
-- - Canal "LineaBase": Valor de referencia normal
-- - Canal "CodigoEstado": 0=Normal, 1=Atención, 2=Alerta, 3=Crítico, 4=Emergencia
-- - Canal "Multiplicador": Ratio Reportes/LineaBase
-- - Canal "EnAlerta": 1 si está en CRÍTICO o EMERGENCIA (usar para triggers)
-- - Canal "MinutosDesdeReporte": Antigüedad del dato (alerta si >20)
-- - Canal "DatosObsoletos": 1 si el dato tiene más de 20 minutos

GO

-- =============================================
-- QUERY 2: MÚLTIPLES SERVICIOS - RESUMEN DE ESTADO
-- =============================================
-- Uso: Sensor único que monitorea todos los servicios activos
-- Devuelve contadores agregados por nivel de estado
-- Solo cuenta problemas graves (StatusCode >= 3)
-- Valida que los datos no tengan más de 20 minutos

SELECT
    -- Contadores por nivel de estado
    SUM(CASE WHEN r.StatusCode = 0 THEN 1 ELSE 0 END) as 'ServiciosNormales',
    SUM(CASE WHEN r.StatusCode = 1 THEN 1 ELSE 0 END) as 'ServiciosAtencion',
    SUM(CASE WHEN r.StatusCode = 2 THEN 1 ELSE 0 END) as 'ServiciosAlerta',
    SUM(CASE WHEN r.StatusCode = 3 THEN 1 ELSE 0 END) as 'ServiciosCriticos',
    SUM(CASE WHEN r.StatusCode = 4 THEN 1 ELSE 0 END) as 'ServiciosEmergencia',
    -- Total de servicios monitoreados
    COUNT(DISTINCT s.ServiceID) as 'TotalServicios',
    -- Servicios con problemas GRAVES (StatusCode >= 3: CRITICO o EMERGENCIA)
    SUM(CASE WHEN r.StatusCode >= 3 THEN 1 ELSE 0 END) as 'ServiciosConProblemas'
FROM monitoreos.dbo.Downdetector_Services s
INNER JOIN (
    -- Obtener el último reporte de cada servicio (últimos 20 minutos)
    SELECT
        ServiceID,
        StatusCode,
        ROW_NUMBER() OVER (PARTITION BY ServiceID ORDER BY Date DESC) as rn
    FROM monitoreos.dbo.Downdetector_Reports
    WHERE Date >= DATEADD(MINUTE, -20, GETDATE())  -- Solo últimos 20 minutos
) r ON s.ServiceID = r.ServiceID AND r.rn = 1
WHERE s.IsActive = 1;

-- CONFIGURACIÓN EN PRTG:
-- - Usar "ServiciosConProblemas" como canal principal para alertas
-- - Configurar límite de warning en 1 (al menos un servicio crítico)
-- - Configurar límite de error en 3 (múltiples servicios críticos)
-- - Solo cuenta servicios con StatusCode >= 3 (CRITICO o EMERGENCIA)

GO

-- =============================================
-- QUERY 3: SERVICIOS ESPECÍFICOS - UNA FILA POR SERVICIO
-- =============================================
-- Uso: Ver estado de múltiples servicios específicos en una vista
-- Devuelve el último estado de cada servicio configurado

WITH UltimosReportes AS (
    SELECT
        s.ServiceName,
        r.ReportValue,
        r.BaseLineValue,
        r.StatusCode,
        r.Status,
        r.Date,
        ROW_NUMBER() OVER (PARTITION BY s.ServiceID ORDER BY r.Date DESC) as rn
    FROM monitoreos.dbo.Downdetector_Services s
    INNER JOIN monitoreos.dbo.Downdetector_Reports r ON s.ServiceID = r.ServiceID
    WHERE s.IsActive = 1
        AND r.Date >= DATEADD(HOUR, -1, GETDATE())  -- Última hora
        AND s.ServiceName IN ('telegram', 'whatsapp', 'instagram', 'facebook')  -- SERVICIOS A MONITOREAR
)
SELECT
    ServiceName as 'Servicio',
    ReportValue as 'Reportes',
    BaseLineValue as 'LineaBase',
    StatusCode as 'Codigo',
    Status as 'Estado',
    DATEDIFF(MINUTE, Date, GETDATE()) as 'MinutosDesdeUltimoReporte'
FROM UltimosReportes
WHERE rn = 1
ORDER BY StatusCode DESC, ReportValue DESC;

-- NOTA: Esta query es mejor para visualización, no para alertas automáticas
-- Para monitoreo en PRTG, usar Query 1 o Query 2

GO

-- =============================================
-- QUERY 4: MÉTRICA ÚNICA - SERVICIOS EN ESTADO CRÍTICO
-- =============================================
-- Uso: Sensor simple que devuelve un solo valor numérico
-- Ideal para dashboards y alertas simples
-- Solo cuenta servicios en estado CRÍTICO o EMERGENCIA (StatusCode >= 3)
-- Valida que los datos no tengan más de 20 minutos

SELECT
    COUNT(DISTINCT s.ServiceID) as 'Value'
FROM monitoreos.dbo.Downdetector_Services s
INNER JOIN (
    SELECT
        ServiceID,
        StatusCode,
        ROW_NUMBER() OVER (PARTITION BY ServiceID ORDER BY Date DESC) as rn
    FROM monitoreos.dbo.Downdetector_Reports
    WHERE Date >= DATEADD(MINUTE, -20, GETDATE())  -- Solo últimos 20 minutos
) r ON s.ServiceID = r.ServiceID AND r.rn = 1
WHERE s.IsActive = 1
    AND r.StatusCode >= 3;  -- CRITICO (3), EMERGENCIA (4)

-- CONFIGURACIÓN EN PRTG:
-- - Columna "Value" es requerida por PRTG SQL Sensor
-- - Configurar límite: Warning si Value > 0
-- - Configurar límite: Error si Value > 2
-- - Solo cuenta servicios con StatusCode >= 3 (CRITICO o EMERGENCIA)

GO

-- =============================================
-- QUERY 5: DETALLE DE SERVICIO CON TENDENCIA
-- =============================================
-- Uso: Monitoreo detallado de un servicio con análisis de tendencia
-- Compara el valor actual con el promedio de la última hora

DECLARE @ServiceName NVARCHAR(100) = 'telegram';  -- CAMBIAR SERVICIO

WITH UltimoReporte AS (
    SELECT TOP 1
        r.ReportValue,
        r.BaseLineValue,
        r.StatusCode,
        r.Date
    FROM monitoreos.dbo.Downdetector_Reports r
    INNER JOIN monitoreos.dbo.Downdetector_Services s ON r.ServiceID = s.ServiceID
    WHERE s.ServiceName = @ServiceName
    ORDER BY r.Date DESC
),
PromedioHora AS (
    SELECT
        AVG(CAST(r.ReportValue AS FLOAT)) as PromedioReportes
    FROM monitoreos.dbo.Downdetector_Reports r
    INNER JOIN monitoreos.dbo.Downdetector_Services s ON r.ServiceID = s.ServiceID
    WHERE s.ServiceName = @ServiceName
        AND r.Date >= DATEADD(HOUR, -1, GETDATE())
)
SELECT
    u.ReportValue as 'ValorActual',
    u.BaseLineValue as 'LineaBase',
    u.StatusCode as 'CodigoEstado',
    CAST(p.PromedioReportes AS INT) as 'PromedioUltimaHora',
    CASE
        WHEN p.PromedioReportes > 0
        THEN CAST((u.ReportValue - p.PromedioReportes) / p.PromedioReportes * 100 AS INT)
        ELSE 0
    END as 'VariacionPorcentaje',
    DATEDIFF(MINUTE, u.Date, GETDATE()) as 'MinutosDesdeUltimoReporte'
FROM UltimoReporte u
CROSS JOIN PromedioHora p;

-- CONFIGURACIÓN EN PRTG:
-- - "VariacionPorcentaje": Muestra si hay tendencia al alza (>0) o baja (<0)
-- - "MinutosDesdeUltimoReporte": Alerta si no hay datos recientes (>20 minutos)

GO

-- =============================================
-- QUERY 6: SERVICIOS SIN DATOS RECIENTES
-- =============================================
-- Uso: Detectar servicios activos que no están reportando datos
-- Útil para identificar problemas en la recolección

SELECT
    COUNT(*) as 'ServiciosSinDatos'
FROM monitoreos.dbo.Downdetector_Services s
LEFT JOIN (
    SELECT
        ServiceID,
        MAX(Date) as UltimaFecha
    FROM monitoreos.dbo.Downdetector_Reports
    GROUP BY ServiceID
) r ON s.ServiceID = r.ServiceID
WHERE s.IsActive = 1
    AND (r.UltimaFecha IS NULL OR DATEDIFF(MINUTE, r.UltimaFecha, GETDATE()) > 20);

-- CONFIGURACIÓN EN PRTG:
-- - Alerta si el valor es > 0 (hay servicios sin datos)
-- - Indica problemas en el proceso de recolección

GO

-- =============================================
-- QUERY 7: MÁXIMO NIVEL DE ALERTA EN ÚLTIMOS N MINUTOS
-- =============================================
-- Uso: Monitorear el peor estado detectado en una ventana de tiempo
-- Útil para no perder alertas entre ejecuciones de PRTG
-- Solo cuenta problemas graves (StatusCode >= 3)
-- Ventana de tiempo ajustada a 20 minutos (máxima antigüedad permitida)

DECLARE @VentanaMinutos INT = 20;  -- 20 minutos (máxima antigüedad de datos)

SELECT
    MAX(r.StatusCode) as 'MaximoCodigoEstado',
    COUNT(DISTINCT CASE WHEN r.StatusCode >= 3 THEN s.ServiceID END) as 'ServiciosEnAlerta',
    MAX(r.ReportValue) as 'MaximoReportes',
    COUNT(DISTINCT s.ServiceID) as 'TotalServiciosActivos'
FROM monitoreos.dbo.Downdetector_Services s
INNER JOIN monitoreos.dbo.Downdetector_Reports r ON s.ServiceID = r.ServiceID
WHERE s.IsActive = 1
    AND r.Date >= DATEADD(MINUTE, -@VentanaMinutos, GETDATE());

-- CONFIGURACIÓN EN PRTG:
-- - "MaximoCodigoEstado": 0-4, alerta si >= 3 (CRITICO o EMERGENCIA)
-- - "ServiciosEnAlerta": Cantidad de servicios con problemas graves
-- - Ventana de 20 minutos para capturar todos los datos válidos del proceso

GO

-- =============================================
-- QUERY 8: VERSION SIMPLIFICADA - UN SOLO SERVICIO
-- =============================================
-- Uso: Query más simple para monitorear un servicio específico en PRTG
-- Devuelve NULL si no hay datos recientes (últimos 20 minutos)
-- Solo alerta cuando StatusCode >= 3 (CRITICO o EMERGENCIA)

SELECT TOP 1
    r.ReportValue as 'Reportes',
    r.BaseLineValue as 'LineaBase',
    r.StatusCode as 'CodigoEstado',
    CASE
        WHEN r.BaseLineValue > 0
        THEN CAST(r.ReportValue AS FLOAT) / r.BaseLineValue
        ELSE 0
    END as 'Multiplicador',
    CASE
        WHEN r.StatusCode >= 3 THEN 1  -- CRITICO o EMERGENCIA = 1
        ELSE 0                          -- Otros estados = 0
    END as 'EnAlerta'
FROM monitoreos.dbo.Downdetector_Reports r
INNER JOIN monitoreos.dbo.Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE s.ServiceName = 'telegram'  -- CAMBIAR SERVICIO AQUÍ
    AND r.Date >= DATEADD(MINUTE, -20, GETDATE())  -- Solo últimos 20 minutos
ORDER BY r.Date DESC;

-- CONFIGURACIÓN EN PRTG:
-- 1. Canal "EnAlerta" -> Configurar límite: Error si = 1
-- 2. Canal "CodigoEstado" -> Configurar límite: Error si >= 3
-- 3. Si no devuelve datos, PRTG marcará el sensor como "No Data" (revisar proceso)
-- 4. IMPORTANTE: Cambiar 'telegram' por el servicio que necesites monitorear

GO

-- =============================================
-- NOTAS DE CONFIGURACIÓN PARA PRTG
-- =============================================

/*
CONFIGURACIÓN DE SENSOR SQL EN PRTG:

1. Agregar Sensor > SQL v2
2. Configurar conexión a base de datos:
   - Servidor: 10.118.26.88
   - Base de datos: Monitoreos
   - Usuario: usrmon
   - Puerto: 1433

3. Pegar una de las queries anteriores en "SQL Query"

4. Configurar Límites de Alerta:
   - Warning: Según métrica (ej: CodigoEstado >= 2)
   - Error: Según métrica (ej: CodigoEstado >= 3)

5. Intervalo de Escaneo Recomendado:
   - Para servicios críticos: 60 segundos
   - Para resumen general: 5 minutos
   - Para tendencias: 15 minutos

6. Canales Recomendados por Query:
   - Query 1: Usar "EnAlerta" como canal principal (con validación de frescura)
   - Query 2: Usar "ServiciosConProblemas" como canal principal
   - Query 4: Usar "Value" como canal único
   - Query 7: Usar "MaximoCodigoEstado" como canal principal
   - Query 8: Usar "EnAlerta" como canal único (versión más simple)

MEJORES PRÁCTICAS:

- Crear un sensor por servicio crítico usando Query 8 (más simple) o Query 1 (más detallada)
- Crear un sensor de resumen usando Query 2 o Query 4
- Crear un sensor de salud del sistema usando Query 6
- Intervalo recomendado en PRTG: 5 minutos (el proceso actualiza cada 10 min)
- IMPORTANTE: Las queries solo alertan cuando StatusCode >= 3 (CRÍTICO o EMERGENCIA)
- IMPORTANTE: Las queries validan que los datos no tengan más de 20 minutos
- Configurar notificaciones en PRTG basadas en los límites

TROUBLESHOOTING:

- Si no devuelve datos: Verificar que hay reportes recientes (últimos 30 min)
- Si devuelve NULL: Ajustar filtros de fecha en WHERE
- Para optimizar rendimiento: Ajustar ventanas de tiempo (DATEADD)
*/
