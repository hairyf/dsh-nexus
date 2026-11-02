import type { Browser, Page } from 'playwright'
import type { ShellScaffold } from '../__setup__/shell.ts'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HAS_DSH, launchShell, logs, openShellPage } from '../__setup__/shell'

describe.skipIf(!HAS_DSH)('dSH shell smoke test', () => {
  let scaffold!: ShellScaffold
  let browser!: Browser
  let page!: Page
  let consoleTripwire: ReturnType<typeof logs>

  beforeAll(async () => {
    scaffold = await launchShell()
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
    consoleTripwire = logs(page)
    await openShellPage(page, scaffold)
  })

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('opens the DSH web shell in Chromium', () => {
    expect(new URL(page.url()).origin).toBe(new URL(scaffold.baseUrl).origin)
    expect(consoleTripwire.errors()).toEqual([])
  })
})
