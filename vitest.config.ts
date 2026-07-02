import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['.vitepress/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      '.vitepress/cache/**',
      '.vitepress/dist/**',
      'tests/ui/**'
    ]
  }
})
