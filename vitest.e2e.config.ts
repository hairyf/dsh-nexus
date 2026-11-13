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
    // 两个 spec 都会各自 build + 装插件，并行会互相覆盖 dist 并争用同一个 profile
    fileParallelism: false,
    // 项目内也只跑一个文件的同时实例：launchShell 里有 pnpm build + pack
    maxConcurrency: 1,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
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
