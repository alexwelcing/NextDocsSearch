#!/usr/bin/env node

/**
 * Visual Testing Feedback Analyzer
 *
 * Analyzes screenshots and test results to provide actionable feedback
 * and suggestions for improvements.
 */

const fs = require('fs');
const path = require('path');

class FeedbackAnalyzer {
  constructor(testResultsDir) {
    this.testResultsDir = testResultsDir;
    this.results = [];
    this.metrics = [];
    this.feedback = {
      critical: [],
      warnings: [],
      suggestions: [],
      passed: []
    };
  }

  /**
   * Load test results and metrics
   */
  loadResults() {
    // Load test results from the most recent test run
    const dates = fs.readdirSync(this.testResultsDir)
      .filter(f => fs.statSync(path.join(this.testResultsDir, f)).isDirectory())
      .sort()
      .reverse();

    if (dates.length === 0) {
      throw new Error('No test results found');
    }

    const latestDate = dates[0];
    const datePath = path.join(this.testResultsDir, latestDate);

    const timestamps = fs.readdirSync(datePath)
      .filter(f => fs.statSync(path.join(datePath, f)).isDirectory())
      .sort()
      .reverse();

    if (timestamps.length === 0) {
      throw new Error('No test runs found');
    }

    const latestRun = path.join(datePath, timestamps[0]);

    console.log(`📂 Analyzing results from: ${latestRun}\n`);

    // Check for metrics file
    const metricsPath = path.join(latestRun, 'metrics.json');
    if (fs.existsSync(metricsPath)) {
      this.metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    }

    // Count screenshots and categorize
    const files = fs.readdirSync(latestRun).filter(f => f.endsWith('.png'));

    this.results = files.map(file => {
      const parts = file.replace('.png', '').split('-');
      const viewport = parts[parts.length - 1];
      const name = parts.slice(0, -1).join('-');

      return {
        filename: file,
        name,
        viewport,
        path: path.join(latestRun, file),
        size: fs.statSync(path.join(latestRun, file)).size
      };
    });

    return latestRun;
  }

  /**
   * Analyze test results and generate feedback
   */
  analyze() {
    console.log('🔍 Analyzing test results...\n');

    // Group by viewport
    const viewports = [...new Set(this.results.map(r => r.viewport))];
    const categories = this.groupByCategory();

    // Check for missing screenshots
    this.checkCoverage(categories, viewports);

    // Check performance metrics
    this.checkPerformance();

    // Check file sizes (images too large might indicate rendering issues)
    this.checkImageSizes();

    // Check viewport consistency
    this.checkResponsiveDesign(viewports);

    // Category-specific checks
    this.checkCategorySpecific(categories);

    // Generate recommendations
    this.generateRecommendations();
  }

  groupByCategory() {
    const categories = {};

    this.results.forEach(result => {
      const category = this.getCategoryFromName(result.name);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(result);
    });

    return categories;
  }

  getCategoryFromName(name) {
    if (name.startsWith('landing')) return 'landing';
    if (name.startsWith('terminal')) return 'terminal';
    if (name.startsWith('3d')) return '3d';
    if (name.startsWith('articles')) return 'articles';
    if (name.startsWith('performance')) return 'performance';
    if (name.startsWith('responsive')) return 'responsive';
    if (name.startsWith('interaction')) return 'interaction';
    if (name.startsWith('edge')) return 'edge-case';
    return 'other';
  }

  checkCoverage(categories, viewports) {
    const expectedCategories = ['landing', 'terminal', '3d', 'articles'];
    const missingCategories = expectedCategories.filter(cat => !categories[cat]);

    if (missingCategories.length > 0) {
      this.feedback.warnings.push({
        type: 'coverage',
        severity: 'medium',
        message: `Missing test coverage for categories: ${missingCategories.join(', ')}`,
        suggestion: 'Add test scenarios for all major UI components'
      });
    }

    // Check if all viewports are tested
    const expectedViewports = ['desktop', 'tablet', 'mobile'];
    const missingViewports = expectedViewports.filter(vp => !viewports.includes(vp));

    if (missingViewports.length > 0) {
      this.feedback.warnings.push({
        type: 'viewport-coverage',
        severity: 'medium',
        message: `Missing viewport coverage: ${missingViewports.join(', ')}`,
        suggestion: 'Ensure all tests run on desktop, tablet, and mobile viewports'
      });
    }
  }

