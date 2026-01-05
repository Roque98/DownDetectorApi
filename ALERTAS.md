# Sistema de Alertas por Telegram

## Descripcion

El sistema envia notificaciones automaticas a Telegram cuando ocurren eventos criticos en la aplicacion utilizando el stored procedure `dbmensajes.dbo.EnviaAlertasTelegram`.

## Configuracion

### Variable de Entorno

Agregar en archivo `.env`:

```env
TELEGRAM_GROUP=Pruebas Angel telegram src
```

Este es el nombre del grupo de Telegram donde se enviaran las alertas.

### Stored Procedure Utilizado

```sql
dbmensajes.[dbo].[EnviaAlertasTelegram]
    @TituloMensaje varchar(50),
    @Mensaje varchar(max),
    @TituloGrupoTelegram varchar(1000)
```

## Tipos de Alertas

### 1. Alerta de Inicio de Aplicacion

**Cuando:** La aplicacion inicia exitosamente

**Mensaje:**
```
Aplicacion iniciada correctamente

Fecha: 2026-01-05T10:00:00.000Z
Servidor: SERVIDOR-01
Ambiente: production
Modo: loop
```

### 2. Alerta de Detencion de Aplicacion

**Cuando:** La aplicacion se detiene (normal o por error)

**Mensaje:**
```
Aplicacion detenida

Razon: Normal
Fecha: 2026-01-05T18:00:00.000Z
Servidor: SERVIDOR-01
```

### 3. Alerta de Error General

**Cuando:** Ocurre una excepcion no capturada o fallo en el procesamiento

**Mensaje:**
```
Servicio: Application Initialization
Error: Connection timeout

Stack trace:
Error: Connection timeout
    at Database.connect (database.ts:45)
    ...

Fecha: 2026-01-05T10:05:00.000Z
Servidor: SERVIDOR-01
Ambiente: production
```

### 4. Alerta de Bloqueo de Cloudflare

**Cuando:** DownDetector bloquea la peticion con HTTP 403

**Mensaje:**
```
Servicio: telegram
HTTP Status: 403
Mensaje: DownDetector esta bloqueando las peticiones con Cloudflare

Fecha: 2026-01-05T10:10:00.000Z
Accion requerida: Verificar configuracion del stealth service o actualizar puppeteer-extra-plugin-stealth
```

### 5. Alerta de Falla de Servicio

**Cuando:** Se detecta el challenge de Cloudflare en el HTML

**Mensaje:**
```
Servicio afectado: telegram
URL: https://downdetector.com/status/telegram/
Detalles: Cloudflare challenge page detected despite stealth mode - plugin may need update

Fecha: 2026-01-05T10:15:00.000Z
Servidor: SERVIDOR-01
```

### 6. Alerta de Error de Base de Datos

**Cuando:** Falla una operacion en SQL Server

**Mensaje:**
```
Operacion: Upsert Service: telegram
Error: Login failed for user 'usrmon'

Fecha: 2026-01-05T10:20:00.000Z
Base de datos: DowndetectorDB
Servidor BD: SQLSERVER-01
```

### 7. Alerta de Alta Tasa de Errores en Insercion

**Cuando:** Mas del 50% de los reportes fallan al insertarse

**Mensaje:**
```
Operacion: Insert Reports - High Error Rate
Error: 48 out of 96 reports failed to insert (50% error rate)

Fecha: 2026-01-05T10:25:00.000Z
Base de datos: DowndetectorDB
Servidor BD: SQLSERVER-01
```

## Puntos de Integracion

### index.ts

- Alerta de inicio de aplicacion
- Alerta de detencion (normal o por error)
- Alertas de excepciones no capturadas
- Alertas de promesas rechazadas no manejadas

### downdetector-stealth.service.ts

- Alerta cuando HTTP Status es 403
- Alerta cuando se detecta challenge de Cloudflare en HTML

### database.service.ts

- Alerta cuando falla upsertService
- Alerta cuando falla getServiceByName
- Alerta cuando mas del 50% de inserciones fallan

## Caracteristicas

### No Bloqueante

Los errores al enviar alertas NO detienen la aplicacion. Se registran en consola pero no lanzan excepciones.

### Mensajes en Texto Plano

Todos los mensajes son en texto plano sin emojis para facilitar lectura en Telegram.

### Conexion Separada

Las alertas usan una conexion independiente a la base de datos `dbmensajes`, separada de la conexion principal a `DowndetectorDB`.

### Cierre Automatico de Conexiones

Cada alerta abre y cierra su propia conexion para evitar fugas de recursos.

### Titulo Truncado

Los titulos se truncan automaticamente a 50 caracteres para cumplir con la restriccion del stored procedure.

## Implementacion Tecnica

### AlertService

Servicio centralizado en `src/services/alert.service.ts` que maneja todas las alertas.

**Metodos publicos:**

