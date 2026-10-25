import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // Every *.test.ts(x) in the repo is picked up, so new suites never need to edit this file.
    include: ['**/*.test.{ts,tsx}'],
    // Extends vitest's defaults (node_modules, dist, .git, ...) rather than replacing them. .claude
    // holds nested agent worktrees, whose copies of the suites must not run a second time.
    exclude: [
      ...configDefaults.exclude,
      '**/.next/**',
      '**/out/**',
      '**/.wrangler/**',
      '**/.claude/**',
      '**/.venv/**',
      'research/**',
    ],
  },
})
