#!/usr/bin/env node

/**
 * Visual Testing System - Standalone Runner
 *
 * Simple Node.js script to run visual tests without TypeScript compilation.
 * Captures screenshots of all major pages for visual comparison.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = './test-screenshots';

// Test scenarios
const scenarios = [
  {
    name: 'landing-page',
    description: 'Main landing page with 3D background',
    url: '/',
    waitFor: 3000
  },
  {
    name: 'landing-terminal-open',
    description: 'Landing page with terminal open',
    url: '/',
    waitFor: 1000,
    actions: async (page) => {
      try {
        await page.click('text="NAVIGATE"', { timeout: 5000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log('     Note: Could not open terminal');
      }
    }
  },
  {
    name: 'landing-3d-experience',
    description: 'Landing page with 3D experience button',
    url: '/',
    waitFor: 2000,
    actions: async (page) => {
      try {
        await page.click('text="3D EXPERIENCE"', { timeout: 5000 });
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log('     Note: 3D Experience button not found');
      }
    }
  },
  {
    name: 'articles-page',
    description: 'Article discovery page',
    url: '/articles',
    waitFor: 2000
  },
  {
    name: 'terminal-explore',
    description: 'Terminal explore tab',
    url: '/',
    actions: async (page) => {
      try {
        await page.click('text="NAVIGATE"', { timeout: 5000 });
        await page.waitForTimeout(500);
        await page.click('text="EXPLORE"', { timeout: 5000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log('     Note: Could not navigate to explore tab');
      }
    }
  },
  {
    name: 'terminal-game',
    description: 'Terminal game tab',
    url: '/',
    actions: async (page) => {
      try {
        await page.click('text="NAVIGATE"', { timeout: 5000 });
        await page.waitForTimeout(500);
        await page.click('text="GAME"', { timeout: 5000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log('     Note: Could not navigate to game tab');
      }
    }
  }
];

// Viewport configurations
const viewports = [
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 375, height: 812, name: 'mobile' }
];

const results = [];

async function runTests() {
  console.log('🚀 Starting Visual Testing System\n');
  console.log(`📡 Testing URL: ${BASE_URL}\n`);

  // Create screenshot directory with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const outputDir = path.join(SCREENSHOT_DIR, timestamp, new Date().getTime().toString());

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`📁 Screenshots: ${outputDir}\n`);

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage']
  });

  try {
    for (const scenario of scenarios) {
      console.log(`\n📸 Testing: ${scenario.description}`);

      for (const viewport of viewports) {
        const startTime = Date.now();

        try {
          const context = await browser.newContext({
            viewport,
            deviceScaleFactor: 2
          });

          const page = await context.newPage();

          console.log(`   → ${viewport.name} (${viewport.width}x${viewport.height})`);

          // Navigate
          await page.goto(`${BASE_URL}${scenario.url}`, {
            waitUntil: 'networkidle',
            timeout: 30000
          });

          // Initial wait
          await page.waitForTimeout(2000);

          // Run custom actions
          if (scenario.actions) {
            await scenario.actions(page);
          }

          // Additional wait
          if (scenario.waitFor) {
            await page.waitForTimeout(scenario.waitFor);
          }

          // Capture screenshot
          const filename = `${scenario.name}-${viewport.name}.png`;
          const screenshotPath = path.join(outputDir, filename);

          await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            animations: 'disabled'
          });

          const duration = Date.now() - startTime;

          results.push({
            scenario: scenario.description,
            viewport: viewport.name,
            filename,
            duration,
            success: true
          });

          console.log(`   ✓ Captured in ${duration}ms`);

          await context.close();

        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`   ✗ Failed: ${error.message}`);

          results.push({
            scenario: scenario.description,
            viewport: viewport.name,
            filename: '',
            duration,
            success: false,
            error: error.message
          });
        }
      }
    }

    // Generate report
    generateReport(outputDir);

  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${results.length}`);
  console.log(`✓ Successful: ${results.filter(r => r.success).length}`);
  console.log(`✗ Failed: ${results.filter(r => !r.success).length}`);
  console.log(`📁 Output: ${outputDir}`);
  console.log('='.repeat(70) + '\n');
}

function generateReport(outputDir) {
  const reportPath = path.join(outputDir, 'report.html');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Test Report - ${new Date().toLocaleDateString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Monaco', 'Courier New', monospace;
      background: #0a0a0f;
      color: #fff;
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container { max-width: 1600px; margin: 0 auto; }
    h1 {
      font-size: 36px;
      margin-bottom: 10px;
      color: #00d4ff;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .subtitle {
      color: #888;
      font-size: 14px;
      margin-bottom: 40px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 40px 0;
    }
    .stat-card {
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid #333;
      border-radius: 12px;
      padding: 24px;
    }
    .stat-label {
      color: #666;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
    }
    .success { color: #00d4ff; }
    .error { color: #ff6b6b; }
    .warning { color: #ffd700; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 30px;
      margin-top: 40px;
    }

    .result-card {
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid #333;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .result-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(0, 212, 255, 0.1);
      border-color: #00d4ff;
    }

    .result-header {
      padding: 20px;
      border-bottom: 1px solid #333;
    }

    .result-title {
      font-size: 16px;
      margin-bottom: 10px;
      color: #00d4ff;
      font-weight: 600;
    }

    .result-meta {
      font-size: 11px;
      color: #666;
      display: flex;
      gap: 15px;
      text-transform: uppercase;
    }

    .result-meta span {
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
    }

    .result-image-container {
      position: relative;
      background: #000;
      overflow: hidden;
    }

    .result-image {
      width: 100%;
      height: auto;
      display: block;
      cursor: pointer;
    }

    .result-image:hover {
      opacity: 0.9;
    }

    .error-message {
      padding: 20px;
      background: rgba(255, 107, 107, 0.1);
      border-top: 2px solid #ff6b6b;
      color: #ff6b6b;
      font-size: 12px;
      line-height: 1.6;
    }

    .viewport-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #00d4ff;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      border: 1px solid #00d4ff;
    }

    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 1000;
      padding: 40px;
      overflow: auto;
    }

    .modal.active { display: flex; align-items: center; justify-content: center; }

    .modal-content {
      max-width: 95%;
      max-height: 95%;
    }

    .modal img {
      width: 100%;
      height: auto;
      border-radius: 8px;
    }

    .close-modal {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1><span>📸</span> Visual Test Report</h1>
    <p class="subtitle">Generated ${new Date().toLocaleString()} | Base URL: ${BASE_URL}</p>

    <div class="summary">
      <div class="stat-card">
        <div class="stat-label">Total Tests</div>
        <div class="stat-value">${results.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Successful</div>
        <div class="stat-value success">${successCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Failed</div>
        <div class="stat-value error">${failCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Duration</div>
        <div class="stat-value warning">${(totalDuration / 1000).toFixed(2)}s</div>
      </div>
    </div>

    <div class="grid">
      ${results.map((result, idx) => `
        <div class="result-card">
          <div class="result-header">
            <div class="result-title">${result.scenario}</div>
            <div class="result-meta">
              <span>${result.viewport}</span>
              <span>${result.duration}ms</span>
              <span class="${result.success ? 'success' : 'error'}">${result.success ? '✓ SUCCESS' : '✗ FAILED'}</span>
            </div>
          </div>
          ${result.success ? `
            <div class="result-image-container">
              <span class="viewport-badge">${result.viewport}</span>
              <img
                src="${result.filename}"
                alt="${result.scenario} - ${result.viewport}"
                class="result-image"
                onclick="openModal(this.src)"
              />
            </div>
          ` : `
            <div class="error-message">
              <strong>Error:</strong> ${result.error || 'Unknown error occurred'}
            </div>
          `}
        </div>
      `).join('')}
    </div>
  </div>

  <div id="imageModal" class="modal" onclick="closeModal()">
    <button class="close-modal" onclick="closeModal()">Close ✕</button>
    <div class="modal-content">
      <img id="modalImage" src="" alt="Full size preview" />
    </div>
  </div>

  <script>
    function openModal(src) {
      document.getElementById('imageModal').classList.add('active');
      document.getElementById('modalImage').src = src;
      event.stopPropagation();
    }

    function closeModal() {
      document.getElementById('imageModal').classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>
  `;

  fs.writeFileSync(reportPath, html);
  console.log(`\n📊 Report generated: file://${path.resolve(reportPath)}`);
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(BASE_URL);
    return response.ok;
  } catch {
    return false;
  }
}

// Main execution
(async () => {
  try {
    // Check if Playwright is installed
    try {
      require('playwright');
    } catch {
      console.error('\n❌ Playwright is not installed!');
      console.log('\nInstall it with: npm install --save-dev playwright\n');
      process.exit(1);
    }

    // Check if server is running
    const serverRunning = await checkServer();
    if (!serverRunning) {
      console.error(`\n❌ Server is not running at ${BASE_URL}`);
      console.log('\nStart the dev server with: npm run dev\n');
      process.exit(1);
    }

    await runTests();
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
})();