- `sendAlert(title, message)` - Envio generico
- `sendErrorAlert(serviceName, error)` - Errores generales
- `sendServiceFailureAlert(serviceName, url, details)` - Fallas de servicio
- `sendDatabaseErrorAlert(operation, error)` - Errores de BD
- `sendCloudflareBlockAlert(serviceName, httpStatus)` - Bloqueos Cloudflare
- `sendStartupAlert()` - Inicio de aplicacion
- `sendShutdownAlert(reason)` - Detencion de aplicacion

### Configuracion de Base de Datos

El servicio construye dinamicamente la configuracion para conectarse a `dbmensajes` usando las mismas credenciales y servidor que la conexion principal.

## Monitoreo

Para verificar que las alertas estan funcionando:

1. Revisar el grupo de Telegram configurado
2. Verificar logs de consola:
   - `[Alert] Sending Telegram alert: ...`
   - `[Alert] Telegram alert sent successfully`
3. En caso de error:
   - `[Alert] Failed to send Telegram alert: ...`
   - `[Alert] TELEGRAM_GROUP not configured, skipping alert`

## Consideraciones

### Variable No Configurada

Si `TELEGRAM_GROUP` no esta configurada en `.env`, las alertas se omiten silenciosamente con un warning en logs.

### Ambientes de Desarrollo

Las alertas funcionan en todos los ambientes. Considerar usar grupos diferentes para desarrollo y produccion.

### Frecuencia de Alertas

En modo `loop`, las alertas de inicio/detencion se envian en cada ciclo de la aplicacion.

### Manejo de Errores del SP

Si el stored procedure falla, el error se registra en logs pero no afecta la ejecucion de la aplicacion.

## Ejemplo de Uso Programatico

```typescript
import { AlertService } from './services/alert.service';

const alertService = new AlertService();

// Enviar alerta de error
try {
  await someRiskyOperation();
} catch (error) {
  await alertService.sendErrorAlert('My Service', error as Error);
  throw error;
}

// Enviar alerta personalizada
await alertService.sendAlert(
  'Custom Alert',
  'Something important happened'
);
```

## Troubleshooting

### No se reciben alertas

1. Verificar que `TELEGRAM_GROUP` este configurado en `.env`
2. Verificar que el stored procedure existe en `dbmensajes`
3. Revisar permisos del usuario en la base de datos `dbmensajes`
4. Verificar logs de la aplicacion para mensajes de `[Alert]`

### Alertas duplicadas

Si la aplicacion se reinicia frecuentemente, considera agregar un mecanismo de throttling o usar un grupo de Telegram diferente para desarrollo.

### Error de conexion a dbmensajes

Verificar que:
- El servidor de base de datos es accesible
- Las credenciales son correctas
- La base de datos `dbmensajes` existe
- El usuario tiene permisos de ejecucion en el stored procedure

---

## Monitor de Servicios Inactivos (Stored Procedure)

### Descripcion

Adicionalmente al sistema de alertas integrado en la aplicacion, existe un stored procedure que monitorea servicios que NO estan insertando datos.

**Archivo:** `database/sp_MonitorServiciosInactivos.sql`

### Proposito

Detectar cuando un servicio habilitado NO ha insertado reportes en los ultimos 20 minutos, lo cual puede indicar:
- La aplicacion no esta corriendo
- El servicio esta siendo bloqueado por Cloudflare
- Problemas de conectividad
- Error en la configuracion del servicio

### Ejecucion

**Programacion recomendada:** Cada 15 minutos en Control-M

**Comando:**
```sql
EXEC DowndetectorDB.dbo.MonitorServiciosInactivos
    @TituloGrupoTelegram = 'Pruebas Angel telegram src',
    @MinutosSinDatos = 20
```

### Tipo de Alerta

**Titulo:** `DownDetector - N Servicios Inactivos`

**Mensaje ejemplo:**
```
ALERTA: Servicios sin datos recientes

Umbral configurado: 20 minutos
Fecha de revision: 2026-01-05 10:30:00

Servicios afectados:
===================
- telegram (com)
  Ultimo reporte: 2026-01-05 09:45:00
  Tiempo sin datos: 45 minutos

Accion requerida:
- Verificar que la aplicacion DownDetector API este en ejecucion
- Revisar logs de la aplicacion para errores
- Verificar conectividad a DownDetector.com
- Revisar configuracion de servicios habilitados
```

### Diferencia con Alertas de Aplicacion

| Aspecto | Alertas de Aplicacion | Monitor SP |
|---------|----------------------|------------|
| Disparador | Errores durante ejecucion | Ausencia de datos |
| Cuando detecta | Aplicacion corriendo con errores | Aplicacion NO corriendo o NO insertando |
| Frecuencia | En tiempo real | Cada 15 min (Control-M) |
| Ubicacion | Codigo TypeScript | Stored Procedure SQL |

Ambos sistemas son complementarios y cubren diferentes escenarios de falla.

### Documentacion Completa

Ver `database/README_MonitorServiciosInactivos.md` para:
- Parametros de configuracion
- Ejemplos de ejecucion
- Casos especiales
- Troubleshooting detallado
