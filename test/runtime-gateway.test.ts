import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
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
    session: { header: { cwd: '/isolated/runtime-worker' }, snapshotEvents: () => events },
    inbox: {
      nextStep: [] as { id?: string, source?: unknown }[],
      nextTurn: [] as { id?: string, source?: unknown }[],
      remove: (id: string): boolean => {
        for (const queue of [agent.inbox.nextStep, agent.inbox.nextTurn]) {
          const index = queue.findIndex(message => message.id === id)
          if (index >= 0) {
            queue.splice(index, 1)
            return true
          }
        }
        return false
      },
    },
    send: (message: { source?: unknown }, target: 'next-turn' | 'next-step', _wakeup: boolean): void => {
      calls.push('send')
      agent.inbox[target === 'next-turn' ? 'nextTurn' : 'nextStep'].push(message)
    },
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
    sessionQuery: { readSession: vi.fn(async () => ({ session: agent.session.header, events })) },
  }
  const ctx = { get: (name: keyof typeof services) => services[name] } as unknown as Context
  return {
    ctx,
    services,
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

it('keeps an accepted native pre-step claim queued until its durable user message exists', async () => {
  const { ctx, agent, events, calls } = fixture()
  const gateway = createSessionGateway(ctx, async () => true)
  agent.status = 'running'
  await gateway.deliver('worker', { id: 'first', content: 'one', source: 'topic:one' }, 'wake')
  await gateway.deliver('worker', { id: 'second', content: 'two', source: 'topic:two' }, 'interrupt')
  expect(await gateway.receipt('worker', 'first')).toBe('queued')
  expect(await gateway.receipt('worker', 'second')).toBe('queued')
  expect(calls).toEqual(['followup', 'cancel', 'followup'])
  events.push({ type: 'user/message', data: { source: { kind: 'nexus', messageId: 'second' } } })
  expect(await gateway.receipt('worker', 'second')).toBe('read')
  agent.status = 'idle'
  expect(await gateway.receipt('worker', 'first')).toBe('absent')
  agent.status = 'running'
  expect(await gateway.receipt('worker', 'first')).toBe('absent')
})

it('observes live native journal and inbox synchronously rather than mixing cold and live cuts', async () => {
  const { ctx, services, events } = fixture()
  const gateway = createSessionGateway(ctx, async () => true)
  services.sessionQuery.readSession.mockRejectedValue(new Error('Cold query must not read a live agent'))
  events.push({ type: 'user/message', data: { source: { kind: 'nexus', messageId: 'committed' } } })
  expect(await gateway.receipt('worker', 'committed')).toBe('read')
  expect(await gateway.receipt('worker', 'missing')).toBe('absent')
  expect(services.sessionQuery.readSession).not.toHaveBeenCalled()
})

it.each(['next-turn', 'next-step'] as const)('wakes restored Nexus input at its original %s boundary without changing identities or order', async (target) => {
  const { ctx, agent } = fixture()
  const first = createUserMessage({ content: [{ type: 'text', text: 'original Nexus input' }], source: { kind: 'nexus', messageId: 'restored', source: 'topic:restored' } })
  const last = createUserMessage({ content: [{ type: 'text', text: 'last native input' }], source: { kind: 'user' } })
  const queue = agent.inbox[target === 'next-turn' ? 'nextTurn' : 'nextStep']
  queue.push(first, last)
  const send = vi.spyOn(agent, 'send')
  const remove = vi.spyOn(agent.inbox, 'remove')
  const gateway = createSessionGateway(ctx, async () => true)
  await gateway.resume('worker', 'worker')
  expect(remove).toHaveBeenCalledExactlyOnceWith(last.id)
  expect(send).toHaveBeenCalledExactlyOnceWith(last, target, true)
  expect(queue).toEqual([first, last])
  queue.shift()
  agent.status = 'running'
  expect(await gateway.receipt('worker', 'restored')).toBe('queued')
})

it('does not wake unrelated parked native input when no Nexus delivery is pending', async () => {
  const { ctx, agent } = fixture()
  agent.inbox.nextTurn.push(createUserMessage({ content: [{ type: 'text', text: 'native-only input' }], source: { kind: 'user' } }))
  const send = vi.spyOn(agent, 'send')
  await createSessionGateway(ctx, async () => true).resume('worker', 'worker')
  expect(send).not.toHaveBeenCalled()
})

it('reconstructs cold receipts only from durable facts and never masks query failures', async () => {
  const { ctx, services, events, detach } = fixture()
  const gateway = createSessionGateway(ctx, async () => true)
  detach()
  events.push({ type: 'user/message', data: { source: { kind: 'nexus', messageId: 'cold' } } })
  expect(await gateway.receipt('worker', 'cold')).toBe('read')
  expect(await gateway.receipt('worker', 'missing')).toBe('absent')
  services.sessionQuery.readSession.mockRejectedValue(new Error('Journal unavailable'))
  await expect(gateway.receipt('worker', 'cold')).rejects.toThrow('Journal unavailable')
})
