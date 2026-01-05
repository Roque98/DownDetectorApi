# 📊 Entendiendo los Datos de Downdetector

## Estructura de la Tabla Downdetector_Reports

La tabla `Downdetector_Reports` almacena toda la información en un solo lugar:

```sql
SELECT TOP 5
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

**Resultado:**
```
ServiceName | Date                | ReportValue | BaseLineValue | Status      | StatusCode
------------|---------------------|-------------|---------------|-------------|------------
telegram    | 2026-01-02 15:30:00 | 450         | 15            | EMERGENCIA  | 4
telegram    | 2026-01-02 15:15:00 | 25          | 14            | NORMAL      | 0
telegram    | 2026-01-02 15:00:00 | 15          | 12            | NORMAL      | 0
```

## Conceptos Básicos

### 1️⃣ ReportValue (Valor de Reportes)
**Qué es:** Número de usuarios que reportan problemas con el servicio en ese momento específico.

**Ejemplo:**
- `ReportValue = 450` → 450 usuarios reportaron problemas a las 15:30

### 2️⃣ BaseLineValue (Línea Base)
**Qué es:** Nivel "normal" esperado de reportes para ese servicio en ese momento.

**Ejemplo:**
- `BaseLineValue = 15` → Lo normal es tener 15 reportes incluso cuando todo funciona bien

### 3️⃣ Status y StatusCode
**Qué es:** Estado del servicio calculado automáticamente por el sistema basado en el multiplicador (ReportValue / BaseLineValue).

## 🎯 Sistema de Umbrales Automático

El sistema calcula automáticamente el `Status` y `StatusCode` usando esta fórmula:

```
Multiplicador = ReportValue / BaseLineValue
```

### Tabla de Umbrales

| Multiplicador | StatusCode | Status | Emoji | Descripción |
|---------------|------------|--------|-------|-------------|
| < 2x | 0 | NORMAL | ✅ | Todo funciona correctamente |
| 2x - 5x | 1 | ATENCION | 🟡 | Observar - posibles problemas menores |
| 5x - 10x | 2 | ALERTA | 🟠 | Problemas confirmados |
| 10x - 20x | 3 | CRITICO | 🔴 | Interrupción importante |
| >= 20x | 4 | EMERGENCIA | 🔴🔴 | Caída masiva del servicio |
| BaseLineValue = 0 | -1 | SIN_BASELINE | ⚪ | No hay línea base válida |

## 🔍 Interpretación Práctica

### Escenario 1: Todo Normal ✅
```sql
-- Datos en la tabla
Date: 2026-01-02 15:00:00
ReportValue: 15
BaseLineValue: 12
Status: NORMAL
StatusCode: 0

-- Cálculo
Multiplicador = 15 / 12 = 1.25x
Como 1.25x < 2x → Status = NORMAL
```

### Escenario 2: Problema Detectado 🔴🔴
```sql
-- Datos en la tabla
Date: 2026-01-02 15:30:00
ReportValue: 450
BaseLineValue: 15
Status: EMERGENCIA
StatusCode: 4

-- Cálculo
Multiplicador = 450 / 15 = 30x
Como 30x >= 20x → Status = EMERGENCIA
```

### Escenario 3: Recuperándose 🟠
```sql
-- Datos en la tabla
Date: 2026-01-02 16:00:00
ReportValue: 120
BaseLineValue: 11
Status: ALERTA
StatusCode: 2

-- Cálculo
Multiplicador = 120 / 11 = 10.9x
Como 10.9x está entre 5x-10x → Todavía en ALERTA, pero bajando
```

## 📈 Visualización de Datos

```
Reportes
↑
450|                    *  ← EMERGENCIA (30x) - 15:30
400|                   * *
350|                  *   *
300|                 *     *
250|                *       *
200|               *         *
150|              *           *
120|             *             *  ← ALERTA (10.9x) - 16:00
 50|            *               *
 15|___________*_________________*___________→ Tiempo
     15:00   15:15  15:30  15:45  16:00
   (NORMAL)              (recuperándose)

     ━━━━━ BaseLineValue (~12-15 reportes)
     ••••• ReportValue (reportes reales)
```

## 💡 Casos de Uso con el Nuevo Esquema

### 1. Monitoreo en Tiempo Real
```sql
-- Ver servicios con problemas AHORA
SELECT
    s.ServiceName,
    r.Date,
    r.ReportValue,
    r.BaseLineValue,
    r.Status,
    r.StatusCode
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE r.StatusCode >= 2  -- ALERTA o peor
    AND r.Date >= DATEADD(MINUTE, -30, GETDATE())
ORDER BY r.StatusCode DESC, r.Date DESC;
```

### 2. Análisis Histórico
```sql
-- ¿Cuándo fue la última gran interrupción?
SELECT TOP 1
    s.ServiceName,
    r.Date as FechaInterrupcion,
    r.ReportValue,
    r.BaseLineValue,
    r.Status,
    CAST(r.ReportValue AS FLOAT) / r.BaseLineValue as Multiplicador
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE r.StatusCode >= 3  -- CRITICO o EMERGENCIA
ORDER BY r.Date DESC;
```

### 3. Tendencias por Día
```sql
-- ¿El servicio está mejorando o empeorando?
SELECT
    CAST(r.Date AS DATE) as Fecha,
    AVG(r.ReportValue) as PromedioReportes,
    MAX(r.ReportValue) as PicoReportes,
    AVG(r.BaseLineValue) as PromedioBaseline,
    SUM(CASE WHEN r.StatusCode >= 2 THEN 1 ELSE 0 END) as AlertasDelDia
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE s.ServiceName = 'telegram'
    AND r.Date >= DATEADD(DAY, -7, GETDATE())
