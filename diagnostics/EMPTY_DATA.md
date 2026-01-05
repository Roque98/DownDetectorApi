# Solución: DownDetector devuelve datos vacíos

## Problema identificado

Si Puppeteer funciona correctamente (test diagnóstico pasa) pero obtienes:
```json
{
  "reports": [],
  "baseline": []
}
```

El problema **NO es de Puppeteer**, sino que:
1. DownDetector cambió su estructura HTML
2. El nombre del servicio es incorrecto
3. El servicio no existe en ese dominio
4. El servicio actualmente no tiene problemas reportados (y DownDetector no muestra gráficas)

---

## Diagnóstico: Verificar tus servicios

### 1. Verificar todos los servicios configurados

```bash
npm run diagnose:services
```

Este comando:
- Verifica cada servicio en `services.config.json`
- Te dice cuáles existen en DownDetector
- Identifica cuáles tienen datos y cuáles no
- Guarda un reporte detallado en `diagnostics/output/`

**Ejemplo de salida:**

```
✓ Valid (with data):     2
⚠️  Exists (no data):     1
❌ Not found:            1

⚠️  SERVICES WITH NO DATA:
   - telegram (com)
     URL: https://downdetector.com/status/telegram/
     Reason: Service is currently working fine (no problems reported)

❌ SERVICES NOT FOUND:
   - whatsap (com)  ← typo en el nombre
     URL: https://downdetector.com/status/whatsap/
     💡 Check the service name on DownDetector website
```

---

### 2. Capturar el HTML real de un servicio

Para investigar un servicio específico:

```bash
npm run diagnose:html telegram com
```

Esto guarda el HTML completo en `diagnostics/output/` para que puedas inspeccionarlo.

---

## Soluciones

### Solución 1: Corregir nombres de servicios

Los nombres deben coincidir exactamente con los que usa DownDetector.

**Verificar el nombre correcto:**
1. Abre https://downdetector.com en tu navegador
2. Busca el servicio
3. Copia el nombre de la URL: `https://downdetector.com/status/[NOMBRE-CORRECTO]/`

**Ejemplos comunes:**
- ❌ `telegram` → ✓ `telegram-messenger`
- ❌ `whatsap` → ✓ `whatsapp`
- ❌ `instagram` → ✓ `instagram`
- ❌ `fb` → ✓ `facebook`

**Actualizar en `services.config.json`:**

```json
{
  "services": [
    {
      "name": "telegram-messenger",  // ← nombre correcto
      "domain": "com",
      "enabled": true
    }
  ]
}
```

---

### Solución 2: Usar dominios diferentes

Algunos servicios existen en ciertos dominios pero no en otros.

```json
{
  "services": [
    {
      "name": "telegram",
      "domain": "es",  // ← probar con .es en lugar de .com
      "enabled": true
    }
  ]
}
```

**Dominios disponibles:**
- `com` - Internacional (inglés)
- `es` - España
- `it` - Italia
- `br` - Brasil
- `fr` - Francia
- `de` - Alemania
- Y más...

---

### Solución 3: DownDetector cambió su estructura

Si `diagnose:html` muestra que la página existe pero no tiene el patrón `{ x: '`, significa que DownDetector cambió su estructura HTML.

**Verificar la versión de la librería:**

```bash
npm list downdetector-api
```

Si está desactualizada:

```bash
npm update downdetector-api
```

**Si sigue sin funcionar**, la librería `downdetector-api` necesita actualizarse. Opciones:

#### Opción A: Esperar actualización de la librería
Reportar el issue en: https://github.com/brunoamil/downdetector-api/issues

#### Opción B: Fork y modificar manualmente
Si eres desarrollador, puedes:
1. Capturar el HTML con `npm run diagnose:html`
2. Inspeccionar cómo cambió la estructura
3. Modificar `node_modules/downdetector-api/index.js` para adaptarlo
4. Usar `patch-package` para mantener los cambios

---

### Solución 4: El servicio realmente no tiene problemas

Si DownDetector dice "No problems detected", es normal que no haya datos en el gráfico.

**Opciones:**

1. **Esperar a que haya problemas** - Los datos aparecerán cuando haya reportes
2. **Probar con servicios que actualmente tienen problemas**
3. **Usar datos históricos si la API los proporciona**

---

## Scripts de diagnóstico

| Comando | Descripción |
|---------|-------------|
| `npm run diagnose` | Verifica que Puppeteer funcione |
| `npm run diagnose:services` | Verifica todos tus servicios configurados |
| `npm run diagnose:html [service] [domain]` | Captura HTML de un servicio específico |

---

## Ejemplo completo: Diagnosticar "telegram"

```bash
# 1. Verificar que Puppeteer funciona
npm run diagnose
# ✓ ALL TESTS PASSED!

# 2. Verificar si "telegram" es el nombre correcto
npm run diagnose:services
# ⚠️  telegram (com) - EXISTS but NO DATA

# 3. Capturar el HTML para inspeccionar
npm run diagnose:html telegram com
# 📄 HTML saved to diagnostics/output/...

# 4. Abrir la página manualmente en el navegador
# https://downdetector.com/status/telegram/

# 5. Descubrir que el nombre correcto es "telegram-messenger"

# 6. Actualizar services.config.json
# Cambiar "telegram" por "telegram-messenger"

# 7. Probar de nuevo
npm run dev
```

---

## Checklist de diagnóstico

- [ ] Ejecutar `npm run diagnose` (verificar Puppeteer)
- [ ] Ejecutar `npm run diagnose:services` (verificar servicios)
- [ ] Revisar el reporte en `diagnostics/output/`
- [ ] Verificar nombres de servicios en https://downdetector.com
- [ ] Actualizar `services.config.json` con nombres correctos
- [ ] Probar con diferentes dominios si es necesario
- [ ] Ejecutar `npm run dev` para verificar

---

## Resultado esperado

Después de corregir los nombres:

```bash
npm run dev

# [DownDetector] Fetching data for telegram-messenger from downdetector.com...
# [DownDetector] Response received for telegram-messenger: {
#   "reports": [
#     { "date": "2026-01-05T14:00:00", "value": 45 },
#     { "date": "2026-01-05T14:15:00", "value": 67 },
#     ...
#   ],
#   "baseline": [...]
# }
# [DownDetector] ✓ Fetched 96 reports and 96 baseline entries
```

---

## Soporte adicional

Si después de seguir todos los pasos aún tienes problemas:

1. Revisa los archivos guardados en `diagnostics/output/`
2. Compara el HTML capturado con lo que muestra la librería
3. Verifica la versión de `downdetector-api`
4. Considera usar una API oficial si está disponible

**Nota:** DownDetector **no tiene API oficial pública**. Esta librería hace web scraping, por lo que puede romperse cuando cambien su sitio web.
