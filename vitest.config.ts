import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['.vitepress/**/*.test.ts', 'tests/characterization/**/*.test.ts'],
    exclude: ['node_modules/**', '.vitepress/cache/**', '.vitepress/dist/**', 'tests/ui/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov']
    }
  }
})
