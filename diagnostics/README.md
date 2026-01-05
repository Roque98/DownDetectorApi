# Diagnóstico de DownDetector API

## Problema

Si la API funciona en tu equipo local pero **no funciona en el servidor** (devuelve respuesta vacía), es porque Puppeteer necesita configuración especial.

## Solución en 3 pasos

### 1. Ejecutar diagnóstico en el servidor

```bash
npm run diagnose
```

O directamente:

```bash
node diagnostics/puppeteer-test.js
```

Este script te dirá exactamente qué está fallando.

### 2. Leer la solución

El script te indicará qué archivo leer:

- **TROUBLESHOOTING.md** - Guía completa con todas las soluciones posibles
- **PUPPETEER_FIX.md** - Implementación rápida si solo necesitas ajustar configuración

### 3. Aplicar la solución

Sigue las instrucciones del archivo correspondiente.

---

## Archivos en esta carpeta

| Archivo | Descripción |
|---------|-------------|
| `puppeteer-test.js` | Script de diagnóstico automático |
| `TROUBLESHOOTING.md` | Guía completa de soluciones (instalar dependencias, Docker, etc.) |
| `PUPPETEER_FIX.md` | Solución rápida para configurar Puppeteer |
| `README.md` | Este archivo |

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
