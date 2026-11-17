import type { DshProbe } from '../__setup__/commands'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'

declare module 'vitest/browser' {
  interface BrowserCommands {
    launchDsh: () => Promise<{ baseUrl: string }>
    openDshPage: () => Promise<{ url: string }>
    inDsh: (probe: DshProbe) => Promise<{ ok: boolean, detail: string }>
    getDshErrors: () => Promise<string[]>
    closeDsh: () => Promise<void>
  }
}

describe('nexus in the authenticated real DSH shell', () => {
  let openedUrl = ''
  let baseUrl = ''
  beforeAll(async () => {
    baseUrl = (await commands.launchDsh()).baseUrl
    openedUrl = (await commands.openDshPage()).url
  })
  afterAll(async () => {
    await commands.closeDsh()
  })

  it('opens the isolated authenticated origin without exposing a launch token', async () => {
    const url = new URL(openedUrl)
    expect(url.origin).toBe(baseUrl)
    expect(url.pathname).toBe('/')
    expect(url.search).toBe('')
    expect(await commands.getDshErrors()).toEqual([])
  })

  it.each([
    ['sidebar', 'exposes the installed Nexus entry'],
    ['tabs', 'exposes all five named sections without an inbox tab'],
    ['switch', 'navigates to every associated tab panel'],
    ['inbox', 'reads the real ledger into the overview'],
    ['empty', 'shows an actionable empty ledger rather than hiding a read failure'],
    ['keyboard', 'supports the tab keyboard map'],
    ['theme', 'renders distinct light and dark system themes'],
  ] as const)('%s: %s', async (probe, _behavior) => {
    const result = await commands.inDsh(probe)
    expect(result.ok, result.detail).toBe(true)
    expect(await commands.getDshErrors()).toEqual([])
  })
})
