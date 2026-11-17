import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'

describe('real Nexus read failure', () => {
  beforeAll(async () => {
    await commands.launchDsh()
    await commands.openDshPage()
  })
  afterAll(async () => {
    await commands.closeDsh()
  })
  it('distinguishes an actual unauthenticated read from an empty ledger and recovers', async () => {
    const result = await commands.inDsh('read-error')
    expect(result.ok, result.detail).toBe(true)
    const errors = await commands.getDshErrors()
    expect(errors).toHaveLength(3)
    expect(errors).toEqual(expect.arrayContaining(['401 /api/nexus/panel', 'Failed to load resource: the server responded with a status of 401 ()', 'Error: owner_required']))
  })
})
