# DownDetector API - Sistema de Monitoreo de Disponibilidad de Servicios

Sistema de monitoreo automatizado en tiempo real de la disponibilidad y estado de servicios críticos de telecomunicaciones mediante la recolección de datos desde la plataforma DownDetector.com.

## Tabla de Contenidos

- [Características Principales](#características-principales)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Estructura de Base de Datos](#estructura-de-base-de-datos)
- [Sistema de Alertas](#sistema-de-alertas)
- [Deployment](#deployment)
- [Consultas SQL Útiles](#consultas-sql-útiles)
- [Troubleshooting](#troubleshooting)
- [Documentación Adicional](#documentación-adicional)

## Características Principales

### Monitoreo Automatizado
- Supervisión continua de servicios como Telegram, WhatsApp, Instagram, Facebook y 23 servicios más configurables
- Recolección de datos cada 10-15 minutos
- Bypass de restricciones Cloudflare mediante tecnología stealth (Puppeteer + plugin)
- Dos modos de ejecución: único (`once`) o bucle continuo (`loop`)

### Sistema de Alertas Inteligente
- Clasificación automática del estado en cinco niveles:
  - **Normal** (<2x baseline)
  - **Atención** (≥2x baseline)
  - **Alerta** (≥5x baseline)
  - **Crítico** (≥10x baseline)
  - **Emergencia** (≥20x baseline)
- Notificaciones por Telegram para errores críticos, bloqueos de Cloudflare, fallas en base de datos
- Monitoreo automático de servicios inactivos (sin datos por 20+ minutos)

### Análisis y Almacenamiento
- Almacenamiento completo en SQL Server con valores actuales y líneas base
- Análisis de tendencias para identificar degradaciones graduales
- Depuración automática de datos antiguos (retención de 4 días por defecto)
- Métricas de ejecución (inserciones exitosas, duplicados, errores)

## Requisitos

- **Node.js** 18 o superior
- **SQL Server** (cualquier versión)
- **npm** o yarn
- Acceso a internet para consultar DownDetector.com

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/Roque98/DownDetectorApi.git
cd DownDetectorApi
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar la base de datos

Ejecutar el script SQL para crear la base de datos, tablas y stored procedures:

```sql
-- En SQL Server Management Studio o Azure Data Studio
-- Ejecutar: database/schema-simple.sql
```

El script creará:
- Tablas: `Downdetector_Services`, `Downdetector_Reports`
- Stored Procedures: `Downdetector_UpsertService`, `Downdetector_UpsertReport`, `MonitorServiciosInactivos`

### 4. Configurar variables de entorno

Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

Editar `.env` con la configuración de tu entorno (ver [Configuración](#configuración)).

### 5. Configurar servicios a monitorear

Editar `services.config.json` para habilitar/deshabilitar servicios:

```json
{
  "services": [
    {
      "name": "telegram",
      "domain": "com",
      "enabled": true,
      "category": "messaging"
    }
  ]
}
```

## Configuración

### Variables de Entorno (.env)

#### Configuración de Base de Datos

```env
# SQL Server Configuration
DB_SERVER=10.118.26.88              # Servidor SQL (IP o hostname)
DB_DATABASE=Monitoreos              # Nombre de la base de datos
DB_USER=usrmon                      # Usuario SQL
DB_PASSWORD=YourPassword123         # Contraseña
DB_PORT=1433                        # Puerto (1433 default, 1533 para Express)
DB_ENCRYPT=false                    # Encriptación TLS (false para local)
DB_TRUST_SERVER_CERTIFICATE=true   # Aceptar certificados auto-firmados
```

**Nota:** SQL Server Express típicamente usa el puerto 1533, la instancia por defecto usa 1433.

#### Configuración de Ejecución

```env
# Application Configuration
NODE_ENV=production                 # Entorno: development/production
EXECUTION_MODE=loop                 # Modo: once (única vez) / loop (continuo)
INTERVAL_MINUTES=10                 # Intervalo para modo loop (minutos)
COLLECT_LAST_MINUTES=45             # Ventana de recolección (evita datos antiguos)
LOG_LEVEL=info                      # Nivel de logging: info/debug/warn/error
```

**Importante:** DownDetector tiene un delay inherente, se recomienda un mínimo de 20-45 minutos para `COLLECT_LAST_MINUTES`.

#### Configuración de Alertas

```env
# Telegram Alerts
TELEGRAM_GROUP=Pruebas Angel telegram src  # Nombre del grupo de Telegram
```

### Archivo de Servicios (services.config.json)

```json
{
  "services": [
    {
      "name": "telegram",              // Nombre del servicio (URL de Downdetector)
      "domain": "com",                 // Dominio: com, es, it, etc.
      "enabled": true,                 // Habilitar/deshabilitar monitoreo
      "category": "messaging"          // Categoría (opcional)
    }
  ]
}
```

### Servicios Disponibles

Puedes monitorear cualquier servicio disponible en Downdetector:

- **Mensajería:** telegram, whatsapp, discord
- **Redes sociales:** instagram, facebook, twitter, tiktok
- **Email:** gmail, outlook
- **Streaming:** youtube, netflix, spotify, twitch
- **Gaming:** steam, playstation-network, xbox-live
- **E-commerce:** amazon, ebay
- **Pagos:** paypal
- **Cloud:** aws, google-cloud, dropbox
- **SaaS:** microsoft-365, zoom, slack
- **Desarrollo:** github
- **Infraestructura:** cloudflare

## Uso

### Compilar el proyecto

```bash
npm run build
```

### Modo de ejecución única (once)

Ejecutar una sola vez y salir (ideal para tareas programadas):

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

### Modo bucle continuo (loop)

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

### Scripts disponibles

- `npm run build` - Compilar TypeScript a JavaScript
- `npm start` - Ejecutar versión compilada (producción)
- `npm run dev` - Ejecutar en modo desarrollo (con ts-node, hot reload)
- `npm run watch` - Compilar en modo watch

## Estructura de Base de Datos

### Configuración de Base de Datos

**Desarrollo:**
- Servidor: DESKTOP-28V1QTH
- Base de datos: DowndetectorDB

**Producción:**
- Servidor: 10.118.26.88
- Base de datos: Monitoreos

### Tabla: Downdetector_Services

Catálogo de servicios monitoreados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| ServiceID | INT (PK, IDENTITY) | ID único del servicio |
| ServiceName | NVARCHAR(100) UNIQUE | Nombre del servicio |
| Domain | NVARCHAR(10) | Dominio de Downdetector (default: 'com') |
| IsActive | BIT | Si está activo para monitoreo (default: 1) |
| CreatedAt | DATETIME2 | Fecha de creación (auto) |
| UpdatedAt | DATETIME2 | Última actualización (auto) |

### Tabla: Downdetector_Reports

Registro histórico de reportes con clasificación automática de estado.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | BIGINT (PK, IDENTITY) | ID único del reporte |
| ServiceID | INT (FK) | ID del servicio |
| Date | DATETIME2 | Fecha y hora del reporte |
| ReportValue | INT | Número de reportes de usuarios |
| BaseLineValue | INT | Valor de línea base en ese momento |
| Status | NVARCHAR(20) | Estado calculado (texto) |
| StatusCode | INT | Código de estado (numérico) |
| CreatedAt | DATETIME2 | Cuándo se guardó (auto) |

**Índices:**
- Unique constraint en (ServiceID, Date)
- Index en (ServiceID, Date DESC)
- Index en (Date DESC)
- Index en (StatusCode DESC)

### Clasificación de Estados

Los reportes se clasifican automáticamente según el ratio ReportValue/BaseLineValue:

| Código | Estado | Condición | Descripción |
|--------|--------|-----------|-------------|
| -1 | SIN_BASELINE | No hay baseline | Sin datos de referencia |
| 0 | NORMAL | < 2x baseline | Operación normal |
| 1 | ATENCION | 2x - 5x baseline | Requiere atención |
| 2 | ALERTA | 5x - 10x baseline | Problemas significativos |
| 3 | CRITICO | 10x - 20x baseline | Situación crítica |
| 4 | EMERGENCIA | ≥ 20x baseline | Emergencia, impacto severo |

### Stored Procedures

#### Downdetector_UpsertService

Insertar o actualizar un servicio en el catálogo.

**Parámetros:**
- `@ServiceName` NVARCHAR(100) - Nombre del servicio
- `@Domain` NVARCHAR(10) - Dominio (default 'com')
- `@IsActive` BIT - Estado activo (default 1)

**Ejemplo:**
```sql
EXEC monitoreos.dbo.Downdetector_UpsertService
    @ServiceName = 'telegram',
    @Domain = 'com',
    @IsActive = 1;
```

#### Downdetector_UpsertReport

Insertar reporte con cálculo automático de estado.

**Parámetros:**
- `@ServiceID` INT - ID del servicio
- `@Date` DATETIME2 - Fecha del reporte
- `@ReportValue` INT - Número de reportes
- `@BaseLineValue` INT - Valor de línea base

**Ejemplo:**
```sql
EXEC monitoreos.dbo.Downdetector_UpsertReport
    @ServiceID = 1,
    @Date = '2025-01-06 10:00:00',
    @ReportValue = 1500,
    @BaseLineValue = 300;
```

**Retorna:**
- `Action`: 'INSERTED' o 'EXISTS'
- `Status`: Estado calculado
- `StatusCode`: Código numérico

#### MonitorServiciosInactivos

Monitoreo automático de servicios sin datos recientes y depuración de datos antiguos.

**Parámetros:**
- `@TituloGrupoTelegram` NVARCHAR(200) - Grupo para alertas
- `@MinutosSinDatos` INT - Umbral de inactividad (default 20)
- `@DiasRetencion` INT - Días de retención de datos (default 4)

**Funcionalidad:**
- Detecta servicios activos sin datos en los últimos N minutos
- Envía alerta por Telegram con listado de servicios inactivos
- Depura automáticamente datos más antiguos que el período de retención

**Programación recomendada:** Cada 15 minutos vía SQL Server Agent o Control-M

**Ejemplo:**
```sql
EXEC monitoreos.dbo.MonitorServiciosInactivos
    @TituloGrupoTelegram = 'Monitoreo DownDetector',
    @MinutosSinDatos = 20,
    @DiasRetencion = 4;
```

## Sistema de Alertas

El sistema incluye alertas automáticas por Telegram para diversos eventos:

### Tipos de Alertas

1. **Inicio de Aplicación** - Al iniciar correctamente
2. **Cierre de Aplicación** - Al detenerse (normal o error)
3. **Errores Críticos** - Excepciones no controladas con stack trace
4. **Fallas de Servicio** - Cuando Cloudflare bloquea el acceso
5. **Errores de Base de Datos** - Fallos en operaciones de BD
6. **Alta Tasa de Errores** - >50% de inserciones fallan
7. **Bloqueo de Cloudflare** - HTTP 403 detectado
8. **Servicios Inactivos** - Sin datos por más de 20 minutos (vía SP)

### Configuración de Alertas

Las alertas requieren:
- Variable `TELEGRAM_GROUP` configurada en `.env`
- Acceso a la base de datos `dbmensajes` (para stored procedure de alertas)
- Stored procedure `EnviaAlertasTelegram` configurado

Ver documentación completa en [ALERTAS.md](ALERTAS.md).

## Deployment

### Entorno de Producción

**Servidor de Aplicación:**
- IP: 10.118.24.87
- Ruta: `D:\b1065129\Proyectos\git\DownDetectorApi\`
- Script: `start-dev.bat`

**Servidor de Base de Datos:**
- IP: 10.118.26.88
- Base de datos: Monitoreos

**Task Scheduler:**
- Nombre del job: `Downdetector_API`
- Comando: `D:\b1065129\Proyectos\git\DownDetectorApi\start-dev.bat`

### Script de Inicio (start-dev.bat)

```batch
@echo off
cd /d D:\b1065129\Proyectos\git\DownDetectorApi
call npm run dev
```

## Consultas SQL Útiles

### Ver reportes recientes de un servicio

```sql
SELECT TOP 100
    r.Date,
    r.ReportValue,
    r.BaseLineValue,
    r.Status,
    r.StatusCode
FROM monitoreos.dbo.Downdetector_Reports r
INNER JOIN monitoreos.dbo.Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE s.ServiceName = 'telegram'
ORDER BY r.Date DESC;
```

### Ver servicios con alertas activas

```sql
SELECT
    s.ServiceName,
    r.Date,
    r.ReportValue,
    r.BaseLineValue,
    r.Status
FROM monitoreos.dbo.Downdetector_Reports r
INNER JOIN monitoreos.dbo.Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE r.StatusCode >= 2  -- ALERTA o superior
    AND r.Date >= DATEADD(HOUR, -1, GETDATE())
ORDER BY r.StatusCode DESC, r.Date DESC;
```

### Ver estadísticas por servicio (últimas 24 horas)

```sql
SELECT
    s.ServiceName,
    COUNT(*) as TotalReportes,
    AVG(CAST(r.ReportValue AS FLOAT)) as PromedioReportes,
    MAX(r.ReportValue) as MaximoReportes,
    MAX(r.StatusCode) as MayorNivelAlerta
FROM monitoreos.dbo.Downdetector_Reports r
INNER JOIN monitoreos.dbo.Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE r.Date >= DATEADD(HOUR, -24, GETDATE())
GROUP BY s.ServiceName
ORDER BY MayorNivelAlerta DESC, MaximoReportes DESC;
```

### Ver servicios activos sin datos recientes

```sql
SELECT
    s.ServiceName,
    MAX(r.Date) as UltimoReporte,
    DATEDIFF(MINUTE, MAX(r.Date), GETDATE()) as MinutosSinDatos
FROM monitoreos.dbo.Downdetector_Services s
LEFT JOIN monitoreos.dbo.Downdetector_Reports r ON s.ServiceID = r.ServiceID
WHERE s.IsActive = 1
GROUP BY s.ServiceName, s.ServiceID
HAVING MAX(r.Date) IS NULL
    OR DATEDIFF(MINUTE, MAX(r.Date), GETDATE()) > 20
ORDER BY MinutosSinDatos DESC;
```

### Limpiar datos antiguos manualmente

```sql
-- Eliminar reportes más antiguos de 4 días
DELETE FROM monitoreos.dbo.Downdetector_Reports
WHERE Date < DATEADD(DAY, -4, GETDATE());
```

## Troubleshooting

### Error de conexión a SQL Server

Si obtienes errores de conexión:

1. Verificar que SQL Server esté corriendo
2. Validar credenciales en `.env`
3. Confirmar el puerto correcto (1433 default, 1533 para Express)
4. Verificar firewall y conectividad de red
5. Si usas Windows Authentication, ajustar configuración de conexión

### Error de Cloudflare / Bloqueo 403

Si recibes errores de Cloudflare:

- El sistema incluye bypass automático con Puppeteer + stealth plugin
- Si persiste, espera unos minutos y reintenta
- Considera usar un dominio diferente (.es, .it en lugar de .com)
- Verifica que las dependencias de Puppeteer estén correctamente instaladas

### No se encuentran servicios habilitados

Verifica que en `services.config.json` al menos un servicio tenga `"enabled": true`

### Alertas no se envían

1. Verificar variable `TELEGRAM_GROUP` en `.env`
2. Confirmar acceso a base de datos `dbmensajes`
3. Validar que el stored procedure `EnviaAlertasTelegram` existe
4. Revisar logs para errores de alerta (son no-bloqueantes)

### Duplicados en base de datos

El sistema previene duplicados automáticamente:
- Unique constraint en (ServiceID, Date)
- Si ya existe un reporte, retorna 'EXISTS' sin error

### Rendimiento lento

- Reducir `COLLECT_LAST_MINUTES` para procesar menos datos
- Deshabilitar servicios no necesarios en `services.config.json`
- Ejecutar `MonitorServiciosInactivos` regularmente para limpiar datos antiguos
- Verificar índices en las tablas

## Documentación Adicional

- **[resumen.md](resumen.md)** - Resumen ejecutivo del proyecto
- **[ALERTAS.md](ALERTAS.md)** - Documentación completa del sistema de alertas
- **[CONFIGURACION_FINAL.md](CONFIGURACION_FINAL.md)** - Guía de configuración detallada
- **[EXPLICACION_DATOS.md](EXPLICACION_DATOS.md)** - Explicación de la estructura de datos
- **[MIGRACION.md](MIGRACION.md)** - Guía de migración de base de datos

## Tecnologías Utilizadas

- **Runtime:** Node.js 18+
- **Lenguaje:** TypeScript 5.9.3
- **Base de Datos:** SQL Server (via mssql 12.2.0)
- **API Client:** downdetector-api 2.1.0
- **Browser Automation:** Puppeteer + stealth plugin
- **HTML Parsing:** Cheerio 1.1.2
- **Environment:** dotenv 17.2.3

## Licencia

ISC

## Créditos

- **Repositorio:** [https://github.com/Roque98/DownDetectorApi.git](https://github.com/Roque98/DownDetectorApi.git)
- **Librería base:** [downdetector-api](https://github.com/DavideViolante/downdetector-api) - API no oficial de Downdetector
