# 📸 Visual Testing Guide

This guide explains how to use the visual testing system to validate UI improvements and catch regressions.

## Quick Start

### 1️⃣ Install Playwright (One-Time Setup)

```bash
npm run test:visual:install
```

This installs Playwright and downloads the Chromium browser (~110MB).

### 2️⃣ Start Dev Server

```bash
npm run dev
```

Keep this running in a separate terminal.

### 3️⃣ Run Visual Tests

```bash
npm run test:visual
```

## What Gets Tested

The visual testing system automatically captures screenshots of:

### Landing Page
- ✅ Initial page load with 3D background
- ✅ Landing page with terminal interface open
- ✅ Landing page with 3D experience activated

### Navigation & Interactions
- ✅ Articles discovery page
- ✅ Terminal explore tab
- ✅ Terminal game interface

### Responsive Design
Each test runs on **3 viewports**:
- 🖥️ **Desktop**: 1920x1080
- 📱 **Tablet**: 768x1024
- 📱 **Mobile**: 375x812

## Output & Reports

### File Structure

```
test-screenshots/
└── 2026-01-11/                    # Date
    └── 1736608234567/              # Timestamp
        ├── report.html             # 📊 Interactive HTML report
        ├── landing-page-desktop.png
        ├── landing-page-tablet.png
        ├── landing-page-mobile.png
        └── ... (all other screenshots)
```

### HTML Report Features

Open `report.html` in your browser to see:

1. **Summary Dashboard**
   - Total tests run
   - Success/failure counts
   - Total execution time

2. **Screenshot Gallery**
   - All captured screenshots
   - Organized by test scenario
   - Labeled with viewport size

3. **Interactive Features**
   - Click any screenshot to view full-size
   - Hover effects for better navigation
   - Performance metrics for each test

## Validating Performance Improvements

Use visual testing to verify the optimizations made:

### ✅ Particle System Optimization
**What to check:**
- Landing page screenshots show particles rendering
- No visual glitches or missing elements
- Smooth appearance across all viewports

**How to verify:**
1. Open `landing-page-desktop.png`
2. Look for floating "wisdom dust" particles
3. Verify they're evenly distributed
4. Check mobile version has fewer particles (expected behavior)

### ✅ 3D Scene Loading
**What to check:**
- Background sphere renders correctly
- No texture loading flashes
- Consistent appearance across tests

**How to verify:**
1. Compare `landing-page-*.png` across viewports
2. Look for 360° background image
3. Verify no black screens or missing textures

### ✅ Terminal Interface
**What to check:**
- Terminal opens smoothly
- No z-index issues or overlapping
- Proper responsive layout

**How to verify:**
1. Open `landing-terminal-open-*.png`
2. Verify terminal modal is visible
3. Check backdrop blur effect
4. Compare desktop vs mobile layouts

### ✅ Mobile Optimization
**What to check:**
- Reduced particle count on mobile
- Proper touch target sizes
- Responsive typography

**How to verify:**
1. Compare desktop vs mobile screenshots
2. Verify UI elements are appropriately sized
3. Check for any overflow or clipping issues

## Before & After Comparisons

### Creating Baselines

1. **Before optimizations**, run tests and save the output:
   ```bash
   npm run test:visual
   mv test-screenshots baseline-screenshots
   ```

2. **After optimizations**, run tests again:
   ```bash
   npm run test:visual
   ```

3. **Compare** the two sets of screenshots side-by-side

### What to Look For

| Aspect | Expected Improvement |
|--------|---------------------|
| **Load Time** | Faster initial render (check report timings) |
| **Visual Quality** | Same or better appearance |
| **Responsiveness** | Smoother on mobile devices |
| **Consistency** | No new visual bugs or regressions |

## Common Issues & Solutions

### ❌ "Server is not running"

