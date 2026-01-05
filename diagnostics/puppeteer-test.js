/**
 * Puppeteer Diagnostic Script
 *
 * Run this script on the server to diagnose Puppeteer issues:
 * node diagnostics/puppeteer-test.js
 */

const puppeteer = require('puppeteer');
const os = require('os');

console.log('='.repeat(60));
console.log('PUPPETEER DIAGNOSTIC TEST');
console.log('='.repeat(60));

// System info
console.log('\n📋 SYSTEM INFORMATION:');
console.log(`  Platform: ${process.platform}`);
console.log(`  Architecture: ${process.arch}`);
console.log(`  Node version: ${process.version}`);
console.log(`  OS: ${os.type()} ${os.release()}`);
console.log(`  Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`);
console.log(`  User: ${os.userInfo().username}`);

// Test 1: Check if Puppeteer is installed
console.log('\n🔍 TEST 1: Checking Puppeteer installation...');
try {
  console.log(`  ✓ Puppeteer version: ${puppeteer.version || 'unknown'}`);
} catch (error) {
  console.error(`  ✗ Error: ${error.message}`);
  process.exit(1);
}

// Test 2: Try to launch browser with default settings
console.log('\n🔍 TEST 2: Launching browser with default settings...');
(async () => {
  try {
    const browser = await puppeteer.launch();
    console.log('  ✓ Browser launched successfully with default settings');
    await browser.close();
    console.log('  ✓ Browser closed successfully');
  } catch (error) {
    console.error(`  ✗ Failed with default settings:`);
    console.error(`     Error: ${error.message}`);
    console.error(`     Type: ${error.constructor.name}`);

    // Test 3: Try with headless and no-sandbox
    console.log('\n🔍 TEST 3: Trying with server-friendly options...');
    try {
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
      console.log('  ✓ Browser launched with server-friendly options!');
      await browser.close();
      console.log('  ✓ Browser closed successfully');

      console.log('\n💡 SOLUTION: Add these options to puppeteer.launch()');
      console.log('   See diagnostics/PUPPETEER_FIX.md for implementation');
    } catch (error2) {
      console.error(`  ✗ Still failing with server options:`);
      console.error(`     Error: ${error2.message}`);
      console.error(`     Type: ${error2.constructor.name}`);

      // Check for common errors
      console.log('\n🔍 ANALYZING ERROR...');

      if (error2.message.includes('Could not find Chrome') ||
          error2.message.includes('Could not find browser')) {
        console.log('\n❌ PROBLEM: Chrome/Chromium not found');
        console.log('   SOLUTIONS:');
        console.log('   1. Install Chrome: apt-get install -y chromium-browser (Linux)');
        console.log('   2. Or install dependencies: npx puppeteer browsers install chrome');
        console.log('   3. Or specify executablePath in puppeteer.launch()');
      } else if (error2.message.includes('No usable sandbox')) {
        console.log('\n❌ PROBLEM: Sandbox issues');
        console.log('   SOLUTION: Use --no-sandbox flag (already tested, may need system config)');
      } else if (error2.message.includes('Failed to launch') ||
                 error2.message.includes('Could not find expected browser')) {
        console.log('\n❌ PROBLEM: Missing system dependencies');
        console.log('   SOLUTION (Linux):');
        console.log('   apt-get install -y \\');
        console.log('     libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \\');
        console.log('     libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \\');
        console.log('     libxfixes3 libxrandr2 libgbm1 libasound2');
      }

      console.log('\n📖 See diagnostics/TROUBLESHOOTING.md for detailed solutions');
    }
  }

  // Test 4: Test DownDetector scraping
  console.log('\n🔍 TEST 4: Testing DownDetector scraping...');
  try {
    const { downdetector } = require('downdetector-api');
    console.log('  Testing with service: whatsapp, domain: com');

    const result = await downdetector('whatsapp', 'com');

    if (result && result.reports) {
      console.log(`  ✓ Successfully fetched ${result.reports.length} reports`);
      console.log(`  ✓ Successfully fetched ${result.baseline?.length || 0} baseline entries`);
      console.log('\n✅ ALL TESTS PASSED!');
    } else {
      console.error('  ✗ Response is empty or invalid');
      console.error(`  Response:`, JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(`  ✗ DownDetector test failed:`);
    console.error(`     Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));
})();
