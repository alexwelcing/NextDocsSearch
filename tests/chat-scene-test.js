const { chromium } = require('playwright');

(async () => {
  console.log('Starting Chat Scene Test...');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--use-gl=egl'] // Try EGL or swiftshader
  });
  const page = await browser.newPage();
  
  // Capture console logs and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`PAGE ERROR: ${msg.text()}`);
    } else {
      console.log(`PAGE LOG: ${msg.text()}`);
    }
  });

  page.on('pageerror', exception => {
    console.error(`UNCAUGHT EXCEPTION: "${exception}"`);
    process.exit(1); // Fail immediately on uncaught exceptions
  });

  try {
    const url = 'http://localhost:3000/chat';
    console.log(`Navigating to ${url}...`);
    
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    
    await page.goto(url, { waitUntil: 'networkidle' });
    
    console.log('Page loaded. Checking for critical elements...');

    // Warning: We need to see if the canvas is present
    const canvas = await page.$('canvas');
    if (canvas) {
        console.log('✅ Canvas element found.');
    } else {
        console.error('❌ Canvas element NOT found.');
        process.exit(1);
    }

    // Wait a bit to ensure 3D scene init doesn't crash later
    console.log('Waiting for 5 seconds to check for runtime errors...');
    await page.waitForTimeout(5000);

    console.log('✅ detailed check passed. No runtime errors detected.');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
