# Solución: HTTP 403 - Cloudflare bloqueando peticiones

## Problema identificado

Si ves en los logs:
```json
{
  "status": 403,
  "title": "Just a moment...",
  "hasChartData": false
}
```

**DownDetector usa Cloudflare** para bloquear bots. Tu servidor está siendo bloqueado.

---

## ¿Por qué funciona local pero no en el servidor?

| Aspecto | Tu PC | Servidor | Cloudflare |
|---------|-------|----------|------------|
| IP | Residencial | Datacenter | ⚠️ Sospechoso |
| Navegador | Real con historial | Headless limpio | ⚠️ Sospechoso |
| Comportamiento | Humano | Bot-like | ⚠️ Bloqueado |

---

## Solución 1: puppeteer-extra con stealth plugin (Recomendado)

Hace que Puppeteer sea indetectable para Cloudflare.

### Instalación

```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth
```

### Implementación

Crea un nuevo archivo: `src/services/downdetector-stealth.service.ts`

```typescript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { DowndetectorResponse } from '../types';

// Add stealth plugin
puppeteer.use(StealthPlugin());

export class DowndetectorStealthService {
  private async scrapeDowndetector(
    serviceName: string,
    domain: string = 'com'
  ): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    try {
      const page = await browser.newPage();

      // Set realistic viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to page
      const url = `https://downdetector.${domain}/status/${serviceName}/`;
      console.log(`[Stealth] Navigating to ${url}...`);

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Wait a bit to mimic human behavior
      await page.waitForTimeout(2000);

      // Get page content
      const content = await page.content();

      return content;
    } finally {
      await browser.close();
    }
  }

  private parseChartData(html: string): DowndetectorResponse {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    // Find script with chart data
    const scriptElems = $('script[type="text/javascript"]');
    let scriptContent = '';

    for (const script of scriptElems) {
      const data = (script.children?.[0] as any)?.data;
      if (data && data.includes('{ x:')) {
        scriptContent = data;
        break;
      }
    }

    if (!scriptContent) {
      return { reports: [], baseline: [] };
    }

    // Parse chart points
    const chartPoints = scriptContent
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.includes("{ x: '"));

    const str2obj = (points: string[]) => {
      return points
        .map((line) =>
          line
            .replace(/\{ | \},|'/g, '')
            .split('x: ')
            .pop()!
            .split(', y: ')
        )
        .map((tuple) => ({ date: tuple[0], value: +tuple[1] }));
    };

    return {
      reports: str2obj(chartPoints.slice(0, 96)),
      baseline: str2obj(chartPoints.slice(96, 192))
    };
  }

  async fetchServiceStatus(
    serviceName: string,
    domain: string = 'com'
  ): Promise<DowndetectorResponse> {
    try {
      console.log(`[Stealth] Fetching ${serviceName} from downdetector.${domain}...`);

      const html = await this.scrapeDowndetector(serviceName, domain);

      // Check if Cloudflare blocked us
      if (html.includes('Just a moment') || html.includes('Checking your browser')) {
        throw new Error('Cloudflare challenge detected - stealth plugin may need update');
      }

      const data = this.parseChartData(html);

      console.log(
        `[Stealth] ✓ Fetched ${data.reports.length} reports and ${data.baseline?.length || 0} baseline entries`
      );

      return data;
    } catch (error) {
      console.error(`[Stealth] ❌ Error:`, error);
      throw error;
    }
  }
}
```

### Actualizar el servicio principal

Edita `src/services/downdetector.service.ts`:

```typescript
import { DowndetectorStealthService } from './downdetector-stealth.service';

export class DowndetectorService {
  private stealthService = new DowndetectorStealthService();

  async fetchServiceStatus(
    serviceName: string,
    domain: string = 'com'
  ): Promise<DowndetectorResponse> {
    // Use stealth service instead
    return this.stealthService.fetchServiceStatus(serviceName, domain);
  }
}
```

### Actualizar package.json

```json
{
  "dependencies": {
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "cheerio": "^1.0.0-rc.12"
  }
}
```

---

## Solución 2: Agregar delays y comportamiento humano

Si no quieres instalar nuevas dependencias, mejora el comportamiento del navegador:

```javascript
// En node_modules/downdetector-api/index.js (con patch-package)
async function callDowndetector(company, domain) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();

  // Remove automation indicators
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto(`https://downdetector.${domain}/status/${company}/`, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Wait for Cloudflare to finish (if present)
  await page.waitForTimeout(5000);

  const content = await page.content();
  await browser.close();
  return content;
}
```

---

## Solución 3: Usar un proxy residencial

Si Cloudflare sigue bloqueando, usa un proxy con IP residencial:

```typescript
const browser = await puppeteer.launch({
  args: [
    '--proxy-server=http://proxy-server:port',
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ]
});

// Authenticate proxy if needed
await page.authenticate({
  username: 'your-proxy-username',
  password: 'your-proxy-password'
});
```

**Servicios de proxy recomendados:**
- BrightData (Luminati)
- Smartproxy
- Oxylabs

---

## Solución 4: Usar API alternativa (si existe)

Considera si existe una API oficial o alternativa que no use scraping.

---

## Verificar que funciona

Después de aplicar la solución:

```bash
npm run diagnose:services
```

**Resultado esperado:**
```
Checking telegram.com... ✓ OK (192 data points)
```

En lugar de:
```
Checking telegram.com... ⚠️  EXISTS but NO DATA (403)
```

---

## Resumen

| Solución | Dificultad | Efectividad | Costo |
|----------|-----------|-------------|-------|
| puppeteer-extra + stealth | Media | ⭐⭐⭐⭐⭐ | Gratis |
| Delays + comportamiento | Baja | ⭐⭐⭐ | Gratis |
| Proxy residencial | Media | ⭐⭐⭐⭐⭐ | $$ |

**Recomendación:** Empieza con **Solución 1** (puppeteer-extra + stealth). Es gratis y muy efectiva.

---

## Notas importantes

- Cloudflare se actualiza constantemente. Las soluciones pueden dejar de funcionar.
- El stealth plugin se actualiza regularmente para evadir nuevas detecciones.
- Respeta los términos de servicio de DownDetector.
- El scraping intensivo puede resultar en bloqueos permanentes de IP.
