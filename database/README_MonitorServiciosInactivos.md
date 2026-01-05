# Stored Procedure: MonitorServiciosInactivos

## Descripcion

Stored procedure que detecta servicios de DownDetector que no han insertado datos en los ultimos 20 minutos (configurable) y envia una alerta automatica por Telegram.

## Ubicacion

**Base de datos:** DowndetectorDB (o monitoreos segun configuracion)
**Nombre:** `dbo.MonitorServiciosInactivos`

## Instalacion

Ejecutar el script:
```sql
database/sp_MonitorServiciosInactivos.sql
```

## Parametros

| Parametro | Tipo | Default | Descripcion |
|-----------|------|---------|-------------|
| @TituloGrupoTelegram | VARCHAR(1000) | 'Pruebas Angel telegram src' | Grupo de Telegram donde enviar la alerta |
| @MinutosSinDatos | INT | 20 | Tiempo en minutos sin datos para considerar servicio inactivo |
| @MinutosEntreAlertas | INT | 30 | Tiempo minimo entre alertas para evitar spam (no implementado aun) |
| @DiasRetencion | INT | 4 | Dias de retencion de datos historicos. Registros mas antiguos se eliminan automaticamente |

## Ejecucion Manual

### Ejecucion basica
```sql
EXEC dbo.MonitorServiciosInactivos
    @TituloGrupoTelegram = 'Pruebas Angel telegram src'
```

### Cambiar umbral de tiempo
```sql
EXEC dbo.MonitorServiciosInactivos
    @TituloGrupoTelegram = 'Pruebas Angel telegram src',
    @MinutosSinDatos = 30  -- 30 minutos en lugar de 20
```

### Configurar retencion de datos
```sql
EXEC dbo.MonitorServiciosInactivos
    @TituloGrupoTelegram = 'Pruebas Angel telegram src',
    @DiasRetencion = 7  -- Mantener 7 dias en lugar de 4
```

### Para ambiente de produccion
```sql
EXEC dbo.MonitorServiciosInactivos
    @TituloGrupoTelegram = 'DownDetector Production Alerts'
```

## Programacion en Control-M

### Configuracion recomendada

**Frecuencia:** Cada 15 minutos

**Comando:**
```sql
EXEC DowndetectorDB.dbo.MonitorServiciosInactivos
    @TituloGrupoTelegram = 'Pruebas Angel telegram src',
    @MinutosSinDatos = 20
```

**Horario:** 24/7 (toda la semana)

**Retry:** 2 intentos con 1 minuto de espera

## Funcionamiento

### 1. Deteccion de servicios inactivos

El SP:
1. Obtiene todos los servicios habilitados (IsActive = 1)
2. Verifica la fecha del ultimo reporte de cada servicio
3. Compara con el umbral configurado (20 minutos por defecto)
4. Identifica servicios sin datos recientes

### 2. Construccion del mensaje

Si encuentra servicios inactivos, genera un mensaje con:
- Cantidad de servicios afectados
- Lista detallada de cada servicio:
  - Nombre del servicio
  - Dominio
  - Fecha del ultimo reporte
  - Tiempo sin datos (en minutos u horas)
- Acciones recomendadas

### 3. Envio de alerta

Usa el SP `dbmensajes.dbo.EnviaAlertasTelegram` para enviar la notificacion a Telegram.

### 4. Depuracion automatica de datos historicos

Despues del monitoreo, el SP:
1. Calcula la fecha limite de retencion (@FechaDepuracion = Ahora - @DiasRetencion)
2. Elimina registros de Downdetector_Reports mas antiguos que la fecha limite
3. Registra la cantidad de registros eliminados
4. Incluye estadisticas de depuracion en el resultado

## Ejemplo de Mensaje

### Titulo
```
DownDetector - 2 Servicios Inactivos
```

### Contenido
```
ALERTA: Servicios sin datos recientes

Umbral configurado: 20 minutos
Fecha de revision: 2026-01-05 10:30:00

Servicios afectados:
===================
- telegram (com)
  Ultimo reporte: 2026-01-05 09:45:00
  Tiempo sin datos: 45 minutos

- whatsapp (com)
  Ultimo reporte: 2026-01-05 10:05:00
  Tiempo sin datos: 25 minutos

Accion requerida:
- Verificar que la aplicacion DownDetector API este en ejecucion
- Revisar logs de la aplicacion para errores
- Verificar conectividad a DownDetector.com
- Revisar configuracion de servicios habilitados en services.config.json
```

## Resultado del SP

El SP retorna dos result sets:

### Result Set 1: Resumen
```
ServiciosInactivos | UmbralMinutos | FechaRevision       | RegistrosDepurados | DiasRetencion | FechaLimiteDepuracion | Estado
-------------------|---------------|---------------------|--------------------|--------------|-----------------------|------------------------
2                  | 20            | 2026-01-05 10:30:00 | 15420              | 4            | 2026-01-01 10:30:00   | Alerta enviada
```

