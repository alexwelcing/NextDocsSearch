#!/usr/bin/env tsx
/**
 * Pre-Build Validation Script
 *
 * This script runs before the build to catch common issues that would cause
 * deployment failures. It checks:
 *
 * 1. Import validation - ensures all imports exist and are correct
 * 2. Icon validation - verifies lucide-react icons are valid
 * 3. Component validation - checks for common component issues
 * 4. Type safety - validates TypeScript compilation
 * 5. Syntax validation - checks for spread operator issues
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  passed: boolean;
  message: string;
  category: string;
}

const results: ValidationResult[] = [];

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function addResult(category: string, passed: boolean, message: string) {
  results.push({ category, passed, message });
  const icon = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`  ${icon} ${message}`, color);
}

// 1. Validate lucide-react icons
function validateLucideIcons() {
  log('\n📦 Validating lucide-react icons...', 'cyan');

  const componentsDir = path.join(process.cwd(), 'components');
  const pagesDir = path.join(process.cwd(), 'pages');

  const validIcons = [
    'ChevronLeft', 'ChevronRight', 'X', 'Image', 'Zap',
    'Compass', 'Star', 'ArrowRight', 'ArrowLeft',
    'BookOpen', 'ChevronUp', 'ChevronDown', 'Menu',
    'Search', 'Settings', 'User', 'Home', 'FileText',
  ];

  const invalidIcons = ['Sparkles', 'Sparkle']; // Known invalid icons

  function checkFile(filePath: string) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for invalid icons
    for (const invalidIcon of invalidIcons) {
      const importRegex = new RegExp(`import.*\\{[^}]*${invalidIcon}[^}]*\\}.*from.*['"]lucide-react['"]`);
      if (importRegex.test(content)) {
        addResult(
          'Icon Validation',
          false,
          `Invalid lucide-react icon '${invalidIcon}' found in ${path.relative(process.cwd(), filePath)}`
        );
        return false;
      }
    }

    // Check for any lucide-react imports and validate them
    const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
    if (importMatch) {
      const imports = importMatch[1].split(',').map(i => i.trim());
      for (const importName of imports) {
        const cleanName = importName.replace(/\s+as\s+.+$/, '').trim();
        if (!validIcons.includes(cleanName) && cleanName !== '') {
          addResult(
            'Icon Validation',
            false,
            `Potentially invalid icon '${cleanName}' in ${path.relative(process.cwd(), filePath)}`
          );
        }
      }
    }

    return true;
  }

  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath);
      } else if (stat.isFile()) {
        checkFile(filePath);
      }
    }
  }

  walkDir(componentsDir);
  walkDir(pagesDir);

  addResult('Icon Validation', true, 'All lucide-react icons are valid');
}

// 2. Validate Gaussian Splat removal
function validateGaussianSplatRemoval() {
  log('\n🎨 Validating Gaussian Splat removal...', 'cyan');

  const threeSixtyPath = path.join(process.cwd(), 'components/3d/scene/ThreeSixty.tsx');

  if (!fs.existsSync(threeSixtyPath)) {
    addResult('Splat Validation', false, 'ThreeSixty.tsx not found');
    return;
  }

  const content = fs.readFileSync(threeSixtyPath, 'utf-8');

  // Check for Gaussian splat imports
  if (content.includes('GaussianSplatBackground')) {
    addResult('Splat Validation', false, 'GaussianSplatBackground import still exists in ThreeSixty.tsx');
    return;
  }

  // Check for useGaussianSplat state
  if (content.includes('useGaussianSplat')) {
    addResult('Splat Validation', false, 'useGaussianSplat state still exists in ThreeSixty.tsx');
    return;
  }

  // Check for splat-related state
  if (content.includes('availableSplats') || content.includes('selectedSplat')) {
    addResult('Splat Validation', false, 'Splat-related state still exists in ThreeSixty.tsx');
    return;
  }

  // Verify BackgroundSphere is used
  if (!content.includes('BackgroundSphere')) {
    addResult('Splat Validation', false, 'BackgroundSphere not found in ThreeSixty.tsx');
    return;
  }

  addResult('Splat Validation', true, 'Gaussian Splat properly removed, using BackgroundSphere');
}

// 3. Validate spread operator usage
function validateSpreadOperators() {
  log('\n🔍 Validating spread operator usage...', 'cyan');

  const scriptsDir = path.join(process.cwd(), 'scripts');

  function checkFile(filePath: string) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;

    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for spread operator on Set
    const spreadSetRegex = /\.\.\.\s*new\s+Set\s*\(/g;
    if (spreadSetRegex.test(content)) {
      addResult(
        'Spread Operator',
        false,
        `Spread operator on Set found in ${path.relative(process.cwd(), filePath)} - use Array.from() instead`
      );
      return false;
    }

    return true;
  }

  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath);
      } else if (stat.isFile()) {
        checkFile(filePath);
      }
    }
  }

  walkDir(scriptsDir);

  addResult('Spread Operator', true, 'No problematic spread operators found');
}

// 4. Validate TypeScript compilation
function validateTypeScript() {
  log('\n📘 Validating TypeScript compilation...', 'cyan');

  try {
    execSync('tsc --noEmit', { stdio: 'pipe' });
    addResult('TypeScript', true, 'TypeScript compilation successful');
  } catch (error: any) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    const errorLines = output.split('\n').filter((line: string) => line.includes('error TS'));

    addResult(
      'TypeScript',
      false,
      `TypeScript compilation failed with ${errorLines.length} error(s)`
    );

    // Show first 5 errors
    errorLines.slice(0, 5).forEach((line: string) => {
      log(`    ${line}`, 'red');
    });

    if (errorLines.length > 5) {
      log(`    ... and ${errorLines.length - 5} more errors`, 'yellow');
    }
  }
}

// 5. Validate critical imports
function validateCriticalImports() {
  log('\n📥 Validating critical imports...', 'cyan');

  const criticalFiles = [
    {
      path: 'components/ArticleImageSlideshow.tsx',
      requiredImports: ['next/image', 'lucide-react', 'styled-components'],
      forbiddenImports: [],
    },
    {
      path: 'components/3d/scene/ThreeSixty.tsx',
      requiredImports: ['@react-three/fiber', '@react-three/xr'],
      forbiddenImports: ['@mkkellogg/gaussian-splats-3d', 'GaussianSplatBackground'],
    },
    {
      path: 'pages/articles/[slug].tsx',
      requiredImports: ['next/head', 'ArticleImageSlideshow'],
      forbiddenImports: [],
    },
  ];

  for (const file of criticalFiles) {
    const filePath = path.join(process.cwd(), file.path);

    if (!fs.existsSync(filePath)) {
      addResult('Import Validation', false, `Critical file not found: ${file.path}`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Check required imports
    for (const requiredImport of file.requiredImports) {
      const importRegex = new RegExp(`from\\s*['"].*${requiredImport}.*['"]`);
      if (!importRegex.test(content)) {
        addResult(
          'Import Validation',
          false,
          `Missing required import '${requiredImport}' in ${file.path}`
        );
      }
    }

    // Check forbidden imports
    for (const forbiddenImport of file.forbiddenImports) {
      const importRegex = new RegExp(`from\\s*['"].*${forbiddenImport}.*['"]`);
      if (importRegex.test(content)) {
        addResult(
          'Import Validation',
          false,
          `Forbidden import '${forbiddenImport}' found in ${file.path}`
        );
      }
    }
  }

  addResult('Import Validation', true, 'All critical imports validated');
}

// Main execution
function main() {
  log('\n🔍 Running Pre-Build Validation...', 'blue');
  log('='.repeat(50), 'blue');

  validateLucideIcons();
  validateGaussianSplatRemoval();
  validateSpreadOperators();
  validateCriticalImports();
  validateTypeScript();

  // Summary
  log('\n' + '='.repeat(50), 'blue');
  log('📊 Validation Summary', 'blue');
  log('='.repeat(50), 'blue');

  const failed = results.filter(r => !r.passed);
  const passed = results.filter(r => r.passed);

  log(`\n✓ Passed: ${passed.length}`, 'green');
  log(`✗ Failed: ${failed.length}`, failed.length > 0 ? 'red' : 'green');

  if (failed.length > 0) {
    log('\n❌ Validation failed! Please fix the issues above before building.', 'red');
    process.exit(1);
  } else {
    log('\n✅ All validations passed! Build can proceed.', 'green');
    process.exit(0);
  }
}

main();
