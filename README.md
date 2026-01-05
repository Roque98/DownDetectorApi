# Downdetector SQL Server Integration

Integración de la librería `downdetector-api` con SQL Server para monitorear y almacenar datos de estado de servicios web.

## Características

- ✅ Consulta automática de datos de Downdetector
- ✅ Almacenamiento en SQL Server
- ✅ Dos modos de ejecución: único o bucle continuo
- ✅ Configuración flexible de servicios
- ✅ Logging detallado de ejecuciones
- ✅ Manejo de errores robusto

## Requisitos

- Node.js 18 o superior
- SQL Server (cualquier versión)
- npm o yarn

## Instalación

1. Clonar o descargar el proyecto

2. Instalar dependencias:
```bash
npm install
```

3. Configurar SQL Server:

Ejecutar el script SQL para crear la base de datos y tablas:
```bash
# En SQL Server Management Studio o Azure Data Studio, ejecutar:
database/schema.sql
```

4. Configurar variables de entorno:

Copiar `.env.example` a `.env` y configurar:
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:
```env
# SQL Server Configuration
DB_SERVER=localhost
DB_DATABASE=DowndetectorDB
DB_USER=sa
DB_PASSWORD=TuPassword123
DB_PORT=1433
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# Execution Mode Configuration
# MODE: 'once' for single execution, 'loop' for continuous execution
EXECUTION_MODE=loop

# Interval in minutes for loop mode (ignored in 'once' mode)
INTERVAL_MINUTES=10

# Data Collection Settings
# Only collect data from the last N minutes (avoids inserting old data)
# Downdetector tiene delay, usa al menos 20 minutos
COLLECT_LAST_MINUTES=45
```

5. Configurar servicios a monitorear:

Editar `services.config.json`:
```json
{
  "services": [
    {
      "name": "telegram",
      "domain": "com",
      "enabled": true,
      "category": "messaging"
    },
    {
      "name": "whatsapp",
      "domain": "com",
      "enabled": false,
      "category": "messaging"
    }
  ]
}
```

## Uso

### Compilar el proyecto

```bash
npm run build
```

### Modo de ejecución única

Ejecutar una sola vez y salir:

1. Configurar en `.env`:
```env
EXECUTION_MODE=once
```

2. Ejecutar:
```bash
npm start
```

O en desarrollo:
```bash
npm run dev
```

### Modo bucle continuo

Ejecutar continuamente cada N minutos:

1. Configurar en `.env`:
```env
EXECUTION_MODE=loop
INTERVAL_MINUTES=10
```

2. Ejecutar:
```bash
npm start
```

El script se ejecutará cada 10 minutos (o el intervalo configurado).

Para detener: `Ctrl+C`

## Scripts disponibles

- `npm run build` - Compilar TypeScript a JavaScript
- `npm start` - Ejecutar versión compilada
- `npm run dev` - Ejecutar en modo desarrollo (con ts-node)
- `npm run watch` - Compilar en modo watch

## Estructura de la Base de Datos

### Tabla: Services
Almacena los servicios monitoreados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| ServiceID | INT | ID único del servicio |
| ServiceName | NVARCHAR(100) | Nombre del servicio |
| Domain | NVARCHAR(10) | Dominio de Downdetector |
| IsActive | BIT | Si está activo |
| CreatedAt | DATETIME2 | Fecha de creación |
| UpdatedAt | DATETIME2 | Última actualización |

### Tabla: Reports
Almacena los reportes de problemas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| ReportID | BIGINT | ID único del reporte |
| ServiceID | INT | ID del servicio |
| ReportDate | DATETIME2 | Fecha del reporte |
| ReportValue | INT | Número de reportes |
| CreatedAt | DATETIME2 | Cuándo se guardó |

### Tabla: Baselines
Almacena los datos de baseline.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| BaselineID | BIGINT | ID único |
| ServiceID | INT | ID del servicio |
| BaselineDate | DATETIME2 | Fecha del baseline |
| BaselineValue | INT | Valor del baseline |
| CreatedAt | DATETIME2 | Cuándo se guardó |

