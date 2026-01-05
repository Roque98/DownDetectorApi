# Solución rápida para Puppeteer en servidores

Si el script de diagnóstico (`puppeteer-test.js`) determinó que necesitas opciones específicas para servidores, sigue estos pasos:

## Opción 1: Modificar downdetector-api localmente (Rápido)

Edita directamente el archivo de la librería instalada:

**Archivo:** `node_modules/downdetector-api/index.js`

Encuentra la línea 11:
```javascript
const browser = await puppeteer.launch();
```

Reemplázala con:
```javascript
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process'
  ]
});
```

**⚠️ Nota:** Esta modificación se perderá si ejecutas `npm install`. Considera usar patch-package o la Opción 2.

---

## Opción 2: Usar patch-package (Recomendado)

Mantén las modificaciones de forma permanente:

### 1. Instalar patch-package

```bash
npm install --save-dev patch-package
```

### 2. Modificar el archivo

Edita `node_modules/downdetector-api/index.js` como se indicó en la Opción 1.

### 3. Crear el patch

```bash
npx patch-package downdetector-api
```

### 4. Actualizar package.json

Agrega a la sección `scripts`:

```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

Ahora cada vez que ejecutes `npm install`, se aplicará automáticamente el patch.

---

## Opción 3: Crear servicio personalizado (Más control)

Si necesitas más control, usa el servicio personalizado que se encuentra en la documentación de troubleshooting.

Crea el archivo `src/services/downdetector-custom.service.ts` (código completo en `TROUBLESHOOTING.md`).

Luego actualiza `src/services/downdetector.service.ts`:

```typescript
import { CustomDownDetectorService } from './downdetector-custom.service';

export class DowndetectorService {
  private customService = new CustomDownDetectorService();

  async fetchServiceStatus(
    serviceName: string,
    domain: string = 'com'
  ): Promise<DowndetectorResponse> {
    try {
      console.log(`[DownDetector] Fetching data for ${serviceName}...`);

      // Usar el servicio personalizado en lugar de la librería
      const response = await this.customService.fetchData(serviceName, domain);

      if (!response || !response.reports) {
        throw new Error(`Invalid response from Downdetector for ${serviceName}`);
      }

      return response as DowndetectorResponse;
    } catch (error) {
      console.error(`[DownDetector] ❌ Error:`, error);
      throw error;
    }
  }
}
```

---

## Verificar que funciona

Después de aplicar cualquier solución:

```bash
# Verificar con el script de diagnóstico
node diagnostics/puppeteer-test.js

# O ejecutar la aplicación
npm run dev
```

---

## Resumen de comandos

```bash
# 1. Diagnosticar el problema
node diagnostics/puppeteer-test.js

# 2. (Si es necesario) Instalar dependencias del sistema
sudo apt-get install -y chromium-browser

# 3. Aplicar una de las opciones anteriores

# 4. Verificar que funciona
npm run dev
```