  checkPerformance() {
    if (this.metrics.length === 0) {
      this.feedback.suggestions.push({
        type: 'metrics',
        severity: 'low',
        message: 'No performance metrics collected',
        suggestion: 'Enable performance metric collection in test scenarios'
      });
      return;
    }

    // Check for slow load times
    const slowTests = this.metrics.filter(m => m.navigation && m.navigation > 5000);

    if (slowTests.length > 0) {
      this.feedback.critical.push({
        type: 'performance',
        severity: 'high',
        message: `${slowTests.length} tests have slow load times (>5s)`,
        details: slowTests.map(t => `${t.scenario} on ${t.viewport}: ${(t.navigation / 1000).toFixed(2)}s`),
        suggestion: 'Optimize asset loading, reduce bundle size, or implement code splitting'
      });
    }

    // Check FPS if available
    const lowFpsTests = this.metrics.filter(m => m.fps && m.fps < 30);

    if (lowFpsTests.length > 0) {
      this.feedback.critical.push({
        type: 'fps',
        severity: 'high',
        message: `${lowFpsTests.length} tests show low FPS (<30)`,
        details: lowFpsTests.map(t => `${t.scenario} on ${t.viewport}: ${t.fps} FPS`),
        suggestion: 'Review particle systems, 3D rendering, and animation performance'
      });
    }
  }

  checkImageSizes() {
    // Check for unusually large screenshots (might indicate rendering issues)
    const avgSize = this.results.reduce((sum, r) => sum + r.size, 0) / this.results.length;
    const largeImages = this.results.filter(r => r.size > avgSize * 2);

    if (largeImages.length > 0) {
      this.feedback.warnings.push({
        type: 'image-size',
        severity: 'medium',
        message: `${largeImages.length} screenshots are significantly larger than average`,
        details: largeImages.map(img => `${img.filename}: ${(img.size / 1024 / 1024).toFixed(2)}MB`),
        suggestion: 'Check for complex rendering, many DOM elements, or high-res images'
      });
    }

    // Check for very small images (might indicate failed renders)
    const smallImages = this.results.filter(r => r.size < 50000); // < 50KB

    if (smallImages.length > 0) {
      this.feedback.critical.push({
        type: 'render-failure',
        severity: 'high',
        message: `${smallImages.length} screenshots are suspiciously small`,
        details: smallImages.map(img => `${img.filename}: ${(img.size / 1024).toFixed(2)}KB`),
        suggestion: 'These pages may not be rendering correctly - investigate further'
      });
    }
  }

  checkResponsiveDesign(viewports) {
    // Group screenshots by test name
    const testGroups = {};

    this.results.forEach(result => {
      if (!testGroups[result.name]) {
        testGroups[result.name] = [];
      }
      testGroups[result.name].push(result);
    });

    // Check if tests exist across all viewports
    Object.entries(testGroups).forEach(([testName, screenshots]) => {
      const viewportsMissing = viewports.filter(vp =>
        !screenshots.some(s => s.viewport === vp)
      );

      if (viewportsMissing.length > 0 && viewportsMissing.length < viewports.length) {
        this.feedback.warnings.push({
          type: 'incomplete-viewport-coverage',
          severity: 'medium',
          message: `Test "${testName}" missing on: ${viewportsMissing.join(', ')}`,
          suggestion: 'Ensure consistent viewport testing for all scenarios'
        });
      }
    });
  }

