/**
 * Visual Testing System
 *
 * Automated visual testing to validate UI improvements and catch regressions.
 * Captures screenshots of all major pages and interactions for comparison.
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface TestScenario {
  name: string;
  description: string;
  url: string;
  actions?: (page: Page) => Promise<void>;
  waitFor?: number;
  viewports?: Array<{ width: number; height: number; name: string }>;
}

interface TestResult {
  scenario: string;
  viewport: string;
  screenshotPath: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
}

class VisualTestRunner {
  private browser: Browser | null = null;
  private baseUrl: string;
  private screenshotDir: string;
  private results: TestResult[] = [];

  constructor(baseUrl = 'http://localhost:3000', screenshotDir = './test-screenshots') {
    this.baseUrl = baseUrl;
    this.screenshotDir = screenshotDir;
  }

  /**
   * Initialize browser and setup
   */
  async setup(): Promise<void> {
    console.log('🚀 Starting Visual Testing System...\n');

    // Create screenshot directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    this.screenshotDir = path.join(this.screenshotDir, timestamp);

    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    console.log(`📁 Screenshots will be saved to: ${this.screenshotDir}\n`);

    // Launch browser
    this.browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage']
    });
  }

  /**
   * Run a single test scenario
   */
  async runScenario(scenario: TestScenario): Promise<void> {
    if (!this.browser) throw new Error('Browser not initialized');

    console.log(`\n📸 Testing: ${scenario.name}`);
    console.log(`   ${scenario.description}`);

    const viewports = scenario.viewports || [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 812, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      const startTime = Date.now();
      const context = await this.browser.newContext({
        viewport,
        deviceScaleFactor: 2 // High DPI for better screenshots
      });

      const page = await context.newPage();

      try {
        console.log(`   → ${viewport.name} (${viewport.width}x${viewport.height})`);

        // Navigate to page
        await page.goto(`${this.baseUrl}${scenario.url}`, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        // Wait for initial load
        await page.waitForTimeout(2000);

        // Execute custom actions if provided
        if (scenario.actions) {
          await scenario.actions(page);
        }

        // Additional wait if specified
        if (scenario.waitFor) {
          await page.waitForTimeout(scenario.waitFor);
        }

        // Capture screenshot
        const filename = `${scenario.name.replace(/[^a-z0-9]/gi, '-')}-${viewport.name}.png`;
        const screenshotPath = path.join(this.screenshotDir, filename);

        await page.screenshot({
          path: screenshotPath,
          fullPage: true
        });

        const duration = Date.now() - startTime;
        this.results.push({
          scenario: scenario.name,
          viewport: viewport.name,
          screenshotPath: filename,
          timestamp: new Date(),
          duration,
          success: true
        });

        console.log(`   ✓ Captured in ${duration}ms`);

      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`   ✗ Failed: ${error}`);

        this.results.push({
          scenario: scenario.name,
          viewport: viewport.name,
          screenshotPath: '',
          timestamp: new Date(),
          duration,
          success: false,
          error: String(error)
        });
      } finally {
        await context.close();
      }
    }
  }

  /**
   * Generate HTML report
   */
  generateReport(): void {
    const reportPath = path.join(this.screenshotDir, 'report.html');

    const successCount = this.results.filter(r => r.success).length;
    const failCount = this.results.filter(r => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Monaco', 'Courier New', monospace;
      background: #0a0a0f;
      color: #fff;
      padding: 40px 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 {
      font-size: 32px;
      margin-bottom: 10px;
      color: #00d4ff;
    }
    .summary {
      display: flex;
      gap: 20px;
      margin: 30px 0;
      flex-wrap: wrap;
    }
    .stat-card {
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
      min-width: 200px;
    }
    .stat-label {
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 28px;
      font-weight: bold;
    }
    .success { color: #00d4ff; }
    .error { color: #ff6b6b; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 30px;
      margin-top: 40px;
    }
    .result-card {
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid #333;
      border-radius: 12px;
      overflow: hidden;
    }
    .result-header {
      padding: 20px;
      border-bottom: 1px solid #333;
    }
    .result-title {
      font-size: 16px;
      margin-bottom: 8px;
      color: #00d4ff;
    }
    .result-meta {
      font-size: 12px;
      color: #666;
      display: flex;
      gap: 15px;
    }
    .result-image {
      width: 100%;
      height: auto;
      display: block;
      background: #000;
    }
    .error-message {
      padding: 20px;
      background: rgba(255, 107, 107, 0.1);
      border-top: 2px solid #ff6b6b;
      color: #ff6b6b;
      font-size: 12px;
    }
    .timestamp {
      color: #888;
      font-size: 14px;
      margin-bottom: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📸 Visual Test Report</h1>
    <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>

    <div class="summary">
      <div class="stat-card">
        <div class="stat-label">Total Tests</div>
        <div class="stat-value">${this.results.length}</div>
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
        <div class="stat-label">Total Duration</div>
        <div class="stat-value">${(totalDuration / 1000).toFixed(2)}s</div>
      </div>
    </div>

    <div class="grid">
      ${this.results.map(result => `
        <div class="result-card">
          <div class="result-header">
            <div class="result-title">${result.scenario}</div>
            <div class="result-meta">
              <span>${result.viewport}</span>
              <span>${result.duration}ms</span>
              <span class="${result.success ? 'success' : 'error'}">${result.success ? '✓' : '✗'}</span>
            </div>
          </div>
          ${result.success ? `
            <img src="${result.screenshotPath}" alt="${result.scenario} - ${result.viewport}" class="result-image" />
          ` : `
            <div class="error-message">${result.error || 'Unknown error'}</div>
          `}
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(reportPath, html);
    console.log(`\n📊 Report generated: ${reportPath}`);
  }

  /**
   * Cleanup
   */
  async teardown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Run all test scenarios
   */
  async runAll(scenarios: TestScenario[]): Promise<void> {
    await this.setup();

    for (const scenario of scenarios) {
      await this.runScenario(scenario);
    }

    this.generateReport();
    await this.teardown();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`Total: ${this.results.length}`);
    console.log(`✓ Success: ${this.results.filter(r => r.success).length}`);
    console.log(`✗ Failed: ${this.results.filter(r => !r.success).length}`);
    console.log('='.repeat(60) + '\n');
  }
}

/**
 * Test Scenarios - All major pages and interactions
 */
const testScenarios: TestScenario[] = [
  {
    name: 'Landing Page',
    description: 'Main landing page with 3D background',
    url: '/',
    waitFor: 3000 // Wait for 3D scene to load
  },
  {
    name: 'Landing Page - Terminal Open',
    description: 'Landing page with terminal interface open',
    url: '/',
    waitFor: 2000,
    actions: async (page) => {
      // Click to open terminal
      await page.click('button:has-text("NAVIGATE")').catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'Landing Page - 3D Experience',
    description: 'Landing page with 3D experience active',
    url: '/',
    waitFor: 2000,
    actions: async (page) => {
      await page.click('button:has-text("3D EXPERIENCE")').catch(() => {});
      await page.waitForTimeout(2000);
    }
  },
  {
    name: 'Articles Page',
    description: 'Article discovery and browsing page',
    url: '/articles',
    waitFor: 2000
  },
  {
    name: 'Articles Page - Filtered',
    description: 'Articles page with filters applied',
    url: '/articles',
    actions: async (page) => {
      // Apply some filters
      await page.click('button:has-text("1 Year")').catch(() => {});
      await page.waitForTimeout(500);
    }
  },
  {
    name: 'Game Interface',
    description: 'Interactive clicking game',
    url: '/',
    actions: async (page) => {
      // Open terminal and navigate to game
      await page.click('button:has-text("NAVIGATE")').catch(() => {});
      await page.waitForTimeout(500);
      await page.click('button:has-text("GAME")').catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'Terminal - Explore Tab',
    description: 'Terminal interface explore tab',
    url: '/',
    actions: async (page) => {
      await page.click('button:has-text("NAVIGATE")').catch(() => {});
      await page.waitForTimeout(500);
      await page.click('button:has-text("EXPLORE")').catch(() => {});
      await page.waitForTimeout(1000);
    }
  },
  {
    name: 'Terminal - About Tab',
    description: 'Terminal interface about tab',
    url: '/',
    actions: async (page) => {
      await page.click('button:has-text("NAVIGATE")').catch(() => {});
      await page.waitForTimeout(500);
      await page.click('button:has-text("ABOUT")').catch(() => {});
      await page.waitForTimeout(500);
    }
  },
  {
    name: 'Performance Monitor',
    description: 'Page with performance monitor visible',
    url: '/',
    waitFor: 3000 // Let FPS stabilize
  }
];

/**
 * Main execution
 */
async function main() {
  const runner = new VisualTestRunner();

  try {
    await runner.runAll(testScenarios);
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { VisualTestRunner, testScenarios };
