# DownDetector API - Sistema de Monitoreo de Disponibilidad de Servicios

## Objetivo
Proporcionar monitoreo automatizado en tiempo real de la disponibilidad y estado de servicios críticos de telecomunicaciones mediante la recolección de datos desde la plataforma DownDetector.com, permitiendo la detección temprana de incidentes y toma de decisiones proactivas basadas en reportes de usuarios a nivel global. Actualmente monitorea el servicio Telegram.

## Estado Actual

- **📊 Monitoreo Automatizado:** permite supervisar de forma continua el estado de servicios como Telegram, WhatsApp, Instagram, Facebook, y otros 23 servicios configurables, recolectando datos cada 15 minutos.

- **🚨 Sistema de Alertas Inteligente:** clasifica automáticamente el estado de cada servicio en cinco niveles (Normal <2x, Atención ≥2x, Alerta ≥5x, Crítico ≥10x, Emergencia ≥20x) basándose en el volumen de reportes comparado con la línea base histórica.

- **📈 Análisis de Tendencias:** proporciona visibilidad de patrones de reportes a través del tiempo, permitiendo identificar degradaciones graduales del servicio antes de que se conviertan en incidentes mayores.

- **💾 Histórico Completo:** almacena todos los reportes en SQL Server con registro de valores actuales y líneas base, facilitando análisis retrospectivos y generación de reportes de disponibilidad.

- **🔐 Bypass de Restricciones:** implementa tecnología stealth para garantizar la recolección continua de datos incluso desde servidores con restricciones de acceso, asegurando disponibilidad 24/7.

- **⚙️ Configuración Flexible:** permite habilitar o deshabilitar servicios de monitoreo según las necesidades del negocio sin intervención técnica, mediante archivo de configuración simple.

- **📧 Sistema de Alertas Automáticas:** notifica al equipo técnico por Telegram cuando ocurren errores críticos, bloqueos de Cloudflare, fallas en base de datos o excepciones no controladas, facilitando respuesta rápida ante incidentes.

## Deploy

### Nombre jobs
-

### Servidores
-

### Ruta
-

## Documentación BD

### Instancia
- **Servidor:** SQL Server (configurado según ambiente)
- **Base de datos:** DownDetectorDB

### Tablas
- **monitoreos.dbo.Downdetector_Services:** Catálogo de servicios monitoreados con configuración de habilitación/deshabilitación
- **monitoreos.dbo.Downdetector_Reports:** Registro histórico de todos los reportes con valores actuales, líneas base y clasificación de estado

### Stored Procedures
- **monitoreos.dbo.Downdetector_UpsertService:** Proceso de inserción o actualización de servicios en el catálogo
- **monitoreos.dbo.Downdetector_UpsertReport:** Proceso de inserción de reportes con clasificación automática de estado según umbrales (Normal <2x, Atención ≥2x, Alerta ≥5x, Crítico ≥10x, Emergencia ≥20x)
- **monitoreos.dbo.MonitorServiciosInactivos:** Monitoreo de servicios sin datos recientes y depuración automática de registros antiguos

## Enlaces externos
- **Repositorio GitHub:** [https://github.com/Roque98/DownDetectorApi.git](https://github.com/Roque98/DownDetectorApi.git)
- **Documentación Técnica:** [README.md](README.md)
- **Guía de Datos:** [EXPLICACION_DATOS.md](EXPLICACION_DATOS.md)
- **Configuración:** [CONFIGURACION_FINAL.md](CONFIGURACION_FINAL.md)
