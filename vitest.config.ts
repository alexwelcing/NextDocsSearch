import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/archive/**/*.test.ts', 'lib/retrieval/**/*.test.ts', 'components/immersive/dock/tabs/*.test.tsx'],
  },
})
