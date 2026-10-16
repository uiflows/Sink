import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Security unit tests do not require remote bindings or the Workers test pool.
export default defineConfig({
  resolve: {
    alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: {
    pool: 'threads',
    include: ['tests/unit/markdown.spec.ts', 'tests/unit/link-store.spec.ts', 'tests/security/*.spec.ts'],
    setupFiles: [],
  },
})
