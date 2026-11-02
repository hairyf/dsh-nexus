import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'test/e2e/**/*.test.ts',
      'test/e2e/**/*.spec.ts',
      'test/e2e/**/*.test.tsx',
      'test/e2e/**/*.spec.tsx',
    ],
    testTimeout: 180_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    sequence: {
      groupOrder: 1,
    },
  },
})
