/**
 * HTML Capture Script
 *
 * Captures the actual HTML from DownDetector to diagnose why data is empty
 * Usage: node diagnostics/capture-html.js [service] [domain]
 * Example: node diagnostics/capture-html.js telegram com
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const service = process.argv[2] || 'telegram';
const domain = process.argv[3] || 'com';

console.log('='.repeat(60));
console.log('DOWNDETECTOR HTML CAPTURE');
console.log('='.repeat(60));
console.log(`\nService: ${service}`);
console.log(`Domain: downdetector.${domain}`);
console.log(`URL: https://downdetector.${domain}/status/${service}/\n`);

(async () => {
  let browser;
  try {
    console.log('🔍 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();

    // Set user agent (same as downdetector-api uses)
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
    );

    console.log('🌐 Navigating to DownDetector...');
    const url = `https://downdetector.${domain}/status/${service}/`;

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log(`✓ HTTP Status: ${response.status()}`);
    console.log(`✓ Page loaded successfully\n`);

    // Get page content
    const content = await page.content();

    // Save HTML to file
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `downdetector-${service}-${domain}-${Date.now()}.html`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, content, 'utf8');

    console.log('📄 HTML SAVED:');
    console.log(`   File: ${filepath}`);
    console.log(`   Size: ${(content.length / 1024).toFixed(2)} KB\n`);

    // Analyze content
    console.log('🔍 ANALYZING CONTENT:\n');

    // Check for script tags with chart data
    const scriptMatches = content.match(/<script[^>]*type="text\/javascript"[^>]*>[\s\S]*?<\/script>/gi);
    console.log(`   Script tags found: ${scriptMatches ? scriptMatches.length : 0}`);

    // Check for the specific pattern that downdetector-api looks for
    const chartDataPattern = /\{ x: '/g;
    const chartDataMatches = content.match(chartDataPattern);
    console.log(`   Chart data patterns ({ x: ') found: ${chartDataMatches ? chartDataMatches.length : 0}`);

    if (chartDataMatches && chartDataMatches.length > 0) {
      console.log('   ✓ Chart data appears to be present');

      // Extract a sample of chart data
      const sampleMatch = content.match(/\{ x: '[\s\S]{0,200}/);
      if (sampleMatch) {
        console.log('\n   Sample chart data:');
        console.log(`   ${sampleMatch[0].substring(0, 150)}...`);
      }
    } else {
      console.log('   ❌ NO chart data found!');
      console.log('\n   This explains why the API returns empty arrays.');
    }

    // Check for common DownDetector elements
    console.log('\n🔍 CHECKING PAGE ELEMENTS:\n');

    const title = await page.title();
    console.log(`   Page title: "${title}"`);

    // Check if page exists (not 404)
    if (title.toLowerCase().includes('not found') ||
        title.toLowerCase().includes('404') ||
        content.includes('Page not found')) {
      console.log('   ❌ This service may not exist on DownDetector!');
    }

    // Check for status information
    const hasStatus = content.includes('status') || content.includes('problems');
    console.log(`   Status info present: ${hasStatus ? '✓ Yes' : '❌ No'}`);

    // Check for "No problems detected" message
    const noProblems = content.toLowerCase().includes('no problems') ||
                      content.toLowerCase().includes('no issues') ||
                      content.toLowerCase().includes('everything is working');
    console.log(`   "No problems" message: ${noProblems ? '✓ Yes' : '❌ No'}`);

    // Try to find the service name variations
    console.log('\n💡 SUGGESTIONS:\n');

    if (!chartDataMatches || chartDataMatches.length === 0) {
      console.log('   The page loaded but contains no chart data. This could mean:');
      console.log('   1. DownDetector changed their HTML structure');
      console.log('   2. The service name is incorrect');
      console.log('   3. This domain doesn\'t have data for this service');
      console.log('\n   Try these alternatives:');
      console.log(`   - Different domain: node diagnostics/capture-html.js ${service} es`);
      console.log(`   - Check DownDetector website for correct service name`);
      console.log(`   - Inspect the saved HTML file: ${filepath}`);
    }

    if (noProblems && chartDataMatches && chartDataMatches.length === 0) {
      console.log('   The service exists but has no recent problems.');
      console.log('   This might cause empty data in the chart.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ CAPTURE COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
