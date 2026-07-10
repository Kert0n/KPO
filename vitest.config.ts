import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['.vitepress/**/*.test.ts'],
    exclude: ['node_modules/**', '.vitepress/cache/**', '.vitepress/dist/**', 'tests/ui/**'],
    coverage: {
      provider: 'v8',
      include: [
        '.vitepress/shared/**/*.ts',
        '.vitepress/lib/**/*.ts',
        '.vitepress/markdown/**/*.ts',
        '.vitepress/theme/lib/**/*.ts'
      ],
      exclude: [
        '**/__tests__/**',
        '.vitepress/theme/lib/adaptiveTables.ts',
        '.vitepress/lib/askAiContext.ts',
        '.vitepress/lib/askAiContextPlugin.ts'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
})
