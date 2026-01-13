# Visual Testing System

Automated visual testing system to validate UI improvements and catch visual regressions across all pages and viewports.

## Features

- 📸 **Screenshot Capture**: Automatically captures full-page screenshots
- 📱 **Multi-Viewport**: Tests desktop (1920x1080), tablet (768x1024), and mobile (375x812)
- 🎯 **Interaction Testing**: Simulates user interactions (clicking buttons, opening modals, etc.)
- 📊 **HTML Reports**: Generates beautiful, interactive HTML reports
- ⚡ **Performance Tracking**: Records load times for each test
- 🔍 **Full-Page Screenshots**: Captures entire scrollable page content

## Quick Start

### 1. Install Dependencies

```bash
npm install --save-dev playwright
```

### 2. Start Your Dev Server

```bash
npm run dev
```

### 3. Run Visual Tests

```bash
npm run test:visual
```

## Test Scenarios

The system tests the following pages and interactions:

### Landing Page Tests
1. **Landing Page**: Initial load with 3D background
2. **Terminal Open**: Landing page with terminal interface visible
3. **3D Experience**: Landing page with 3D experience activated

### Navigation Tests
4. **Articles Page**: Article discovery and browsing
5. **Terminal Explore Tab**: Terminal interface explore view
6. **Terminal Game Tab**: Interactive game interface

## Output

Test results are saved to `./test-screenshots/[date]/[timestamp]/`:

```
test-screenshots/
└── 2026-01-11/
    └── 1736608234567/
        ├── report.html                          # Interactive HTML report
        ├── landing-page-desktop.png
        ├── landing-page-tablet.png
        ├── landing-page-mobile.png
        ├── landing-terminal-open-desktop.png
        ├── ...
```

## HTML Report

The generated `report.html` includes:

- ✅ **Summary Statistics**: Total tests, success rate, duration
- 📸 **Screenshot Gallery**: All captured screenshots organized by test
- 🔍 **Click to Zoom**: Full-size image preview on click
- 📊 **Performance Metrics**: Load time for each test
- ❌ **Error Details**: Clear error messages for failed tests

Open the report in your browser:
```bash
open test-screenshots/[date]/[timestamp]/report.html
```

## Configuration

Edit `tests/visual-test-runner.js` to customize:

### Base URL
```javascript
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
```

### Viewports
```javascript
const viewports = [
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 375, height: 812, name: 'mobile' }
];
```

### Test Scenarios
```javascript
const scenarios = [
  {
    name: 'my-test',
    description: 'Description of test',
    url: '/page',
    waitFor: 2000, // Wait time in ms
    actions: async (page) => {
      // Custom interactions
      await page.click('button');
      await page.fill('input', 'text');
    }
  }
];
```

## Advanced Usage

### Test Specific URL
```bash
BASE_URL=http://localhost:3001 npm run test:visual
```

### Add Custom Test Scenarios

1. Open `tests/visual-test-runner.js`
2. Add new scenario to `scenarios` array:

```javascript
{
  name: 'custom-test',
  description: 'My custom test scenario',
  url: '/my-page',
  waitFor: 2000,
  actions: async (page) => {
    // Simulate user actions
    await page.click('[data-testid="my-button"]');
    await page.waitForSelector('.modal');
    await page.fill('#search', 'query');
  }
}
```

## Performance Optimization Tests

The visual tests help validate these specific optimizations:

### 1. Particle System Performance
- **Test**: Landing page load
- **Validate**: Check for smooth rendering without FPS drops
- **Look for**: Particle effects visible and animated

### 2. 3D Scene Loading
- **Test**: Landing page with 3D experience
- **Validate**: Scene loads without errors
- **Look for**: Background sphere, ambient particles

### 3. Mobile Optimization
- **Test**: All tests on mobile viewport
- **Validate**: Reduced particle count, responsive UI
- **Look for**: Proper layout on 375x812 viewport

### 4. Terminal Interface
- **Test**: Terminal open/interaction tests
- **Validate**: Smooth transitions, proper z-index
- **Look for**: No visual glitches or overlapping elements

## Troubleshooting

### Server Not Running
```
❌ Server is not running at http://localhost:3000
Start the dev server with: npm run dev
```

**Solution**: Start the development server in another terminal.

### Playwright Not Installed
```
❌ Playwright is not installed!
Install it with: npm install --save-dev playwright
```

**Solution**: Install Playwright as a dev dependency.

### Tests Timing Out
If tests are timing out, increase the timeout in the script:
```javascript
await page.goto(url, {
  waitUntil: 'networkidle',
  timeout: 60000 // Increase from 30s to 60s
});
```

### Screenshots Missing Elements
If some elements aren't captured:
1. Increase `waitFor` time in the scenario
2. Add explicit waits for specific elements:
```javascript
await page.waitForSelector('.my-element');
await page.waitForLoadState('networkidle');
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Visual Tests

on: [push, pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run dev &
      - run: sleep 10 # Wait for server
      - run: npm run test:visual
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: visual-test-results
          path: test-screenshots/
```

## Best Practices

1. **Run Before Commits**: Validate changes before committing
2. **Compare Screenshots**: Keep previous test runs to compare changes
3. **Test All Viewports**: Ensure responsive design works correctly
4. **Document Expected Behavior**: Add comments to test scenarios
5. **Version Control**: Commit baseline screenshots for comparison

## Metrics to Monitor

When reviewing test results, check:

- ✅ **Load Times**: Should be < 3s for initial page load
- ✅ **Visual Consistency**: No broken layouts or missing elements
- ✅ **Mobile Responsiveness**: Elements properly sized on mobile
- ✅ **3D Performance**: Scenes render without visual glitches
- ✅ **Interaction States**: Modals, menus, overlays work correctly

## Future Enhancements

Potential additions to the visual testing system:

- [ ] Visual diff comparison with baseline screenshots
- [ ] Lighthouse performance audits
- [ ] Accessibility testing (WCAG compliance)
- [ ] Network throttling tests (3G, 4G)
- [ ] Animation performance profiling
- [ ] WebGL/3D scene performance metrics
- [ ] Video recording of test runs
- [ ] Parallel test execution
- [ ] Custom assertion helpers

## Contributing

To add new test scenarios:

1. Fork and create a feature branch
2. Add test scenario to `scenarios` array
3. Test locally with `npm run test:visual`
4. Submit PR with screenshots showing new test

## License

Same as project license.
