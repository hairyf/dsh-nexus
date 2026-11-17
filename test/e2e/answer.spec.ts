import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'

describe('model-backed Nexus Web answer', () => {
  beforeAll(async () => {
    await commands.launchDsh()
    await commands.openDshPage()
  })
  afterAll(async () => {
    await commands.closeDsh()
  })
  it('opens the existing sidechat on the real source without answering the ask', async () => {
    const result = await commands.inDsh('sidechat')
    expect(result.ok, result.detail).toBe(true)
    expect(await commands.getDshErrors()).toEqual([])
  })
  it('answers a real Flash main question through the decision form exactly once', async () => {
    const result = await commands.inDsh('answer')
    expect(result.ok, result.detail).toBe(true)
    expect(await commands.getDshErrors()).toEqual([])
  })
})