### Tabla: ExecutionLogs
Registra todas las ejecuciones.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| LogID | BIGINT | ID único |
| ServiceID | INT | ID del servicio (nullable) |
| ExecutionDate | DATETIME2 | Cuándo se ejecutó |
| Status | NVARCHAR(20) | success/error/warning |
| Message | NVARCHAR(MAX) | Mensaje |
| ErrorDetails | NVARCHAR(MAX) | Detalles del error |

## Vistas Disponibles

### vw_LatestReports
Muestra los últimos reportes de cada servicio activo.

### vw_ServiceStats
Estadísticas agregadas por servicio (total reportes, máximo, promedio, etc.)

## Procedimientos Almacenados

### sp_UpsertService
Insertar o actualizar un servicio.

### sp_CleanOldData
Limpiar datos antiguos (por defecto mantiene 30 días).

Ejemplo de uso:
```sql
EXEC sp_CleanOldData @DaysToKeep = 30;
```

## Configuración de Servicios

El archivo `services.config.json` permite configurar qué servicios monitorear:

```json
{
  "services": [
    {
      "name": "telegram",      // Nombre del servicio en Downdetector
      "domain": "com",         // Dominio: com, es, it, etc.
      "enabled": true,         // Si está habilitado
      "category": "messaging"  // Categoría (opcional)
    }
  ]
}
```

### Servicios disponibles

Puedes monitorear cualquier servicio que tenga página en Downdetector. Ejemplos:

- **Mensajería**: telegram, whatsapp, discord
- **Redes sociales**: instagram, facebook, twitter, tiktok
- **Email**: gmail, outlook
- **Streaming**: youtube, netflix, spotify, twitch
- **Gaming**: steam, playstation-network, xbox-live
- **Cloud/SaaS**: aws, google-cloud, microsoft-365, zoom, slack
- **Otros**: github, cloudflare, paypal, amazon

## Consultas SQL Útiles

### Ver últimos reportes
```sql
SELECT * FROM vw_LatestReports;
```

### Ver estadísticas de servicios
```sql
SELECT * FROM vw_ServiceStats;
```

### Ver reportes de un servicio específico
```sql
SELECT TOP 100 r.*, s.ServiceName
FROM Reports r
INNER JOIN Services s ON r.ServiceID = s.ServiceID
WHERE s.ServiceName = 'telegram'
ORDER BY r.ReportDate DESC;
```

### Ver logs de ejecución
```sql
SELECT TOP 50 * FROM ExecutionLogs
ORDER BY ExecutionDate DESC;
```

### Ver servicios con más reportes en las últimas 24 horas
```sql
SELECT
    s.ServiceName,
    COUNT(*) as ReportCount,
    MAX(r.ReportValue) as MaxValue,
    AVG(CAST(r.ReportValue AS FLOAT)) as AvgValue
FROM Reports r
INNER JOIN Services s ON r.ServiceID = s.ServiceID
WHERE r.ReportDate >= DATEADD(HOUR, -24, GETDATE())
GROUP BY s.ServiceName
ORDER BY ReportCount DESC;
```

## Troubleshooting

### Error de conexión a SQL Server

Si obtienes errores de conexión, verifica:

1. SQL Server está corriendo
2. Las credenciales son correctas
3. El puerto está abierto (por defecto 1433)
4. Si usas Windows Authentication, ajusta la configuración

### Error de Cloudflare

La API de Downdetector puede estar protegida por Cloudflare. Si esto ocurre:

- Espera unos minutos y vuelve a intentar
- Reduce la frecuencia de consultas
- Considera usar un dominio diferente (.es, .it, etc.)

### No se encuentran servicios

Verifica que en `services.config.json` al menos un servicio tenga `"enabled": true`

## Mantenimiento

### Limpiar datos antiguos

Ejecutar periódicamente (puede ser un job de SQL Server):
```sql
EXEC sp_CleanOldData @DaysToKeep = 30;
```

### Backup de la base de datos

Se recomienda configurar backups automáticos en SQL Server.

## Licencia

ISC

## Créditos

- [downdetector-api](https://github.com/DavideViolante/downdetector-api) - API no oficial de Downdetector