GROUP BY CAST(r.Date AS DATE)
ORDER BY Fecha DESC;
```

## 🔧 Consultas SQL Útiles

### 📊 Ver situación actual de Telegram:
```sql
SELECT TOP 1
    s.ServiceName,
    r.Date,
    r.ReportValue,
    r.BaseLineValue,
    r.Status,
    r.StatusCode,
    r.ReportValue - r.BaseLineValue as Diferencia,
    CAST(r.ReportValue AS FLOAT) / NULLIF(r.BaseLineValue, 0) as Multiplicador
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE s.ServiceName = 'telegram'
ORDER BY r.Date DESC;
```

### 🚨 Detectar todas las interrupciones mayores (CRÍTICO o EMERGENCIA):
```sql
SELECT
    s.ServiceName,
    r.Date,
    r.ReportValue,
    r.BaseLineValue,
    r.Status,
    r.StatusCode,
    CAST(r.ReportValue AS FLOAT) / NULLIF(r.BaseLineValue, 0) as Multiplicador
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE r.StatusCode >= 3  -- CRITICO (3) o EMERGENCIA (4)
ORDER BY r.Date DESC;
```

### ⏰ Ver evolución en las últimas 3 horas:
```sql
SELECT
    FORMAT(r.Date, 'HH:mm') as Hora,
    r.ReportValue,
    r.BaseLineValue,
    r.ReportValue - r.BaseLineValue as Diferencia,
    r.Status,
    r.StatusCode
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE s.ServiceName = 'telegram'
    AND r.Date >= DATEADD(HOUR, -3, GETDATE())
ORDER BY r.Date DESC;
```

### 📈 Estadísticas por servicio:
```sql
SELECT
    s.ServiceName,
    COUNT(*) as TotalRegistros,
    MIN(r.ReportValue) as MinReportes,
    MAX(r.ReportValue) as MaxReportes,
    AVG(CAST(r.ReportValue AS FLOAT)) as PromedioReportes,
    SUM(CASE WHEN r.StatusCode = 0 THEN 1 ELSE 0 END) as VecesNormal,
    SUM(CASE WHEN r.StatusCode = 1 THEN 1 ELSE 0 END) as VecesAtencion,
    SUM(CASE WHEN r.StatusCode = 2 THEN 1 ELSE 0 END) as VecesAlerta,
    SUM(CASE WHEN r.StatusCode = 3 THEN 1 ELSE 0 END) as VecesCritico,
    SUM(CASE WHEN r.StatusCode = 4 THEN 1 ELSE 0 END) as VecesEmergencia
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
GROUP BY s.ServiceName
ORDER BY s.ServiceName;
```

### 🎯 Detectar cambios de estado (de NORMAL a problema):
```sql
SELECT
    s.ServiceName,
    r.Date,
    r.Status as EstadoActual,
    LAG(r.Status) OVER (PARTITION BY s.ServiceID ORDER BY r.Date) as EstadoAnterior,
    r.ReportValue,
    r.BaseLineValue
FROM Downdetector_Reports r
INNER JOIN Downdetector_Services s ON r.ServiceID = s.ServiceID
WHERE s.ServiceName = 'telegram'
    AND r.Date >= DATEADD(DAY, -1, GETDATE())
ORDER BY r.Date DESC;
```

## 📚 Resumen de Conceptos

| Concepto | Qué Es | Ejemplo |
|----------|--------|---------|
| **ReportValue** | Número de usuarios reportando problemas | 450 usuarios reportan que Telegram no funciona |
| **BaseLineValue** | Nivel normal esperado de reportes | Normalmente hay 15 reportes incluso cuando todo funciona |
| **Diferencia** | ReportValue - BaseLineValue | 450 - 15 = 435 reportes por encima de lo normal |
| **Multiplicador** | ReportValue / BaseLineValue | 450 / 15 = 30x más reportes que lo normal |
| **Status** | Estado en texto | EMERGENCIA, CRITICO, ALERTA, ATENCION, NORMAL |
| **StatusCode** | Estado en número | 4, 3, 2, 1, 0, -1 |

## 🎯 Reglas Simples de Monitoreo

### Para alertas automáticas:
```sql
-- Alerta cuando hay problemas
SELECT *
FROM Downdetector_Reports
WHERE StatusCode >= 2  -- ALERTA (2), CRITICO (3) o EMERGENCIA (4)
    AND Date >= DATEADD(MINUTE, -15, GETDATE());
```

### Para tableros de monitoreo:
```sql
-- Ver estado actual de todos los servicios
SELECT
    s.ServiceName,
    r.Status,
    r.ReportValue,
    r.BaseLineValue,
    DATEDIFF(MINUTE, r.Date, GETDATE()) as MinutosAtras
FROM Downdetector_Services s
INNER JOIN (
    SELECT
        ServiceID,
        Date,
        ReportValue,
        BaseLineValue,
        Status,
        ROW_NUMBER() OVER (PARTITION BY ServiceID ORDER BY Date DESC) as rn
    FROM Downdetector_Reports
) r ON s.ServiceID = r.ServiceID AND r.rn = 1
WHERE s.IsActive = 1
ORDER BY
    CASE r.Status
        WHEN 'EMERGENCIA' THEN 1
        WHEN 'CRITICO' THEN 2
        WHEN 'ALERTA' THEN 3
        WHEN 'ATENCION' THEN 4
        ELSE 5
    END;
```

## ⚡ Ventajas del Nuevo Esquema

1. **Todo en una tabla** - Más fácil de consultar
2. **Status automático** - No necesitas calcularlo manualmente
3. **StatusCode numérico** - Fácil de filtrar y ordenar
4. **Sin duplicados** - El SP previene inserciones repetidas
5. **Más eficiente** - Menos JOINs, consultas más rápidas
