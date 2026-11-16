import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { NexusDatabase } from '../src/database'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { agents } from '../src/ai'
import { createCommunicationInstaller } from '../src/communication/install'
import { openDatabase } from '../src/database'
import { communication } from '../src/service/communication'
import { ledger } from '../src/service/ledger'
import { runtime } from '../src/service/runtime'

const directories: string[] = []
const databases: NexusDatabase[] = []
afterEach(async () => {
  for (const db of databases.splice(0))
    db.close()
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true })
  vi.restoreAllMocks()
})

it('installs only two communication verbs for trusted roles and keeps native helper scopes untouched', async () => {
  const directory = join(import.meta.dirname, '../.temp', `communication-install-${randomUUID()}`)
  directories.push(directory)
  await mkdir(directory, { recursive: true })
  const db = await openDatabase(directory)
  databases.push(db)
  const human = { kind: 'web', authenticated: true, userId: 'owner' } as const
  const sessions = new Map<string, { state: 'idle', origin?: string, parentSession?: string }>()
  const run = runtime.create(db, {
    inspect: async id => sessions.get(id) ?? { state: 'missing' },
    create: async (id) => { sessions.set(id, { state: 'idle' }) },
    resume: async () => {},
    deliver: async () => {},
    receipt: async () => 'absent',
    cancel: async () => {},
    stop: async () => true,
  }, { timeout: () => () => {} }, directory)
  await run.bind({ id: 'main', role: 'main', sessionId: 's-main' })
  ledger.createProject(db, { id: 'p', name: 'P', workspaceId: 'p', directory, remoteUrl: 'https://github.com/org/p', available: true })
  ledger.updateProject(db, 'p', true, human)
  await run.bind({ id: 'project', role: 'project', sessionId: 's-project', projectId: 'p' })
  ledger.createTicket(db, { id: 'T', projectId: 'p', channelId: 'test', title: 'T', authorization: 'fix', acceptanceCriteria: 'test passes' }, human)
  ledger.bindRole(db, { id: 'worker', role: 'worker', sessionId: 's-worker', projectId: 'p', ticketId: 'T', repository: 'github.com/org/p', branch: 'ticket/T', worktree: join(directory, 'worker') }, { kind: 'agent', sessionId: 's-project' })
  ledger.bindRole(db, { id: 'supervisor', role: 'supervisor', sessionId: 's-supervisor', supervisorId: 'S', ticketIds: ['T'] }, { kind: 'agent', sessionId: 's-main' })
  sessions.set('s-worker', { state: 'idle' })
  sessions.set('s-supervisor', { state: 'idle' })
  const nativeCalls: unknown[] = []
  const nativeContexts: ToolRunContext[] = []
  const nativeError = new Error('native_permission_denied')
  const native = async (args: unknown, exec: ToolRunContext) => {
    if ((args as { agent_id: string }).agent_id === 'native-forbidden')
      throw nativeError
    nativeContexts.push(exec)
    nativeCalls.push({ args, sessionId: exec.agent!.session.id })
    return { messageId: 'native-receipt' }
  }
  const installer = createCommunicationInstaller(communication.create(db, run), native)
  for (const role of ['main', 'project', 'supervisor', 'worker']) {
    const binding = ledger.load(db, 'role_binding', role)!
    const scope = new Map<string, ToolDefinition>()
    const ctx = { tools: { register: (tool: ToolDefinition) => {
      if (scope.has(tool.name))
        throw new Error('duplicate')
      scope.set(tool.name, tool)
      return () => scope.delete(tool.name)
    } } }
    const detach = await installer.attach(ctx, binding)
    expect([...scope.keys()].filter(name => ['ask', 'send_message', 'report', 'answer', 'escalate', 'ask_user', 'send', 'reply_channel'].includes(name))).toEqual(['ask', 'send_message'])
    expect(await installer.attach(ctx, binding)).toBe(detach)
    const exec = { agent: { session: { id: binding.sessionId } }, signal: new AbortController().signal, callId: 'native-call' } as unknown as ToolRunContext
    expect(await scope.get('send_message')!.execute({ agent_id: 'native-child', message: 'continue' }, exec)).toEqual({ messageId: 'native-receipt' })
    expect(nativeContexts.at(-1)).toBe(exec)
    await expect(scope.get('send_message')!.execute({ agent_id: 'native-forbidden', message: 'continue' }, exec)).rejects.toBe(nativeError)
    await expect(scope.get('send_message')!.execute({ agent_id: 'native-child', to: 'role:project', message: 'conflict' }, exec)).rejects.toMatchObject({ code: 'address_conflict' })
    detach!()
    expect(scope.size).toBe(0)
  }
  expect(nativeCalls).toEqual(['main', 'project', 'supervisor', 'worker'].map(role => ({ args: { agent_id: 'native-child', message: 'continue' }, sessionId: `s-${role}` })))
  expect(ledger.list(db, 'message')).toHaveLength(0)
  for (const definition of Object.values(agents))
    expect(definition.tools.filter(tool => ['report', 'answer', 'escalate', 'ask_user', 'send', 'reply_channel'].includes(tool.name))).toEqual([])
  const register = vi.fn()
  expect(await installer.attach({ tools: { register } }, undefined)).toBeNull()
  expect(register).not.toHaveBeenCalled()
  sessions.set('s-worker', { state: 'idle', origin: 'subagent', parentSession: 's-project' })
  await expect(installer.attach({ tools: { register } }, ledger.load(db, 'role_binding', 'worker')!)).rejects.toMatchObject({ code: 'unknown_binding' })
  expect(register).not.toHaveBeenCalled()
  expect(ledger.list(db, 'role_binding').filter(binding => binding.role === 'worker')).toHaveLength(1)
  await run.dispose()
})

it('does not install Nexus role tools on a same-preset helper or sidechat from the host entry point', async () => {
  const { apply } = await import('../src')
  const listeners = new Map<string, ((event: unknown) => unknown)[]>()
  const effects: Promise<unknown>[] = []
  const native = { name: 'send_message', marker: 'original-native-parent-child-definition' }
  const scope = new Map<string, unknown>([['send_message', native]])
  const ctx = {
    get: () => ({ register: async () => () => {} }),
    effect: (operation: () => unknown) => { effects.push(Promise.resolve(operation())) },
    on: (name: string, handler: (event: unknown) => unknown) => { listeners.set(name, [...listeners.get(name) ?? [], handler]) },
  }
  await apply(ctx as never)
  await Promise.all(effects)
  const child = {
    session: { id: 'native-child', header: { agentPreset: 'worker', origin: 'subagent', parentSession: 'parent' } },
    ctx: {
      effect: (operation: () => unknown) => operation(),
      tools: { register: (tool: ToolDefinition) => {
        scope.set(tool.name, tool)
        return () => scope.delete(tool.name)
      } },
    },
  }
  for (const handler of listeners.get('agent/created') ?? [])
    await handler({ agent: child })
  child.session.header.origin = 'sidechat'
  for (const handler of listeners.get('agent/created') ?? [])
    await handler({ agent: child })
  expect([...scope.keys()]).toEqual(['send_message'])
  expect(scope.get('send_message')).toBe(native)
})