**Problem**: Dev server not started
**Solution**:
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run test:visual
```

### ❌ "Playwright is not installed"

**Problem**: Missing Playwright dependency
**Solution**:
```bash
npm run test:visual:install
```

### ❌ Tests timing out

**Problem**: Slow page loads or 3D scenes
**Solution**: Edit `tests/visual-test-runner.js` and increase timeouts:
```javascript
waitUntil: 'networkidle',
timeout: 60000 // Increase from 30s to 60s
```

### ❌ Screenshots missing elements

**Problem**: Elements not loaded before screenshot
**Solution**: Increase `waitFor` in test scenarios:
```javascript
{
  name: 'my-test',
  url: '/',
  waitFor: 5000 // Increase wait time
}
```

## Advanced Usage

### Test Specific URL

```bash
BASE_URL=http://localhost:3001 npm run test:visual
```

### Add Custom Tests

Edit `tests/visual-test-runner.js` and add to the `scenarios` array:

```javascript
{
  name: 'custom-page',
  description: 'My custom page test',
  url: '/custom',
  waitFor: 2000,
  actions: async (page) => {
    // Simulate user interactions
    await page.click('#my-button');
    await page.fill('input[name="search"]', 'test query');
    await page.press('Enter');
    await page.waitForTimeout(1000);
  }
}
```

### Custom Viewports

Edit the `viewports` array in `tests/visual-test-runner.js`:

```javascript
const viewports = [
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 1366, height: 768, name: 'laptop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 375, height: 812, name: 'mobile-iphone' },
  { width: 360, height: 740, name: 'mobile-android' }
];
```

## Integration with Development Workflow

### 1. Pre-Commit Testing

Before committing UI changes:
```bash
npm run test:visual
# Review report.html
# Verify no regressions
git add .
git commit -m "Update: [description]"
```

### 2. Pull Request Validation

Include screenshot comparison in PR:
1. Run tests before changes
2. Save baseline screenshots
3. Make your changes
4. Run tests again
5. Include before/after in PR description

### 3. Performance Monitoring

Track performance over time:
- Save test reports after each major change
- Compare load times in report summaries
- Monitor for performance regressions

## Best Practices

### ✅ DO:
- Run tests before and after major UI changes
- Keep baseline screenshots for comparison
- Review all viewports, not just desktop
- Check report.html for performance metrics
- Add new tests for new pages/features

### ❌ DON'T:
- Commit test screenshots to git (they're in .gitignore)
- Run tests without dev server running
- Ignore failed tests without investigation
- Skip mobile/tablet viewport verification

## Performance Metrics

When reviewing reports, look for these benchmarks:

| Test | Desktop | Tablet | Mobile | Notes |
|------|---------|--------|--------|-------|
| Landing Page | < 3s | < 4s | < 5s | Initial load with 3D |
| Terminal Open | < 2s | < 2.5s | < 3s | Modal interaction |
| Articles Page | < 2s | < 3s | < 4s | Content heavy |
| 3D Experience | < 4s | < 5s | < 6s | Complex scene |

## Troubleshooting Performance

If tests show slow load times:

1. **Check Network**
   ```javascript
   // Add to test scenario
   await page.route('**/*', (route) => {
     console.log(`Loading: ${route.request().url()}`);
     route.continue();
   });
   ```

2. **Profile Rendering**
   - Open screenshots in image viewer
   - Look for partially loaded content
   - Identify which elements are slow

3. **Compare with Baseline**
   - Load time increased? → Performance regression
   - Visual quality decreased? → Optimization too aggressive
   - New errors? → Breaking change introduced

## Next Steps

After validating improvements:

1. ✅ Review all screenshots in report.html
2. ✅ Compare before/after if available
3. ✅ Verify performance metrics
4. ✅ Check responsive design on all viewports
5. ✅ Document any issues found
6. ✅ Re-run after fixes

## Resources

- 📚 Full documentation: `tests/README.md`
- 🔧 Test runner source: `tests/visual-test-runner.js`
- 🎭 Playwright docs: https://playwright.dev

## Questions?

If you encounter issues:
1. Check the troubleshooting section above
2. Review `tests/README.md` for details
3. Inspect test runner logs for errors
4. Verify dev server is accessible at http://localhost:3000

---

**Pro Tip**: Set up a keyboard shortcut to run tests quickly during development!

```bash
# Add to your ~/.bashrc or ~/.zshrc
alias vtest="npm run test:visual"
```

Then just run: `vtest` 🚀
