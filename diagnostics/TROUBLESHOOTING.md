# DownDetector API - Guía de Diagnóstico y Soluciones

## Problema: Respuesta vacía en el servidor

La API de DownDetector usa **Puppeteer** (navegador Chrome headless) para hacer scraping. Si funciona en tu equipo local pero no en el servidor, el problema es probablemente uno de estos:

---

## 📋 Paso 1: Ejecutar Diagnóstico

En el servidor, ejecuta el script de diagnóstico:

```bash
node diagnostics/puppeteer-test.js
```

Este script te dirá exactamente qué está fallando.

---

## 🔧 Soluciones Comunes

### Solución 1: Instalar dependencias del sistema (Linux/Ubuntu)

Puppeteer necesita varias librerías del sistema para ejecutar Chrome:

```bash
# Actualizar repositorios
sudo apt-get update

# Instalar Chrome o Chromium
sudo apt-get install -y chromium-browser

# O instalar dependencias manualmente
sudo apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libxrandr2 \
  libpango-1.0-0 \
  libcairo2 \
  libatspi2.0-0 \
  libgtk-3-0
```

**Para CentOS/RHEL:**

```bash
sudo yum install -y \
  nss \
  atk \
  cups-libs \
  libXcomposite \
  libXcursor \
  libXdamage \
  libXext \
  libXi \
  libXrandr \
  libXScrnSaver \
  libXtst \
  pango \
  cairo \
  alsa-lib
```

---

### Solución 2: Configurar Puppeteer para servidores

Crea un archivo de configuración personalizado para Puppeteer.

**Archivo:** `src/config/puppeteer.config.ts`

```typescript
export const getPuppeteerConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-web-security'
    ],
    // Si tienes Chrome instalado en una ubicación personalizada
    // executablePath: '/usr/bin/chromium-browser'
  };
};
```

---

### Solución 3: Fork de downdetector-api con configuración personalizada

Ya que `downdetector-api` no expone configuración de Puppeteer, crea tu propia versión:

**Archivo:** `src/services/downdetector-custom.service.ts`

```typescript
import cheerio from 'cheerio';
import puppeteer from 'puppeteer';

export class CustomDownDetectorService {
  private puppeteerConfig = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  };

  private async callDowndetector(company: string, domain: string): Promise<string> {
    const browser = await puppeteer.launch(this.puppeteerConfig);
    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.goto(`https://downdetector.${domain}/status/${company}/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      const content = await page.content();
      return content;
    } finally {
      await browser.close();
    }
  }

  private getScriptContent(data: string): string {
    const $ = cheerio.load(data);
    const scriptElems = $('script[type="text/javascript"]');
    let res = '';
    for (const script of scriptElems) {
      if ((script.children?.[0] as any)?.data?.includes('{ x:')) {
        res = (script.children[0] as any)?.data;
        break;
      }
    }
    return res;
  }

  private getChartPointsString(scriptContent: string): string[] {
    return scriptContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes("{ x: '"));
  }

  private str2obj(chartPoints: string[]): Array<{ date: string; value: number }> {
    return chartPoints
      .map((line) =>
        line
          .replace(/\{ | \},|'/g, '')
          .split('x: ')
          .pop()!
          .split(', y: ')
      )
      .map((tuple) => ({ date: tuple[0], value: +tuple[1] }));
  }

  private getChartPointsObject(chartPoints: string[]): {
    reports: Array<{ date: string; value: number }>;
    baseline: Array<{ date: string; value: number }>;
  } {
    return {
      reports: this.str2obj(chartPoints.slice(0, 96)),
      baseline: this.str2obj(chartPoints.slice(96, 192))
    };
  }

  async fetchData(company: string, domain: string = 'com') {
    try {
      console.log(`[CustomDownDetector] Fetching ${company} from downdetector.${domain}`);

      const data = await this.callDowndetector(company, domain);
      const scriptContent = this.getScriptContent(data);
      const chartPoints = this.getChartPointsString(scriptContent);
      const { reports, baseline } = this.getChartPointsObject(chartPoints);

      console.log(`[CustomDownDetector] ✓ Fetched ${reports.length} reports`);

      return { reports, baseline };
    } catch (error) {
      console.error(`[CustomDownDetector] ❌ Error:`, error);
      throw error;
    }
  }
}
```

Luego actualiza `downdetector.service.ts` para usar esta versión personalizada:

```typescript
import { CustomDownDetectorService } from './downdetector-custom.service';

const customService = new CustomDownDetectorService();
const response = await customService.fetchData(serviceName, domain);
```

---

### Solución 4: Variables de entorno

Agrega estas variables a tu `.env` en el servidor:

```bash
# Puppeteer configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Or for custom Chrome location
# PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

---

### Solución 5: Docker (si usas contenedores)

Si ejecutas la app en Docker, usa una imagen con Chrome preinstalado:

```dockerfile
FROM node:18

# Instalar dependencias de Chrome
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar Puppeteer para usar Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

CMD ["npm", "start"]
```

---

## 🔍 Verificar que funciona

Después de aplicar la solución, ejecuta:

```bash
# 1. Verificar que Puppeteer funciona
node diagnostics/puppeteer-test.js

# 2. Probar la aplicación
npm run dev
```

---

## 📊 Logs mejorados

El servicio ahora incluye logs detallados. Cuando ejecutes la app, verás:

```
[DownDetector] Fetching data for whatsapp from downdetector.com...
[DownDetector] Node version: v18.17.0
[DownDetector] Platform: linux x64
[DownDetector] Response received for whatsapp: {...}
[DownDetector] ✓ Fetched 96 reports and 96 baseline entries for whatsapp
```

Si falla, verás:

```
[DownDetector] ❌ Error fetching data for whatsapp:
[DownDetector] Error type: Error
[DownDetector] Error message: Could not find Chrome
[DownDetector] Stack trace: ...
```

---

## 🆘 Problemas persistentes

Si ninguna solución funciona:

1. **Verifica permisos:** El usuario que ejecuta Node.js debe tener permisos para ejecutar Chrome
2. **Firewall:** Asegúrate de que el servidor pueda hacer peticiones HTTPS salientes
3. **Memoria:** Puppeteer necesita al menos 512MB de RAM disponible
4. **Alternativa:** Considera usar un servicio proxy/scraping como ScraperAPI o Bright Data

---

## 📝 Información adicional

- **Versión actual de downdetector-api:** 2.1.0
- **Puppeteer se incluye como dependencia** de downdetector-api
- **El problema NO es de bloqueo por IP**, es de configuración de Puppeteer

---

## ✅ Checklist de diagnóstico

- [ ] Ejecutar `node diagnostics/puppeteer-test.js`
- [ ] Verificar que Chrome/Chromium está instalado: `which chromium-browser`
- [ ] Instalar dependencias del sistema
- [ ] Verificar versión de Node.js: `node -v` (recomendado: 16+)
- [ ] Revisar logs detallados de la aplicación
- [ ] Probar con configuración personalizada de Puppeteer
- [ ] Verificar permisos del usuario
- [ ] Verificar conexión a internet del servidor