### Result Set 2: Detalle
```
ServiceName | Domain | UltimaFecha         | MinutosSinDatos | TiempoSinDatos
------------|--------|---------------------|-----------------|---------------
telegram    | com    | 2026-01-05 09:45:00 | 45              | 45 minutos
whatsapp    | com    | 2026-01-05 10:05:00 | 25              | 25 minutos
```

## Casos Especiales

### Sin servicios inactivos

Si todos los servicios tienen datos recientes:
- NO se envia alerta
- Se imprime mensaje en log: "Todos los servicios activos tienen datos recientes"
- Result set retorna Estado = "OK - Todos los servicios activos"

### Servicio nunca ha tenido datos

Si un servicio habilitado nunca ha insertado reportes:
- UltimaFecha = 1900-01-01
- Se muestra como "Nunca" en el mensaje
- Se calcula el tiempo desde esa fecha

### Error al enviar alerta

Si falla el envio de Telegram:
- El error se captura y registra en log
- El SP NO falla (continua ejecucion)
- Se retorna el resumen de servicios inactivos de todas formas

### Error en depuracion

Si falla la depuracion de registros antiguos:
- El error se captura y registra en log
- Se establece RegistrosDepurados = -1 como indicador de error
- El SP NO falla (continua ejecucion)
- Las alertas de servicios inactivos se envian de todas formas

## Dependencias

### Tablas requeridas
- `Downdetector_Services` - Catalogo de servicios
- `Downdetector_Reports` - Reportes de estado

### Stored Procedures requeridos
- `dbmensajes.dbo.EnviaAlertasTelegram` - Envio de alertas

### Permisos necesarios
- EXECUTE en `dbo.MonitorServiciosInactivos`
- EXECUTE en `dbmensajes.dbo.EnviaAlertasTelegram`
- SELECT en `Downdetector_Services`
- SELECT en `Downdetector_Reports`
- DELETE en `Downdetector_Reports` (para depuracion automatica)

## Monitoreo

### Verificar ultima ejecucion

```sql
-- Ver servicios y su ultimo reporte
SELECT
    s.ServiceName,
    s.Domain,
    s.IsActive,
    MAX(r.Date) AS UltimoReporte,
    DATEDIFF(MINUTE, MAX(r.Date), GETDATE()) AS MinutosSinDatos
FROM
    Downdetector_Services s
    LEFT JOIN Downdetector_Reports r ON s.ServiceID = r.ServiceID
WHERE
    s.IsActive = 1
GROUP BY
    s.ServiceName,
    s.Domain,
    s.IsActive
ORDER BY
    MinutosSinDatos DESC;
```

### Probar sin enviar alerta

Comentar temporalmente la linea del EXEC en el SP para ver que detectaria sin enviar mensajes.

## Troubleshooting

### No se envian alertas cuando deberian

1. Verificar que el grupo de Telegram este configurado correctamente
2. Verificar que `dbmensajes.dbo.EnviaAlertasTelegram` funcione:
   ```sql
   EXEC dbmensajes.dbo.EnviaAlertasTelegram
       @TituloMensaje = 'Test',
       @Mensaje = 'Mensaje de prueba',
       @TituloGrupoTelegram = 'Pruebas Angel telegram src'
   ```
3. Verificar permisos en dbmensajes

### Se envian demasiadas alertas

Aumentar el parametro `@MinutosSinDatos`:
```sql
EXEC dbo.MonitorServiciosInactivos
    @MinutosSinDatos = 30  -- 30 minutos en lugar de 20
```

### Servicios habilitados aparecen como inactivos

1. Verificar que la aplicacion DownDetector API este corriendo
2. Revisar logs de la aplicacion
3. Verificar conectividad a DownDetector.com
4. Verificar que el servicio este habilitado en `services.config.json`

### Depuracion elimina demasiados registros

Verificar el resultado del SP para confirmar cuantos registros se eliminaron:
```sql
-- RegistrosDepurados en el result set muestra la cantidad eliminada
-- FechaLimiteDepuracion muestra la fecha de corte
```

Si necesita mantener mas historial, aumentar @DiasRetencion:
```sql
EXEC dbo.MonitorServiciosInactivos
    @DiasRetencion = 30  -- Mantener 30 dias en lugar de 4
```

### Depuracion no elimina registros (RegistrosDepurados = -1)

Esto indica un error durante la depuracion:
1. Verificar permisos DELETE en tabla Downdetector_Reports
2. Revisar logs del SQL Server para el mensaje de error especifico
3. Verificar que no haya locks o transacciones bloqueando la tabla

## Mantenimiento

### Modificar mensaje de alerta

Editar la seccion del SP donde se construye `@Mensaje`.

### Cambiar umbral global

Modificar el valor default del parametro `@MinutosSinDatos` en la definicion del SP.

### Deshabilitar temporalmente

En Control-M: Pausar o deshabilitar el job temporalmente.

## Integracion con Alertas Existentes

Este SP complementa el sistema de alertas de la aplicacion:
- **Aplicacion:** Envia alertas cuando hay errores durante la ejecucion
- **SP Monitor:** Envia alertas cuando la aplicacion NO esta ejecutandose o NO inserta datos

Ambos sistemas son independientes y complementarios.
