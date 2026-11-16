import type { Context } from '@deepseek-ai/cordis'
import { afterEach, expect, it, vi } from 'vitest'
import { createSessionGateway } from '../src/runtime/session-gateway'

afterEach(() => vi.restoreAllMocks())

function fixture() {
  const idle = Promise.withResolvers<void>()
  const entered = Promise.withResolvers<void>()
  const events: unknown[] = []
  const calls: string[] = []
  const messages: { source?: unknown }[] = []
  let live = true
  const agent = {
    status: 'idle',
    session: { header: { cwd: '/isolated/runtime-worker' } },
    inbox: { nextStep: [] as { source?: unknown }[], nextTurn: [] as { source?: unknown }[] },
    whenIdle: () => {
      entered.resolve()
      return idle.promise
    },
    cancel: () => { calls.push('cancel') },
    followup: (message: { source?: unknown }) => {
      calls.push('followup')
      messages.push(message)
    },
    inject: (message: { source?: unknown }) => {
      calls.push('inject')
      agent.inbox.nextStep.push(message)
    },
  }
  const handle = {
    agent,
    dispose: async () => {
      calls.push('dispose')
      live = false
    },
  }
  const services = {
    agents: {
      get: () => live ? agent : undefined,
      create: async (options: { setup: (ctx: unknown) => Promise<void>, meta: { cwd: string, agentPreset: string }, agentOptions: { provider: string, model: string } }) => {
        expect(options.meta).toEqual({ cwd: '/isolated/runtime-worker', agentPreset: 'worker' })
        expect(options.agentOptions.provider).toBe('test-provider')
        expect(options.agentOptions.model).toBe('test-model')
        await options.setup({})
        calls.push('create')
        return handle
      },
      resume: async () => handle,
    },
    agentDefaultModel: { currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }) },
    agentPresets: { resolve: async () => ({ broken: false }), mount: async () => { calls.push('mount') } },
    sessionQuery: { readSession: async () => ({ session: agent.session.header, events }) },
  }
  const ctx = { get: (name: keyof typeof services) => services[name] } as unknown as Context
  return {
    ctx,
    agent,
    calls,
    messages,
    events,
    idle,
    entered,
    detach: () => { live = false },
  }
}

it('mounts the resolved preset and preserves host provenance without impersonating a human', async () => {
  const { ctx, calls, messages } = fixture()
  const gateway = createSessionGateway(ctx, async () => true)
  await gateway.create('worker', 'worker', '/isolated/runtime-worker')
  expect(calls).toEqual(['mount', 'create'])
  await gateway.deliver('worker', { id: 'M1', source: 'human:web:verified', content: 'human intervention' }, 'interrupt')
  expect(calls).toEqual(['mount', 'create', 'cancel', 'followup'])
  expect(messages[0].source).toEqual({ kind: 'nexus', messageId: 'M1', source: 'human:web:verified' })
})

it('reports queued input as unread until a durable user/message event actually exists', async () => {
  const { ctx, calls, events } = fixture()
  const gateway = createSessionGateway(ctx, async () => true)
  await gateway.deliver('worker', { id: 'M1', source: 'host:test', content: 'progress' }, 'queue')
  expect(calls).toEqual(['inject'])
  expect(await gateway.receipt('worker', 'M1')).toBe('queued')
  events.push({ type: 'user/message', data: { source: { kind: 'nexus', messageId: 'M1', source: 'host:test' } } })
  expect(await gateway.receipt('worker', 'M1')).toBe('read')
  expect(await gateway.receipt('worker', 'M2')).toBe('absent')
})

it('requires whole-agent quiescence and positive writer closure before disposing an idle-looking agent', async () => {
  const { ctx, calls, entered, idle } = fixture()
  let writersStopped = false
  const gateway = createSessionGateway(ctx, async () => {
    calls.push('writers')
    return writersStopped
  })
  await gateway.create('worker', 'worker', '/isolated/runtime-worker')
  const stopping = gateway.stop('worker', 'management pause')
  await entered.promise
  expect(calls).toEqual(['mount', 'create', 'cancel'])
  await expect(gateway.deliver('worker', { id: 'blocked', source: 'host:test', content: 'do not resume' }, 'wake')).rejects.toMatchObject({ code: 'execution_stop_pending' })
  idle.resolve()
  expect(await stopping).toBe(false)
  expect(calls).not.toContain('dispose')
  writersStopped = true
  expect(await gateway.stop('worker', 'verified retirement')).toBe(true)
  expect(calls.at(-1)).toBe('dispose')
  expect(await gateway.stop('worker', 'external writer closure remains verified')).toBe(true)
})

it('interrupts stop waiting without claiming the old execution stopped', async () => {
  const { ctx, calls, entered, idle } = fixture()
  const gateway = createSessionGateway(ctx, async () => true)
  await gateway.create('worker', 'worker', '/isolated/runtime-worker')
  const controller = new AbortController()
  const stopping = gateway.stop('worker', 'stop', controller.signal)
  await entered.promise
  controller.abort()
  await expect(stopping).rejects.toMatchObject({ code: 'interrupted_tool' })
  expect(calls).not.toContain('dispose')
  idle.resolve()
})

it('requires explicit external closure proof for an absent process after restart', async () => {
  const { ctx, detach } = fixture()
  let verified = false
  const gateway = createSessionGateway(ctx, async () => verified)
  expect(await gateway.stop('worker', 'unowned live agent')).toBe(false)
  detach()
  expect(await gateway.stop('worker', 'missing agent alone is not proof')).toBe(false)
  verified = true
  expect(await gateway.stop('worker', 'writer ownership positively reconciled')).toBe(true)
})
