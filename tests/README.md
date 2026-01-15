# Test Suite Documentation

This directory contains comprehensive tests to ensure code quality and prevent deployment failures.

## Test Structure

```
tests/
├── pages/articles/
│   └── article-page.test.tsx
└── README.md

components/
├── __tests__/
│   └── ArticleImageSlideshow.test.tsx
└── 3d/scene/__tests__/
    └── ThreeSixty.test.tsx

scripts/
└── pre-build-validation.ts
```

## Running Tests

### Run all tests
```bash
pnpm test
```

### Watch mode (reruns on file changes)
```bash
pnpm test:watch
```

### UI mode (interactive test runner)
```bash
pnpm test:ui
```

### Coverage report
```bash
pnpm test:coverage
```

## Pre-Build Validation

The pre-build validation script runs automatically before every build.

### Manual validation
```bash
pnpm run validate:prebuild
```

### What it checks:

1. **Icon Validation** - Ensures all lucide-react icons are valid
2. **Gaussian Splat Removal** - Verifies splats are removed from ThreeSixty
3. **Spread Operator** - Detects problematic [...new Set()] usage
4. **TypeScript Compilation** - Runs tsc --noEmit
5. **Critical Imports** - Validates required/forbidden imports

## Test Categories

- **Component Tests**: Unit tests for individual components
- **Integration Tests**: Tests for full page rendering
- **Validation Scripts**: Pre-build checks

## CI/CD Integration

Tests run automatically before every build via the `prebuild` hook.

For full documentation, see the main README.
