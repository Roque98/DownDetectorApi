/**
 * Service Verification Script
 *
 * Verifies which ENABLED services from services.config.json are valid on DownDetector
 * Only checks services with "enabled": true
 *
 * Usage: node diagnostics/verify-services.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Load services configuration
const configPath = path.join(__dirname, '..', 'services.config.json');
let services = [];

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const allServices = config.services || [];

  // Filter only enabled services
  services = allServices.filter(s => s.enabled === true);

  const disabledCount = allServices.length - services.length;

  console.log('='.repeat(60));
  console.log('DOWNDETECTOR SERVICE VERIFICATION');
  console.log('='.repeat(60));
  console.log(`\nTotal services in config: ${allServices.length}`);
  console.log(`Enabled services: ${services.length}`);
  console.log(`Disabled services: ${disabledCount} (skipped)\n`);

  if (services.length === 0) {
    console.log('❌ No enabled services found in configuration!');
    console.log('💡 Enable services in services.config.json by setting "enabled": true\n');
    process.exit(0);
  }
} catch (error) {
  console.error('❌ Could not load services.config.json:', error.message);
  process.exit(1);
}

async function checkService(browser, service, domain) {
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const url = `https://downdetector.${domain}/status/${service}/`;

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const status = response.status();
    const content = await page.content();
    const title = await page.title();

    // Check for chart data
    const hasChartData = /\{ x: '/g.test(content);
    const chartDataCount = (content.match(/\{ x: '/g) || []).length;

    // Check if page exists
    const is404 = status === 404 ||
                  title.toLowerCase().includes('not found') ||
                  title.toLowerCase().includes('404');

    // Check for "no problems" message
    const noProblems = content.toLowerCase().includes('no problems at') ||
                      content.toLowerCase().includes('no issues detected');

    return {
      service,
      domain,
      url,
      status,
      exists: !is404,
      hasChartData,
      chartDataCount,
      noProblems,
      title: title.substring(0, 50)
    };

  } catch (error) {
    return {
      service,
      domain,
      url: `https://downdetector.${domain}/status/${service}/`,
      status: 'ERROR',
      exists: false,
      hasChartData: false,
      chartDataCount: 0,
      noProblems: false,
      error: error.message
    };
  } finally {
    await page.close();
  }
}

(async () => {
  let browser;

  try {
    console.log('🔍 Launching browser...\n');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const results = [];

    for (const serviceConfig of services) {
      const serviceName = serviceConfig.name;
      const domain = serviceConfig.domain || 'com';

      process.stdout.write(`Checking ${serviceName}.${domain}... `);

      const result = await checkService(browser, serviceName, domain);
      results.push(result);

      if (result.exists) {
        if (result.hasChartData) {
          console.log(`✓ OK (${result.chartDataCount} data points)`);
        } else {
          // Check if it's Cloudflare blocking
          if (result.status === 403 ||
              (result.title && (result.title.includes('Just a moment') || result.title.includes('Checking your browser')))) {
            console.log(`🚨 CLOUDFLARE BLOCKED (403)`);
          } else {
            console.log(`⚠️  EXISTS but NO DATA`);
          }
        }
      } else {
        console.log(`❌ NOT FOUND`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(60));

    console.log('\n📊 SUMMARY:\n');
    const valid = results.filter(r => r.exists && r.hasChartData);
    const existsNoData = results.filter(r => r.exists && !r.hasChartData);
    const notFound = results.filter(r => !r.exists);

    console.log(`   ✓ Valid (with data):     ${valid.length}`);
    console.log(`   ⚠️  Exists (no data):     ${existsNoData.length}`);
    console.log(`   ❌ Not found:            ${notFound.length}`);

    // Check for Cloudflare blocking
    const cloudflareBlocked = results.filter(r =>
      r.status === 403 ||
      (r.title && (r.title.includes('Just a moment') || r.title.includes('Checking your browser')))
    );

    if (cloudflareBlocked.length > 0) {
      console.log('\n🚨 CLOUDFLARE BLOCKING DETECTED:\n');
      cloudflareBlocked.forEach(r => {
        console.log(`   - ${r.service} (${r.domain})`);
        console.log(`     HTTP Status: ${r.status}`);
        console.log(`     Title: "${r.title}"`);
        console.log(`     ⚠️  DownDetector is blocking your requests with Cloudflare`);
        console.log(`     💡 Read: diagnostics/CLOUDFLARE_FIX.md for solutions`);
        console.log('');
      });
    }

    const existsNoDataNonCloudflare = existsNoData.filter(r =>
      r.status !== 403 &&
      (!r.title || (!r.title.includes('Just a moment') && !r.title.includes('Checking your browser')))
    );

    if (existsNoDataNonCloudflare.length > 0) {
      console.log('\n⚠️  SERVICES WITH NO DATA:\n');
      existsNoDataNonCloudflare.forEach(r => {
        console.log(`   - ${r.service} (${r.domain})`);
        console.log(`     URL: ${r.url}`);
        if (r.noProblems) {
          console.log(`     Reason: Service is currently working fine (no problems reported)`);
        } else {
          console.log(`     Reason: Unknown - check HTML manually`);
        }
        console.log('');
      });
    }

    if (notFound.length > 0) {
      console.log('\n❌ SERVICES NOT FOUND:\n');
      notFound.forEach(r => {
        console.log(`   - ${r.service} (${r.domain})`);
        console.log(`     URL: ${r.url}`);
        if (r.error) {
          console.log(`     Error: ${r.error}`);
        } else {
          console.log(`     HTTP Status: ${r.status}`);
        }
        console.log('     💡 Check the service name on DownDetector website');
        console.log('');
      });
    }

    if (valid.length > 0) {
      console.log('\n✓ VALID SERVICES:\n');
      valid.forEach(r => {
        console.log(`   - ${r.service} (${r.domain}) - ${r.chartDataCount} data points`);
      });
    }

    // Save results
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const resultFile = path.join(outputDir, `service-verification-${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(results, null, 2), 'utf8');

    console.log('\n📄 Results saved to:', resultFile);

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
