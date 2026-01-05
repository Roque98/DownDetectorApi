import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { DowndetectorResponse } from '../types';
import { AlertService } from './alert.service';

// Add stealth plugin to make Puppeteer undetectable
puppeteer.use(StealthPlugin());

export class DowndetectorStealthService {
  private alertService: AlertService;

  constructor() {
    this.alertService = new AlertService();
  }
  /**
   * Scrape DownDetector using stealth mode to bypass Cloudflare
   */
  private async scrapeDowndetector(
    serviceName: string,
    domain: string = 'com'
  ): Promise<string> {
    console.log(`[Stealth] Launching browser with advanced stealth mode...`);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920,1080',
        '--start-maximized',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list'
      ],
      ignoreHTTPSErrors: true
    });

    try {
      const page = await browser.newPage();

      // Set realistic viewport
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
      });

      // Set multiple headers to look more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Upgrade-Insecure-Requests': '1'
      });

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      // Override WebDriver detection
      await page.evaluateOnNewDocument(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Chrome runtime
        // @ts-ignore - window is available in browser context
        window.chrome = {
          runtime: {},
        };

        // Permissions
        // @ts-ignore - window and Notification are available in browser context
        const originalQuery = window.navigator.permissions.query;
        // @ts-ignore
        window.navigator.permissions.query = (parameters: any) =>
          parameters.name === 'notifications'
            // @ts-ignore
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      // Navigate to page
      const url = `https://downdetector.${domain}/status/${serviceName}/`;
      console.log(`[Stealth] Navigating to ${url}...`);

      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      const statusCode = response?.status() || 0;
      console.log(`[Stealth] HTTP Status: ${statusCode}`);

      // Check for Cloudflare blocking (HTTP 403)
      if (statusCode === 403) {
        console.error(`[Stealth] HTTP 403 detected - Cloudflare blocking`);
        await this.alertService.sendCloudflareBlockAlert(serviceName, statusCode);
      }

      // Wait for Cloudflare challenge to complete (if present)
      console.log(`[Stealth] Waiting for page to fully load...`);
      await page.waitForTimeout(8000);

      // Try to wait for specific elements that indicate the page loaded
      try {
        await page.waitForSelector('body', { timeout: 5000 });
      } catch (e) {
        console.log(`[Stealth] Body selector not found, continuing anyway...`);
      }

      // Get page content
      const content = await page.content();

      // Get page title to check if we got blocked
      const title = await page.title();
      console.log(`[Stealth] Page title: "${title}"`);

      // Check final URL in case of redirects
      const finalUrl = page.url();
      if (finalUrl !== url) {
        console.log(`[Stealth] Page redirected to: ${finalUrl}`);
      }

      return content;
    } finally {
      await browser.close();
      console.log(`[Stealth] Browser closed`);
    }
  }

  /**
   * Parse chart data from DownDetector HTML
   */
  private parseChartData(html: string): DowndetectorResponse {
    const $ = cheerio.load(html);

    // Find script with chart data
    const scriptElems = $('script[type="text/javascript"]');
    let scriptContent = '';

    for (const script of scriptElems.toArray()) {
      const data = (script.children?.[0] as any)?.data;
      if (data && data.includes('{ x:')) {
        scriptContent = data;
        break;
      }
    }

    if (!scriptContent) {
      console.log(`[Stealth] No chart data found in HTML`);
      return { reports: [], baseline: [] };
    }

    console.log(`[Stealth] Found script with chart data`);

    // Parse chart points
    const chartPoints = scriptContent
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.includes("{ x: '"));

    console.log(`[Stealth] Found ${chartPoints.length} chart data points`);

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

  /**
   * Fetch service status using stealth mode
   */
  async fetchServiceStatus(
    serviceName: string,
    domain: string = 'com'
  ): Promise<DowndetectorResponse> {
    try {
      console.log(`[Stealth] Fetching ${serviceName} from downdetector.${domain}...`);

      const html = await this.scrapeDowndetector(serviceName, domain);

      // Check if Cloudflare blocked us
      if (html.includes('Just a moment') || html.includes('Checking your browser')) {
        console.error(`[Stealth] ❌ Cloudflare challenge detected - stealth plugin may need update`);
        const url = `https://downdetector.${domain}/status/${serviceName}/`;
        await this.alertService.sendServiceFailureAlert(
          serviceName,
          url,
          'Cloudflare challenge page detected despite stealth mode - plugin may need update'
        );
        throw new Error('Cloudflare challenge detected despite stealth mode');
      }

      const data = this.parseChartData(html);

      if (data.reports.length === 0 && data.baseline.length === 0) {
        console.warn(`[Stealth] ⚠️  Received empty data for ${serviceName}`);
      } else {
        console.log(
          `[Stealth] ✓ Successfully fetched ${data.reports.length} reports and ${data.baseline?.length || 0} baseline entries`
        );
      }

      return data;
    } catch (error) {
      console.error(`[Stealth] ❌ Error fetching data:`, error);
      throw error;
    }
  }

  /**
   * Fetch status data for multiple services
   */
  async fetchMultipleServices(
    services: Array<{ name: string; domain: string }>
  ): Promise<Array<{ serviceName: string; data: DowndetectorResponse | null; error: string | null }>> {
    const results = await Promise.allSettled(
      services.map(async (service) => {
        const data = await this.fetchServiceStatus(service.name, service.domain);
        return {
          serviceName: service.name,
          data,
          error: null,
        };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          serviceName: services[index].name,
          data: null,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        };
      }
    });
  }
}
