import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextVitals,
  {
    // The current R3F/Three.js scene code intentionally mutates refs, cameras,
    // materials, uniforms, and generated buffers inside animation hooks. The
    // React compiler purity rules flag those imperative graphics patterns as
    // component-purity violations even though they are expected for Three.js.
    // Keep these rules disabled until the 3D scene is refactored behind
    // compiler-friendly wrappers; otherwise `pnpm run lint` is dominated by
    // pre-existing false positives and stops catching actionable regressions.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'public/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
]

export default config
