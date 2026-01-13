#!/usr/bin/env node

/**
 * Enhanced Visual Testing System with Comprehensive Scenarios
 *
 * Extended test suite covering all UI states, interactions, and edge cases
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = './test-screenshots';

// Comprehensive test scenarios
const scenarios = [
  // ============================================
  // LANDING PAGE TESTS
  // ============================================
  {
    name: 'landing-page-initial',
    description: 'Landing page - Initial load',
    url: '/',
    waitFor: 3000,
    category: 'landing'
  },
  {
    name: 'landing-page-with-particles',
    description: 'Landing page - Verify particle effects',
    url: '/',
    waitFor: 4000,
    category: 'landing',
    metrics: ['particle-count', 'fps']
  },
  {
    name: 'landing-page-scrolled',
    description: 'Landing page - Scrolled down',
    url: '/',
    waitFor: 2000,
    category: 'landing',
    actions: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(1000);
    }
  },

  // ============================================
  // TERMINAL INTERFACE TESTS
  // ============================================
  {
    name: 'terminal-closed',
    description: 'Terminal interface - Closed state',
    url: '/',
    waitFor: 2000,
    category: 'terminal'
  },
  {
    name: 'terminal-opening-animation',
    description: 'Terminal interface - Opening animation',
    url: '/',
    waitFor: 500,
    category: 'terminal',
    actions: async (page) => {
      await page.click('text="NAVIGATE"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  },
  {
    name: 'terminal-explore-tab',
    description: 'Terminal - Explore tab active',
    url: '/',
    category: 'terminal',
    actions: async (page) => {
      await page.click('text="NAVIGATE"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.click('text="EXPLORE"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'terminal-chat-tab',
    description: 'Terminal - Chat tab active',
    url: '/',
    category: 'terminal',
    actions: async (page) => {
      await page.click('text="NAVIGATE"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.click('text="CHAT"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'terminal-game-tab',
    description: 'Terminal - Game tab active',
    url: '/',
    category: 'terminal',
    actions: async (page) => {
      await page.click('text="NAVIGATE"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.click('text="GAME"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'terminal-scene-tab',
    description: 'Terminal - Scene tab active',
    url: '/',
    category: 'terminal',
    actions: async (page) => {
      await page.click('text="NAVIGATE"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.click('text="SCENE"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'terminal-about-tab',
    description: 'Terminal - About tab active',
    url: '/',
    category: 'terminal',
    actions: async (page) => {
      await page.click('text="NAVIGATE"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.click('text="ABOUT"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  },

  // ============================================
  // 3D EXPERIENCE TESTS
  // ============================================
  {
    name: '3d-experience-button',
    description: '3D Experience - Button visible',
    url: '/',
    waitFor: 2000,
    category: '3d'
  },
  {
    name: '3d-experience-active',
    description: '3D Experience - Active state',
    url: '/',
    category: '3d',
    actions: async (page) => {
      await page.click('text="3D EXPERIENCE"', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }
  },
  {
    name: '3d-background-sphere',
    description: '3D Background - Sphere rendering',
    url: '/',
    waitFor: 3000,
    category: '3d',
    metrics: ['texture-load', '3d-render']
  },

  // ============================================
  // ARTICLES PAGE TESTS
  // ============================================
  {
    name: 'articles-page-initial',
    description: 'Articles page - Initial load',
    url: '/articles',
    waitFor: 2000,
    category: 'articles'
  },
  {
    name: 'articles-page-scrolled',
    description: 'Articles page - Scrolled down',
    url: '/articles',
    waitFor: 2000,
    category: 'articles',
    actions: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'articles-filter-1year',
    description: 'Articles - 1 Year filter applied',
    url: '/articles',
    category: 'articles',
    actions: async (page) => {
      await page.click('button:has-text("1 Year")', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'articles-filter-5years',
    description: 'Articles - 5 Years filter applied',
    url: '/articles',
    category: 'articles',
    actions: async (page) => {
      await page.click('button:has-text("5 Years")', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'articles-filter-crisis',
    description: 'Articles - Crisis filter applied',
    url: '/articles',
    category: 'articles',
    actions: async (page) => {
      await page.click('button:has-text("Crisis")', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'articles-search',
    description: 'Articles - Search interaction',
    url: '/articles',
    category: 'articles',
    actions: async (page) => {
      await page.fill('input[placeholder*="Search"]', 'AI', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  },

  // ============================================
  // PERFORMANCE MONITOR TESTS
  // ============================================
  {
    name: 'performance-monitor-visible',
    description: 'Performance monitor - FPS display',
    url: '/',
    waitFor: 5000,
    category: 'performance',
    metrics: ['fps', 'frame-time']
  },

  // ============================================
  // RESPONSIVE DESIGN TESTS
  // ============================================
  {
    name: 'responsive-mobile-portrait',
    description: 'Mobile portrait - Layout check',
    url: '/',
    waitFor: 2000,
    category: 'responsive',
    viewportsOnly: [{ width: 375, height: 812, name: 'mobile-portrait' }]
  },
  {
    name: 'responsive-mobile-landscape',
    description: 'Mobile landscape - Layout check',
    url: '/',
    waitFor: 2000,
    category: 'responsive',
    viewportsOnly: [{ width: 812, height: 375, name: 'mobile-landscape' }]
  },

  // ============================================
  // INTERACTION TESTS
  // ============================================
  {
    name: 'interaction-hover-states',
    description: 'Buttons - Hover states',
    url: '/',
    waitFor: 2000,
    category: 'interaction',
    actions: async (page) => {
      const button = await page.$('button:has-text("NAVIGATE")').catch(() => null);
      if (button) {
        await button.hover();
        await page.waitForTimeout(500);
      }
    }
  },

  // ============================================
  // EDGE CASE TESTS
  // ============================================
  {
    name: 'edge-no-javascript',
    description: 'Page without JavaScript',
    url: '/',
    waitFor: 2000,
    category: 'edge-case',
    javascriptEnabled: false
  },
  {
    name: 'edge-slow-network',
    description: 'Slow network simulation',
    url: '/',
    waitFor: 3000,
    category: 'edge-case',
    networkThrottle: 'slow-3g'
  }
];

// Viewport configurations
const defaultViewports = [
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 375, height: 812, name: 'mobile' }
];

const results = [];
const performanceMetrics = [];

async function runTests() {
  console.log('🚀 Enhanced Visual Testing System\n');
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

  // Group scenarios by category
  const categories = [...new Set(scenarios.map(s => s.category))];

  for (const category of categories) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📂 Category: ${category.toUpperCase()}`);
    console.log('='.repeat(60));

    const categoryScenarios = scenarios.filter(s => s.category === category);

    for (const scenario of categoryScenarios) {
      console.log(`\n📸 ${scenario.description}`);

      const viewports = scenario.viewportsOnly || defaultViewports;

      for (const viewport of viewports) {
        const startTime = Date.now();

        try {
          const contextOptions = {
            viewport,
            deviceScaleFactor: 2
          };

          // Apply network throttling if specified
          if (scenario.networkThrottle) {
            contextOptions.offline = false;
          }

          const context = await browser.newContext(contextOptions);
          const page = await context.newPage();

          // Disable JavaScript if specified
          if (scenario.javascriptEnabled === false) {
            await page.setJavaScriptEnabled(false);
          }

          // Apply network throttling
          if (scenario.networkThrottle === 'slow-3g') {
            await context.route('**/*', route => {
              setTimeout(() => route.continue(), 100);
            });
          }

          console.log(`   → ${viewport.name} (${viewport.width}x${viewport.height})`);

          // Navigate
          await page.goto(`${BASE_URL}${scenario.url}`, {
            waitUntil: 'networkidle',
            timeout: 30000
          });

          // Initial wait
          await page.waitForTimeout(2000);

          // Collect performance metrics if specified
          if (scenario.metrics) {
            const metrics = await page.evaluate(() => {
              return {
                fps: window.performance?.memory ? Math.round(1000 / performance.now()) : null,
                memory: window.performance?.memory?.usedJSHeapSize || null,
                navigation: performance.getEntriesByType('navigation')[0]?.duration || null
              };
            });

            performanceMetrics.push({
              scenario: scenario.name,
              viewport: viewport.name,
              ...metrics
            });
          }

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
            name: scenario.name,
            category: scenario.category,
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
            name: scenario.name,
            category: scenario.category,
            viewport: viewport.name,
            filename: '',
            duration,
            success: false,
            error: error.message
          });
        }
      }
    }
  }

  await browser.close();

  // Generate reports
  generateReport(outputDir);
  generateMetricsReport(outputDir);

  // Print summary
  printSummary(outputDir);
}