  checkCategorySpecific(categories) {
    // Landing page checks
    if (categories.landing) {
      const landingTests = categories.landing.length;
      if (landingTests < 6) {
        this.feedback.suggestions.push({
          type: 'landing-coverage',
          severity: 'low',
          message: `Only ${landingTests} landing page tests found`,
          suggestion: 'Consider testing: initial load, scrolled state, with/without particles, 3D active'
        });
      } else {
        this.feedback.passed.push({
          type: 'landing-coverage',
          message: 'Comprehensive landing page test coverage'
        });
      }
    }

    // Terminal interface checks
    if (categories.terminal) {
      const terminalTests = categories.terminal.length;
      const terminalStates = ['explore', 'chat', 'game', 'scene', 'about'];

      const testedStates = terminalStates.filter(state =>
        categories.terminal.some(t => t.name.includes(state))
      );

      if (testedStates.length < terminalStates.length) {
        const missing = terminalStates.filter(s => !testedStates.includes(s));
        this.feedback.warnings.push({
          type: 'terminal-tabs',
          severity: 'medium',
          message: `Terminal tabs not fully tested: ${missing.join(', ')} missing`,
          suggestion: 'Add tests for all terminal tab states'
        });
      } else {
        this.feedback.passed.push({
          type: 'terminal-coverage',
          message: 'All terminal tabs tested'
        });
      }
    }

    // 3D experience checks
    if (categories['3d']) {
      this.feedback.passed.push({
        type: '3d-coverage',
        message: '3D experience tests present'
      });

      // Check if we have both inactive and active 3D states
      const has3DActive = categories['3d'].some(t => t.name.includes('active'));
      if (!has3DActive) {
        this.feedback.suggestions.push({
          type: '3d-states',
          severity: 'low',
          message: 'No test for active 3D experience state',
          suggestion: 'Add test for 3D experience activation'
        });
      }
    } else {
      this.feedback.warnings.push({
        type: '3d-missing',
        severity: 'medium',
        message: 'No 3D experience tests found',
        suggestion: 'Add tests for 3D background sphere and particle effects'
      });
    }

    // Articles page checks
    if (categories.articles) {
      const hasFilters = categories.articles.some(t => t.name.includes('filter'));
      const hasSearch = categories.articles.some(t => t.name.includes('search'));

      if (!hasFilters) {
        this.feedback.suggestions.push({
          type: 'articles-filters',
          severity: 'low',
          message: 'No article filter tests found',
          suggestion: 'Test filter interactions (1 Year, 5 Years, Crisis, etc.)'
        });
      }

      if (!hasSearch) {
        this.feedback.suggestions.push({
          type: 'articles-search',
          severity: 'low',
          message: 'No article search test found',
          suggestion: 'Test search functionality'
        });
      }
    }
  }

  generateRecommendations() {
    // Overall recommendations based on test suite
    const totalTests = this.results.length;
    const viewports = [...new Set(this.results.map(r => r.viewport))];

    if (totalTests < 30) {
      this.feedback.suggestions.push({
        type: 'test-coverage',
        severity: 'low',
        message: `Only ${totalTests} total tests - consider expanding coverage`,
        suggestion: 'Aim for 50+ tests covering all UI states, interactions, and edge cases'
      });
    }

    // Performance optimization recommendations based on particle tests
    const particleTests = this.results.filter(r => r.name.includes('particle'));
    if (particleTests.length > 0) {
      this.feedback.passed.push({
        type: 'particle-testing',
        message: 'Particle system tests present - good for validating optimizations'
      });
    }

    // Responsive design quality
    if (viewports.length >= 3) {
      this.feedback.passed.push({
        type: 'responsive-coverage',
        message: 'Multi-viewport testing enabled'
      });
    }
  }

