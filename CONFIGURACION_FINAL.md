# ✅ Configuración Final que Funciona

## Configuración de `.env`

```env
# SQL Server Configuration
DB_SERVER=DESKTOP-28V1QTH
DB_PORT=1533
DB_DATABASE=DowndetectorDB
DB_USER=usrmon
DB_PASSWORD=MonAplic01@
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# Application Configuration
NODE_ENV=development

# Execution Mode Configuration
EXECUTION_MODE=once
INTERVAL_MINUTES=10

# Data Collection Settings
# Only collect data from the last N minutes (avoids inserting old data)
COLLECT_LAST_MINUTES=5

# Logging
LOG_LEVEL=info
```

## ✅ Puntos Clave

1. **Servidor**: Usa el nombre completo del servidor (ej: `DESKTOP-28V1QTH`)
2. **Puerto**: SQL Express suele usar el puerto `1533` (no 1433)
3. **No se requiere SQL Server Browser** cuando usas puerto directo
4. **Encryption**: Debe estar en `false` para evitar problemas de certificados
5. **Solo datos recientes**: El sistema filtra automáticamente para insertar solo los datos de los últimos 5 minutos (configurable con `COLLECT_LAST_MINUTES`)

## 🔍 Cómo Encontrar tu Puerto

Si tu configuración es diferente, encuentra tu puerto con PowerShell:

```powershell
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL*\MSSQLServer\SuperSocketNetLib\Tcp\IPAll' |
Select-Object TcpPort, TcpDynamicPorts
```

O usa el script incluido:

```powershell
.\find-sql-ports.ps1
```

## 🚀 Ejecutar la Aplicación

### Modo único (una sola ejecución)

```env
EXECUTION_MODE=once
```

```bash
npm run dev
```

### Modo bucle (cada N minutos)

```env
EXECUTION_MODE=loop
INTERVAL_MINUTES=10
```

```bash
npm start
```

## 📊 Verificar Datos

Ejecuta las consultas en `queries-test.sql` en SQL Server Management Studio para ver los datos guardados.

## 🎯 Resultado Esperado

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
Timestamp: 2026-01-02T22:51:00.920Z
========================================

Processing 1 enabled service(s):

Processing: telegram (com)
Fetching data for telegram from downdetector.com...
✓ Fetched 96 reports and 96 baseline entries for telegram
✓ Inserted 96 reports for service ID 1
✓ Inserted 96 baselines for service ID 1
  ✓ 96 reports, 96 baselines (5.05s)

========================================
Data collection completed
========================================

✓ Execution completed successfully
```

## 🔧 Servicios Configurables

Edita `services.config.json` para habilitar más servicios:

```json
{
  "services": [
    {
      "name": "telegram",
      "domain": "com",
      "enabled": true
    },
    {
      "name": "whatsapp",
      "domain": "com",
      "enabled": false
    }
  ]
}
```

Cambia `"enabled": true` para activar los servicios que quieras monitorear.
