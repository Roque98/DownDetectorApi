# Diagnóstico de DownDetector API

## Problemas comunes

### Problema 1: Devuelve datos vacíos `[]`

Si obtienes:
```json
{ "reports": [], "baseline": [] }
```

**Lee:** `EMPTY_DATA.md` - El problema es el **nombre del servicio** o DownDetector cambió su estructura.

### Problema 2: Error de Puppeteer / No funciona en el servidor

Si obtienes errores de "Could not find Chrome" o similar.

**Lee:** `TROUBLESHOOTING.md` - El problema es **configuración de Puppeteer**.

---

## Comandos de diagnóstico disponibles

```bash
# 1. Verificar que Puppeteer funciona
npm run diagnose

# 2. Verificar todos los servicios configurados
npm run diagnose:services

# 3. Capturar HTML de un servicio específico
npm run diagnose:html [service] [domain]
# Ejemplo: npm run diagnose:html telegram com
```

## Pasos de diagnóstico

### Paso 1: Ejecutar diagnóstico general

```bash
npm run diagnose
```

**Resultado esperado:**
- ✅ `ALL TESTS PASSED` → Puppeteer funciona, ve al Paso 2
- ❌ `Failed` → Lee `TROUBLESHOOTING.md` para arreglar Puppeteer

### Paso 2: Verificar servicios

```bash
npm run diagnose:services
```

Este comando revisa todos tus servicios en `services.config.json` y te dice:
- ✅ Cuáles funcionan correctamente
- ⚠️ Cuáles existen pero no tienen datos
- ❌ Cuáles no existen (nombre incorrecto)

**Si encuentras servicios sin datos o no encontrados:**
- Lee `EMPTY_DATA.md` para soluciones

### Paso 3: Aplicar la solución

Sigue las instrucciones del archivo correspondiente:
- **EMPTY_DATA.md** - Corregir nombres de servicios
- **TROUBLESHOOTING.md** - Arreglar Puppeteer
- **PUPPETEER_FIX.md** - Fix rápido de configuración

---

## Archivos en esta carpeta

| Archivo | Descripción |
|---------|-------------|
| `README.md` | Este archivo - Guía de inicio |
| `EMPTY_DATA.md` | **Solución para datos vacíos** - Corregir nombres de servicios |
| `TROUBLESHOOTING.md` | Solución para problemas de Puppeteer |
| `PUPPETEER_FIX.md` | Fix rápido de configuración Puppeteer |
| `puppeteer-test.js` | Script: Verificar que Puppeteer funciona |
| `verify-services.js` | Script: Verificar todos los servicios |
| `capture-html.js` | Script: Capturar HTML de un servicio |
| `output/` | Carpeta con resultados de diagnósticos |

---

## ¿Por qué falla en el servidor?

La librería `downdetector-api` usa **Puppeteer** (navegador Chrome headless). En servidores suele fallar porque:

1. ❌ Chrome/Chromium no está instalado
2. ❌ Faltan dependencias del sistema (librerías compartidas)
3. ❌ Configuración de sandbox incompatible con el servidor

## Solución más común

**Linux/Ubuntu:**

```bash
# Instalar Chrome
sudo apt-get update
sudo apt-get install -y chromium-browser

# Verificar
npm run diagnose
```

Si sigue fallando, revisa `TROUBLESHOOTING.md`.

---

## Soporte

Si ninguna solución funciona, revisa los logs detallados de la aplicación:

```bash
npm run dev
```

Los logs ahora incluyen información completa sobre:
- Versión de Node.js
- Plataforma del sistema
- Errores detallados con stack trace
- Estado de las respuestas de DownDetector
