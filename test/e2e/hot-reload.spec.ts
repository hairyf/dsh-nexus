import { afterAll, beforeAll, expect, it } from 'vitest'
import { commands } from 'vitest/browser'

beforeAll(async () => {
  await commands.launchDsh()
  await commands.openDshPage()
})
afterAll(async () => {
  await commands.closeDsh()
})
it('reloads Nexus alone while preserving the opened source session and pending ask', async () => {
  const result = await commands.inDsh('hot-reload')
  expect(result.ok, result.detail).toBe(true)
  expect(await commands.getDshErrors()).toEqual([])
})