  /**
   * Generate detailed feedback report
   */
  generateReport() {
    const reportLines = [];

    reportLines.push('');
    reportLines.push('='.repeat(80));
    reportLines.push('🔍 VISUAL TESTING FEEDBACK REPORT');
    reportLines.push('='.repeat(80));
    reportLines.push('');

    // Summary
    reportLines.push(`📊 Test Summary:`);
    reportLines.push(`   Total Screenshots: ${this.results.length}`);
    reportLines.push(`   Categories: ${Object.keys(this.groupByCategory()).length}`);
    reportLines.push(`   Viewports: ${[...new Set(this.results.map(r => r.viewport))].join(', ')}`);
    reportLines.push('');

    // Critical issues
    if (this.feedback.critical.length > 0) {
      reportLines.push('🚨 CRITICAL ISSUES:');
      reportLines.push('='.repeat(80));
      this.feedback.critical.forEach(item => {
        reportLines.push(`\n❌ ${item.message}`);
        if (item.details) {
          item.details.forEach(detail => reportLines.push(`   • ${detail}`));
        }
        reportLines.push(`   💡 Suggestion: ${item.suggestion}`);
        reportLines.push('');
      });
    }

    // Warnings
    if (this.feedback.warnings.length > 0) {
      reportLines.push('⚠️  WARNINGS:');
      reportLines.push('='.repeat(80));
      this.feedback.warnings.forEach(item => {
        reportLines.push(`\n⚠️  ${item.message}`);
        if (item.details) {
          item.details.forEach(detail => reportLines.push(`   • ${detail}`));
        }
        reportLines.push(`   💡 Suggestion: ${item.suggestion}`);
        reportLines.push('');
      });
    }

    // Suggestions
    if (this.feedback.suggestions.length > 0) {
      reportLines.push('💡 SUGGESTIONS FOR IMPROVEMENT:');
      reportLines.push('='.repeat(80));
      this.feedback.suggestions.forEach(item => {
        reportLines.push(`\n💡 ${item.message}`);
        reportLines.push(`   💡 Suggestion: ${item.suggestion}`);
        reportLines.push('');
      });
    }

    // Passed checks
    if (this.feedback.passed.length > 0) {
      reportLines.push('✅ PASSED CHECKS:');
      reportLines.push('='.repeat(80));
      this.feedback.passed.forEach(item => {
        reportLines.push(`✅ ${item.message}`);
      });
      reportLines.push('');
    }

    // Overall score
    const criticalCount = this.feedback.critical.length;
    const warningCount = this.feedback.warnings.length;
    const suggestionCount = this.feedback.suggestions.length;
    const passedCount = this.feedback.passed.length;

    const totalIssues = criticalCount + warningCount + suggestionCount;
    const score = Math.max(0, 100 - (criticalCount * 20) - (warningCount * 10) - (suggestionCount * 5));

    reportLines.push('='.repeat(80));
    reportLines.push('📈 OVERALL QUALITY SCORE');
    reportLines.push('='.repeat(80));
    reportLines.push('');
    reportLines.push(`Score: ${score}/100`);
    reportLines.push('');
    reportLines.push(`Critical Issues: ${criticalCount}`);
    reportLines.push(`Warnings: ${warningCount}`);
    reportLines.push(`Suggestions: ${suggestionCount}`);
    reportLines.push(`Passed Checks: ${passedCount}`);
    reportLines.push('');

    if (score >= 90) {
      reportLines.push('🎉 Excellent! Your visual tests are comprehensive and well-structured.');
    } else if (score >= 70) {
      reportLines.push('👍 Good test coverage with some areas for improvement.');
    } else if (score >= 50) {
      reportLines.push('⚠️  Fair test coverage. Address critical issues and warnings.');
    } else {
      reportLines.push('🚨 Test coverage needs significant improvement. Address all issues.');
    }

    reportLines.push('');
    reportLines.push('='.repeat(80));
    reportLines.push('');

    return reportLines.join('\n');
  }

  /**
   * Save feedback report to file
   */
  saveReport(outputPath) {
    const report = this.generateReport();
    fs.writeFileSync(outputPath, report);
    console.log(`\n📄 Feedback report saved: ${outputPath}\n`);
  }
}

// CLI execution
async function main() {
  const testResultsDir = process.argv[2] || './test-screenshots';

  if (!fs.existsSync(testResultsDir)) {
    console.error(`\n❌ Test results directory not found: ${testResultsDir}`);
    console.log('\nRun visual tests first: npm run test:visual\n');
    process.exit(1);
  }

  try {
    const analyzer = new FeedbackAnalyzer(testResultsDir);
    const resultsPath = analyzer.loadResults();
    analyzer.analyze();

    // Print to console
    console.log(analyzer.generateReport());

    // Save to file
    const reportPath = path.join(path.dirname(resultsPath), 'feedback-report.txt');
    analyzer.saveReport(reportPath);

    // Exit with error code if there are critical issues
    if (analyzer.feedback.critical.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Analysis failed: ${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { FeedbackAnalyzer };