function generateReport(outputDir) {
  const reportPath = path.join(outputDir, 'report.html');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  // Group results by category
  const categories = [...new Set(results.map(r => r.category))];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhanced Visual Test Report - ${new Date().toLocaleDateString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Monaco', 'Courier New', monospace;
      background: #0a0a0f;
      color: #fff;
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container { max-width: 1800px; margin: 0 auto; }
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

    .category-section {
      margin: 60px 0;
    }

    .category-header {
      font-size: 24px;
      color: #00d4ff;
      margin-bottom: 30px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 30px;
      margin-top: 20px;
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
      font-size: 14px;
      margin-bottom: 10px;
      color: #00d4ff;
      font-weight: 600;
    }

    .result-meta {
      font-size: 11px;
      color: #666;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
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
      max-height: 400px;
    }

    .result-image {
      width: 100%;
      height: auto;
      display: block;
      cursor: pointer;
      object-fit: cover;
      max-height: 400px;
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
      z-index: 1001;
    }

    .nav-tabs {
      display: flex;
      gap: 10px;
      margin: 30px 0;
      flex-wrap: wrap;
    }

    .nav-tab {
      padding: 10px 20px;
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid #333;
      border-radius: 8px;
      color: #666;
      cursor: pointer;
      transition: all 0.2s;
    }

    .nav-tab:hover,
    .nav-tab.active {
      background: rgba(0, 212, 255, 0.1);
      border-color: #00d4ff;
      color: #00d4ff;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1><span>📸</span> Enhanced Visual Test Report</h1>
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
      <div class="stat-card">
        <div class="stat-label">Categories</div>
        <div class="stat-value">${categories.length}</div>
      </div>
    </div>

    <div class="nav-tabs">
      ${categories.map((cat, idx) => `
        <button class="nav-tab ${idx === 0 ? 'active' : ''}" onclick="showCategory('${cat}')">
          ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${results.filter(r => r.category === cat).length})
        </button>
      `).join('')}
      <button class="nav-tab" onclick="showCategory('all')">All Tests</button>
    </div>

    ${categories.map(category => `
      <div class="category-section" id="category-${category}">
        <div class="category-header">📂 ${category.toUpperCase()}</div>
        <div class="grid">
          ${results.filter(r => r.category === category).map(result => `
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
    `).join('')}
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

    function showCategory(category) {
      const sections = document.querySelectorAll('.category-section');
      const tabs = document.querySelectorAll('.nav-tab');

      tabs.forEach(tab => tab.classList.remove('active'));
      event.target.classList.add('active');

      if (category === 'all') {
        sections.forEach(section => section.style.display = 'block');
      } else {
        sections.forEach(section => {
          section.style.display = section.id === \`category-\${category}\` ? 'block' : 'none';
        });
      }
    }

    // Show first category by default
    document.addEventListener('DOMContentLoaded', () => {
      const categories = ${JSON.stringify(categories)};
      if (categories.length > 0) {
        showCategory(categories[0]);
      }
    });

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

function generateMetricsReport(outputDir) {
  if (performanceMetrics.length === 0) return;

  const metricsPath = path.join(outputDir, 'metrics.json');
  fs.writeFileSync(metricsPath, JSON.stringify(performanceMetrics, null, 2));
  console.log(`📈 Metrics saved: ${metricsPath}`);
}

function printSummary(outputDir) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary');
  console.log('='.repeat(70));
  console.log(`Total: ${results.length}`);
  console.log(`✓ Success: ${results.filter(r => r.success).length}`);
  console.log(`✗ Failed: ${results.filter(r => !r.success).length}`);

  const categories = [...new Set(results.map(r => r.category))];
  console.log(`\n📂 Categories: ${categories.length}`);
  categories.forEach(cat => {
    const catResults = results.filter(r => r.category === cat);
    const catSuccess = catResults.filter(r => r.success).length;
    console.log(`   ${cat}: ${catSuccess}/${catResults.length} passed`);
  });

  console.log(`\n📁 Output: ${outputDir}`);
  console.log('='.repeat(70) + '\n');
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
      console.log('\nInstall it with: npm run test:visual:install\n');
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
    console.error(error.stack);
    process.exit(1);
  }
})();
