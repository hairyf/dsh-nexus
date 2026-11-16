import process from 'node:process'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { closeDsh, getDshErrors, inDsh, launchDsh, openDshPage } from './test/__setup__/commands'

export default defineConfig({
  test: {
    name: 'e2e',
    include: [
      'test/e2e/**/*.test.ts',
      'test/e2e/**/*.spec.ts',
      'test/e2e/**/*.test.tsx',
      'test/e2e/**/*.spec.tsx',
    ],
    testTimeout: 180_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    maxConcurrency: 1,
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright({ launchOptions: { executablePath: process.env.DSH_E2E_CHROMIUM_EXECUTABLE } }),
      instances: [{ browser: 'chromium' }],
      commands: {
        launchDsh,
        openDshPage,
        getDshErrors,
        closeDsh,
        inDsh,
      },
    },
    sequence: {
      groupOrder: 1,
    },
  },
})
