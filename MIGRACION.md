# 📋 Migración a Nuevo Esquema Simplificado

## Cambios Principales

### ❌ Eliminado:
- Tabla `Baselines` (ahora BaseLineValue está en Reports)
- Tabla `ExecutionLogs`
- Vistas `vw_LatestReports`, `vw_ServiceStats`
- SPs de consulta

### ✅ Nuevo:
- Tabla `Downdetector_Services` (igual que antes pero con prefijo)
- Tabla `Downdetector_Reports` con columnas:
  - `id` - Identificador único
  - `ServiceID` - FK a Services
  - `Date` - Fecha del reporte
  - `ReportValue` - Número de reportes
  - `BaseLineValue` - Línea base
  - `Status` - Estado en texto (NORMAL, ATENCION, ALERTA, CRITICO, EMERGENCIA)
  - `StatusCode` - Estado en número (-1, 0, 1, 2, 3, 4)
  - `CreatedAt` - Cuándo se insertó

### 📝 Stored Procedures:
- `Downdetector_UpsertService` - Insertar/actualizar servicio
- `Downdetector_UpsertReport` - Insertar reporte con cálculo automático de Status

## 🚀 Pasos para Migrar

### 1. Hacer Backup (OPCIONAL pero recomendado)

```sql
-- Backup de datos existentes
SELECT * INTO Downdetector_Services_Backup FROM Services;
SELECT * INTO Reports_Backup FROM Reports;
SELECT * INTO Baselines_Backup FROM Baselines;
```

### 2. Eliminar Esquema Anterior

```sql
-- Eliminar tablas antiguas
DROP TABLE IF EXISTS ExecutionLogs;
DROP TABLE IF EXISTS Baselines;
DROP TABLE IF EXISTS Reports;
DROP TABLE IF EXISTS Services;

-- Eliminar vistas
DROP VIEW IF EXISTS vw_LatestReports;
DROP VIEW IF EXISTS vw_ServiceStats;

-- Eliminar SPs antiguos
DROP PROCEDURE IF EXISTS sp_UpsertService;
DROP PROCEDURE IF EXISTS sp_CleanOldData;
```

### 3. Ejecutar Nuevo Schema

En SQL Server Management Studio:
1. Conecta a `DESKTOP-28V1QTH\SQLEXPRESS`
2. Selecciona la base de datos `DowndetectorDB`
3. Abre y ejecuta: **`database/schema-simple.sql`**

### 4. Verificar Instalación

```sql
-- Verificar tablas
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE 'Downdetector_%';

-- Debe mostrar:
-- Downdetector_Services
-- Downdetector_Reports

-- Verificar SPs
SELECT ROUTINE_NAME
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_NAME LIKE 'Downdetector_%';

-- Debe mostrar:
-- Downdetector_UpsertService
-- Downdetector_UpsertReport
```

### 5. Probar la Aplicación

```bash
npm run dev
```

## 📊 Cómo se Calculan los Status

El SP `Downdetector_UpsertReport` calcula automáticamente el Status basado en:

```
Multiplicador = ReportValue / BaseLineValue

StatusCode | Status       | Umbral
-----------|--------------|----------------
    -1     | SIN_BASELINE | BaseLineValue = 0
     0     | NORMAL       | < 2x
     1     | ATENCION     | 2x - 5x
     2     | ALERTA       | 5x - 10x
     3     | CRITICO      | 10x - 20x
     4     | EMERGENCIA   | >= 20x
```

## 🔍 Consultas Útiles

### Ver últimos reportes:
```sql
SELECT TOP 10
    s.ServiceName,
    r.Date,
    r.ReportValue,
    r.BaseLineValue,
    r.Status,
    r.StatusCode
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
ORDER BY r.Date DESC;
```

### Ver solo problemas (Status >= ATENCION):
```sql
SELECT
    s.ServiceName,
    r.Date,
    r.ReportValue,
    r.BaseLineValue,
    r.Status
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE r.StatusCode >= 1
ORDER BY r.StatusCode DESC, r.Date DESC;
```

### Estadísticas por servicio:
```sql
SELECT
    s.ServiceName,
    COUNT(*) as TotalReports,
    MAX(r.ReportValue) as MaxReports,
    AVG(CAST(r.ReportValue AS FLOAT)) as AvgReports,
    SUM(CASE WHEN r.StatusCode >= 2 THEN 1 ELSE 0 END) as AlertCount
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
GROUP BY s.ServiceName;
```

## ⚙️ Configuración del .env

Tu `.env` actual está correcto, no necesita cambios:

```env
DB_SERVER=DESKTOP-28V1QTH
DB_PORT=1533
DB_DATABASE=DowndetectorDB
DB_USER=usrmon
DB_PASSWORD=MonAplic01@
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

EXECUTION_MODE=once
INTERVAL_MINUTES=10
NODE_ENV=development
LOG_LEVEL=info
```

## ✅ Resultado Esperado

Cuando ejecutes `npm run dev`, deberías ver:

```
╔════════════════════════════════════════╗
║  Downdetector SQL Server Integration  ║
╚════════════════════════════════════════╝

Connecting to database...
✓ Database connection established

Configuration:
  - Execution Mode: once
  - Environment: development

Mode: Single execution

========================================
Starting data collection
Timestamp: 2026-01-02T23:XX:XX.XXXZ
========================================

Processing 1 enabled service(s):

Processing: telegram (com)
Fetching data for telegram from downdetector.com...
✓ Fetched 96 reports and 96 baseline entries for telegram
  ✓ 96 reports processed (96 new) in X.XXs

========================================
Data collection completed
========================================

✓ Execution completed successfully
```
