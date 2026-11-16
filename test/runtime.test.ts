import type { NexusDatabase } from '../src/database'
import type { HostTimers, SessionGateway, SessionSnapshot } from '../src/runtime/types'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase } from '../src/database'
import { ledger } from '../src/service/ledger'
import { runtime } from '../src/service/runtime'

let db: NexusDatabase
let directory: string
const execute = promisify(execFile)
const human = { kind: 'web', authenticated: true, userId: 'test-human' } as const

class Sessions implements SessionGateway {
  sessions = new Map<string, SessionSnapshot>()
  deliveries: string[] = []
  modes: string[] = []
  receipts = new Map<string, 'queued' | 'read'>()
  creates: string[] = []
  cancellations: string[] = []
  stopResult = true
  async inspect(id: string): Promise<SessionSnapshot> {
    return this.sessions.get(id) ?? { state: 'missing' }
  }

  async create(id: string, _preset: string, cwd: string): Promise<void> {
    this.creates.push(id)
    this.sessions.set(id, { state: 'idle', cwd })
  }

  async resume(id: string): Promise<void> {
    this.sessions.set(id, { ...this.sessions.get(id), state: 'idle' })
  }

  async deliver(_id: string, message: { id: string }, mode: string): Promise<void> {
    this.deliveries.push(message.id)
    this.modes.push(mode)
    this.receipts.set(message.id, 'queued')
  }

  async receipt(_id: string, messageId: string): Promise<'absent' | 'queued' | 'read' | 'unknown'> {
    return this.receipts.get(messageId) ?? 'absent'
  }

  async cancel(id: string): Promise<void> {
    this.cancellations.push(id)
  }

  async stop(id: string): Promise<boolean> {
    this.cancellations.push(id)
    return this.stopResult && this.sessions.get(id)?.state === 'idle'
  }
}

beforeEach(async () => {
  directory = join(import.meta.dirname, '../.temp', `runtime-${randomUUID()}`)
  await mkdir(directory, { recursive: true })
  db = await openDatabase(directory)
})
afterEach(async () => {
  if (db.initialized)
    db.close()
  vi.useRealTimers()
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

async function fixture(maxWorkers = 2, timers: HostTimers = { timeout: () => () => {} }) {
  const sessions = new Sessions()
  const run = runtime.create(db, sessions, timers, join(directory, 'managers'))
  await run.bind({ id: 'main', role: 'main', sessionId: 's-main' })
  for (const id of ['p', 'q']) {
    const root = join(directory, id)
    await mkdir(root)
    await execute('git', ['init', '-b', 'main'], { cwd: root })
    await execute('git', ['commit', '--allow-empty', '-m', 'fixture'], { cwd: root })
    await execute('git', ['remote', 'add', 'origin', `https://github.com/org/${id}.git`], { cwd: root })
    ledger.createProject(db, { id, name: id, workspaceId: id, directory: root, remoteUrl: `https://github.com/org/${id}.git`, available: true })
    ledger.updateProject(db, id, true, human)
    await run.bind({ id: `manager-${id}`, role: 'project', sessionId: `s-${id}`, projectId: id })
    ledger.createTicket(db, { id: id.toUpperCase(), projectId: id, channelId: 'test', title: id, authorization: 'fix isolated bug', acceptanceCriteria: 'regression passes' }, human)
  }
  ledger.updateSettings(db, { maxWorkers }, human)
  return { run, sessions }
}

it('binds one durable main before spawning and never adopts a native helper', async () => {
  const sessions = new Sessions()
  const run = runtime.create(db, sessions, { timeout: () => () => {} }, join(directory, 'managers'))
  const [first, second] = await Promise.all([run.bind({ id: 'main', role: 'main', sessionId: 's-main' }), run.bind({ id: 'main', role: 'main', sessionId: 's-main' })])
  expect(first.id).toBe(second.id)
  expect(ledger.list(db, 'role_binding')).toHaveLength(1)
  expect(sessions.sessions.size).toBe(1)
  sessions.sessions.set('helper', { state: 'idle', cwd: directory, parentSession: 's-main', origin: 'subagent' })
  await expect(run.resolve('helper')).rejects.toMatchObject({ code: 'unknown_binding' })
  expect(await run.resolve('s-main')).toMatchObject({ binding: { role: 'main' }, session: { cwd: join(directory, 'managers', 'main') } })
})

it('separates accepted dispatch from isolated start and enforces global worker admission', async () => {
  const { run, sessions } = await fixture(1)
  expect(await run.dispatch('P', human)).toMatchObject({ accepted: true, started: false, ticket: { status: 'queued', startedAt: null } })
  const started = await run.start('P', human)
  expect(started).toMatchObject({ started: true, binding: { role: 'worker', projectId: 'p', ticketId: 'P' } })
  const binding = ledger.list(db, 'role_binding').find(item => item.role === 'worker')!
  expect(binding.baseCommit).toMatch(/^[a-f0-9]{40}$/)
  expect(binding.worktree).not.toBe(join(directory, 'p'))
  expect(sessions.sessions.get(binding.sessionId)!.cwd).toBe(binding.worktree)
  expect(await run.start('Q', human)).toMatchObject({ accepted: true, started: false, reason: 'worker_limit' })
  expect(ledger.list(db, 'role_binding').filter(item => item.role === 'worker')).toHaveLength(1)
  expect(ledger.load(db, 'ticket', 'Q')).toMatchObject({ status: 'queued', startedAt: null })
})

it('coalesces concurrent starts and leaves unrelated projects usable during a pending ask', async () => {
  const { run, sessions } = await fixture()
  await Promise.all([run.start('P', human), run.start('P', human)])
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  ledger.createAsk(db, { id: 'A', ticketIds: ['P'], source: 'test', content: 'Which choice?', decisionType: 'ordinary', withinAuthorization: true, options: ['one', 'two'] }, { kind: 'agent', sessionId: worker.sessionId })
  expect(await run.suspend(worker.sessionId, 'A')).toEqual({ status: 'pending', askId: 'A' })
  expect(sessions.cancellations).toEqual([worker.sessionId])
  expect(await run.start('Q', human)).toMatchObject({ started: true })
  expect(ledger.list(db, 'role_binding').filter(item => item.role === 'worker')).toHaveLength(2)
  expect(ledger.load(db, 'ask', 'A')).toMatchObject({ status: 'pending' })
})

it('does not replace an execution after a stop request while it may still write', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  sessions.sessions.set(worker.sessionId, { state: 'running', cwd: worker.worktree! })
  expect(await run.pause('P', true, 'human pause', human)).toMatchObject({ stopped: false, reason: 'execution_stop_unconfirmed' })
  expect(ledger.load(db, 'role_binding', worker.id)!.status).not.toBe('closed')
  await expect(run.retry('P', 'retry', human, async () => 'verified')).rejects.toMatchObject({ code: 'execution_conflict' })
  expect(sessions.creates).toHaveLength(4)
  expect(ledger.load(db, 'ticket', 'P')).toMatchObject({ paused: 1 })
})

it('does not treat idle or accepted cancellation as proof that all writers stopped', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  sessions.stopResult = false
  expect(await run.cancel('P', 'stop all writers', human)).toMatchObject({ stopped: false, reason: 'execution_stop_unconfirmed' })
  expect(ledger.load(db, 'role_binding', worker.id)!.status).not.toBe('closed')
  expect(ledger.list(db, 'ticket_transition').filter(item => item.event === 'execution_stopped')).toHaveLength(0)
})

it('retains uncommitted work through cancellation and never treats turn completion as ticket completion', async () => {
  const { run } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  await writeFile(join(worker.worktree!, 'unfinished.txt'), 'keep me')
  expect(await run.cancel('P', 'stop requested', human)).toMatchObject({ stopped: true, ticket: { status: 'cancelled' } })
  expect(await readFile(join(worker.worktree!, 'unfinished.txt'), 'utf8')).toBe('keep me')
  expect(ledger.load(db, 'role_binding', worker.id)).toMatchObject({ status: 'closed' })
})

it('keeps accepted delivered read and handled distinct and suppresses duplicate event delivery', async () => {
  const { run, sessions } = await fixture()
  const input = { id: 'event-1', source: 'verified-source:1', recipient: 'manager-p', ticketId: 'P', kind: 'ticket' as const, content: 'dependency changed' }
  await Promise.all([run.intake(input), run.intake(input)])
  expect(sessions.deliveries).toEqual(['event-1'])
  expect(ledger.load(db, 'message', 'event-1')).toMatchObject({ source: 'verified-source:1', ticketId: 'P', readAt: null, handledAt: null, deliveryState: 'delivered' })
  await expect(run.read('s-p', 'event-1')).rejects.toMatchObject({ code: 'not_read' })
  sessions.receipts.set('event-1', 'read')
  expect(await run.read('s-p', 'event-1')).toMatchObject({ readAt: expect.any(String), handledAt: null })
  expect(await run.handled('s-p', 'event-1')).toMatchObject({ handledAt: expect.any(String) })
})

it('queues ordinary worker progress without cancellation but interrupts a busy manager', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  sessions.sessions.set(worker.sessionId, { state: 'running', cwd: worker.worktree! })
  sessions.sessions.set('s-p', { state: 'running', cwd: join(directory, 'managers', 'manager-p') })
  await run.intake({ id: 'worker-progress', recipient: worker.id, ticketId: 'P', source: 'host:progress', kind: 'message', content: 'CI still running' })
  await run.intake({ id: 'manager-event', recipient: 'manager-p', ticketId: 'P', source: 'host:ask', kind: 'ask', content: 'pending ask' })
  expect(sessions.modes).toEqual(['wake', 'queue', 'interrupt'])
  expect(sessions.cancellations).toEqual([])
})

it('preserves pending delivery and responsibility when the actual session is closed', async () => {
  const { run, sessions } = await fixture()
  sessions.sessions.set('s-p', { state: 'closed' })
  await expect(run.intake({ id: 'closed-event', recipient: 'manager-p', ticketId: 'P', source: 'host:test', kind: 'human', content: 'please check' })).rejects.toMatchObject({ code: 'closed_session' })
  expect(ledger.load(db, 'message', 'closed-event')).toMatchObject({ readAt: null, handledAt: null, attempts: 1, error: 'closed_session' })
  expect(ledger.load(db, 'role_binding', 'manager-p')).toMatchObject({ role: 'project', status: 'idle' })
})

it('recovers the same execution idempotently without spawning or replaying context', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  await run.intake({ id: 'once', recipient: worker.id, ticketId: 'P', source: 'host:once', kind: 'message', content: 'once' })
  sessions.receipts.set(`execution:${worker.id}`, 'read')
  sessions.receipts.set('once', 'read')
  const restarted = runtime.create(db, sessions, { timeout: () => () => {} }, join(directory, 'managers'))
  await Promise.all([restarted.recover(worker.id, async () => 'verified'), restarted.recover(worker.id, async () => 'verified')])
  expect(sessions.creates).toHaveLength(4)
  expect(sessions.deliveries).toEqual([`execution:${worker.id}`, 'once'])
  expect(ledger.load(db, 'message', 'once')!.readAt).not.toBeNull()
  expect(ledger.load(db, 'ticket', 'P')).toMatchObject({ status: 'running', executionBindingId: worker.id })
})

it('requires verified prior side effects and an explicit decision before retrying', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const old = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  await run.pause('P', true, 'pause', human)
  await run.pause('P', false, 'human resume', human)
  await expect(run.retry('P', 'retry', human, async () => 'unknown')).rejects.toMatchObject({ code: 'unknown_remote_result' })
  expect(sessions.creates).toHaveLength(4)
  expect(await run.retry('P', 'retry after remote reconciliation', human, async () => 'verified')).toMatchObject({ status: 'queued' })
  expect(await run.start('P', human)).toMatchObject({ started: true })
  const current = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P' && item.status !== 'closed')!
  expect(current.previousBindingId).toBe(old.id)
  expect(current.worktree).not.toBe(old.worktree)
  expect(current.branch).not.toBe(old.branch)
})

it('does not resume a paused execution on answers, reminders or restart', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  sessions.sessions.set(worker.sessionId, { state: 'running', cwd: worker.worktree! })
  await run.pause('P', true, 'wait for human', human)
  await run.intake({ id: 'paused-answer', source: 'answer:known', recipient: worker.id, ticketId: 'P', kind: 'answer', content: 'answer persisted' })
  expect(sessions.modes.at(-1)).toBe('queue')
  await expect(run.recover(worker.id, async () => 'verified')).rejects.toMatchObject({ code: 'human_paused' })
  expect(ledger.load(db, 'ticket', 'P')).toMatchObject({ paused: 1, status: 'running' })
  expect(sessions.creates).toHaveLength(4)
})

it('reports workspace ownership conflict without resetting or deleting existing changes', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  await writeFile(join(worker.worktree!, 'keep.txt'), 'unchanged')
  await execute('git', ['switch', '-c', 'foreign-branch'], { cwd: worker.worktree! })
  await expect(run.recover(worker.id, async () => 'verified')).rejects.toMatchObject({ code: 'workspace_conflict' })
  expect(await readFile(join(worker.worktree!, 'keep.txt'), 'utf8')).toBe('unchanged')
  expect(sessions.creates).toHaveLength(4)
  expect(ledger.load(db, 'role_binding', worker.id)).toMatchObject({ status: 'unavailable', recoveryReason: 'workspace_conflict' })
})

it('keeps responsibility and reports disabled projects without making new sessions', async () => {
  const { run, sessions } = await fixture()
  ledger.updateProject(db, 'p', false, human)
  await expect(run.start('P', human)).rejects.toMatchObject({ code: 'project_disabled' })
  await run.intake({ id: 'disabled-notice', source: 'host:disable', recipient: 'manager-p', ticketId: 'P', kind: 'ticket', content: 'project disabled' })
  expect(sessions.creates).toHaveLength(3)
  expect(ledger.load(db, 'message', 'disabled-notice')).toMatchObject({ deliveredAt: expect.any(String), readAt: null })
  expect(ledger.load(db, 'role_binding', 'manager-p')).toMatchObject({ projectId: 'p', status: 'idle' })
})

it('makes interrupted waiting observable without cancelling the pending ask or losing messages', async () => {
  const { run, sessions } = await fixture()
  const controller = new AbortController()
  const called = Promise.withResolvers<void>()
  sessions.deliver = async () => {
    called.resolve()
    return new Promise<void>(() => {})
  }
  const pending = run.intake({ id: 'interrupt', source: 'host:test', recipient: 'manager-p', ticketId: 'P', kind: 'ask', content: 'pending work' }, controller.signal)
  await called.promise
  controller.abort()
  await expect(pending).rejects.toMatchObject({ code: 'interrupted_tool' })
  expect(ledger.load(db, 'message', 'interrupt')).toMatchObject({ readAt: null, handledAt: null, error: 'interrupted_tool' })
})

class Timers implements HostTimers {
  entries: { at: number, active: boolean, callback: () => Promise<void> }[] = []
  timeout(callback: () => Promise<void>, milliseconds: number): () => void {
    const entry = { at: Date.now() + milliseconds, active: true, callback }
    this.entries.push(entry)
    return () => {
      entry.active = false
    }
  }

  async advance(milliseconds: number): Promise<void> {
    vi.setSystemTime(Date.now() + milliseconds)
    const due = this.entries.filter(item => item.active && item.at <= Date.now())
    const results = await Promise.allSettled(due.map(async (item) => {
      item.active = false
      await item.callback()
    }))
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected')
      throw failed.reason
  }
}

it('reminds the responsible role before its superior with durable production and delivery facts', async () => {
  const timers = new Timers()
  const { run, sessions } = await fixture(2, timers)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.watch({ id: 'stalled', ticketId: 'P', bindingId: 'manager-p', recipient: 'manager-p', waitingFor: 'external-result', reason: 'no verified progress', progressAt: new Date().toISOString() })
  await timers.advance(600000)
  let messages = ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')
  expect(messages).toHaveLength(1)
  expect(messages[0]).toMatchObject({ recipient: 'manager-p', acceptedAt: '2026-11-16T01:10:00.000Z', deliveredAt: '2026-11-16T01:10:00.000Z', readAt: null, ticketId: 'P' })
  sessions.receipts.set(messages[0].id, 'read')
  await run.read('s-p', messages[0].id)
  await timers.advance(600000)
  messages = ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')
  expect(messages.map(item => item.recipient)).toEqual(['manager-p', 'main'])
  expect(ledger.load(db, 'attention', 'stalled')).toMatchObject({ remindedAt: '2026-11-16T01:20:00.000Z', escalatedAt: '2026-11-16T01:20:00.000Z', handledAt: null })
  expect(ledger.list(db, 'ask')).toHaveLength(0)
  await run.settleAttention('stalled', 'remote result verified')
  await timers.advance(600000)
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')).toHaveLength(2)
})

it('preserves a failed first reminder before escalating and reconstructs deadlines across restart', async () => {
  const timers = new Timers()
  const { run, sessions } = await fixture(2, timers)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.watch({ id: 'failed-first', ticketId: 'P', recipient: 'manager-p', waitingFor: 'human', reason: 'pending_ask', progressAt: new Date().toISOString() })
  sessions.sessions.set('s-p', { state: 'closed' })
  await expect(timers.advance(600000)).rejects.toMatchObject({ code: 'closed_session' })
  expect(ledger.load(db, 'attention', 'failed-first')).toMatchObject({ deliveryState: 'failed', deliveryError: 'closed_session', handledAt: null })
  await run.dispose()
  const restarted = runtime.create(db, sessions, timers, join(directory, 'managers'))
  const result = await restarted.boot(async () => 'verified')
  expect(result).toContainEqual({ bindingId: 'manager-p', state: 'requires_attention', reason: 'closed_session' })
  await expect(timers.advance(600000)).rejects.toMatchObject({ code: 'closed_session' })
  const messages = ledger.list(db, 'message').filter(item => item.source === 'attention:failed-first:2026-11-16T01:00:00.000Z')
  expect(messages.map(item => item.recipient)).toEqual(['manager-p', 'main'])
  expect(messages[0]).toMatchObject({ acceptedAt: '2026-11-16T01:10:00.000Z', deliveredAt: null, error: 'closed_session' })
  expect(JSON.parse(messages[1].content)).toMatchObject({ previousReminder: messages[0].id, previousDeliveryError: 'closed_session', waitingFor: 'human' })
})

it('keeps one main across independently constructed runtime instances', async () => {
  const sessions = new Sessions()
  const first = runtime.create(db, sessions, { timeout: () => () => {} }, join(directory, 'managers'))
  const second = runtime.create(db, sessions, { timeout: () => () => {} }, join(directory, 'managers'))
  await Promise.all([first.bind({ id: 'main', role: 'main', sessionId: 's-main' }), second.bind({ id: 'main', role: 'main', sessionId: 's-main' })])
  expect(sessions.creates).toEqual(['s-main'])
  expect(ledger.list(db, 'role_binding')).toHaveLength(1)
})

it('does not bind helpers or reuse a manager session from the business repository', async () => {
  const { run, sessions } = await fixture()
  sessions.sessions.set('foreign-helper', { state: 'idle', cwd: join(directory, 'p'), parentSession: 's-p', origin: 'subagent' })
  await expect(run.bind({ id: 'helper-role', role: 'project', sessionId: 'foreign-helper', projectId: 'p' })).rejects.toMatchObject({ code: 'binding_conflict' })
  expect(ledger.list(db, 'role_binding')).toHaveLength(3)
  for (const id of ['main', 'manager-p', 'manager-q']) {
    const binding = ledger.load(db, 'role_binding', id)!
    expect(sessions.sessions.get(binding.sessionId)!.cwd).toBe(join(directory, 'managers', id))
  }
})

it('wakes a project for another ticket while its original pending ask stays suspended', async () => {
  const { run, sessions } = await fixture()
  ledger.createTicket(db, { id: 'P2', projectId: 'p', channelId: 'test', title: 'second ticket', authorization: 'independent task', acceptanceCriteria: 'tests pass' }, human)
  ledger.createAsk(db, { id: 'manager-ask', ticketIds: ['P'], source: 'test', content: 'human decision', decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, { kind: 'agent', sessionId: 's-p' })
  await run.suspend('s-p', 'manager-ask')
  await run.intake({ id: 'independent', source: 'host:ticket', recipient: 'manager-p', ticketId: 'P2', kind: 'ticket', content: 'independent ticket accepted' })
  expect(sessions.modes.at(-1)).toBe('wake')
  expect(await run.start('P2', human)).toMatchObject({ started: true })
  expect(ledger.load(db, 'ask', 'manager-ask')).toMatchObject({ status: 'pending', handler: 'human' })
})

it('records interrupted session events without closing execution or fabricating completion', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  sessions.receipts.set(`execution:${worker.id}`, 'read')
  await run.observe(worker.sessionId, 'turn-end:12', 'interrupted')
  await run.observe(worker.sessionId, 'turn-end:12', 'interrupted')
  expect(ledger.load(db, 'ticket', 'P')).toMatchObject({ status: 'running', executionBindingId: worker.id })
  expect(ledger.load(db, 'role_binding', worker.id)!.status).not.toBe('closed')
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:session')).toMatchObject([{ id: 'turn-end:12', recipient: 'manager-p', readAt: null }])
  expect(sessions.deliveries.filter(id => id === 'turn-end:12')).toHaveLength(1)
  expect(await run.observe('native-helper', 'helper:12', 'completed')).toEqual({ bound: false })
})

it('interrupts active work on project loss while another project remains dispatchable', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  ledger.updateProject(db, 'p', false, human)
  expect(await run.projectChanged('p')).toEqual([{ bindingId: worker.id, interrupted: true }])
  expect(sessions.cancellations).toEqual([worker.sessionId])
  expect(await run.start('Q', human)).toMatchObject({ started: true })
  expect(ledger.load(db, 'ticket', 'P')!.status).not.toBe('done')
})

it('surfaces storage failure instead of pretending accepted work vanished', async () => {
  const { run } = await fixture()
  ledger.recordRuntimeEvent(db, { id: 'stored', recipient: 'manager-p', ticketId: 'P', source: 'host:stored', kind: 'ticket', content: 'pending' })
  db.close()
  await expect(run.deliver('stored')).rejects.toMatchObject({ code: 'not_initialized' })
  db = await openDatabase(directory)
  expect(ledger.load(db, 'message', 'stored')).toMatchObject({ readAt: null, handledAt: null, deliveredAt: null })
  expect(ledger.load(db, 'role_binding', 'manager-p')).toMatchObject({ role: 'project', projectId: 'p' })
})

it('closes a temporary supervisor only after successful delivery with no unresolved responsibility', async () => {
  const { run } = await fixture()
  await run.bind({ id: 'coordinator', role: 'supervisor', sessionId: 's-coordinator', supervisorId: 'coordination', ticketIds: ['P', 'Q'] }, human)
  await expect(run.closeSupervisor('coordination', 'not yet done')).rejects.toMatchObject({ code: 'coordination_unresolved' })
  for (const ticketId of ['P', 'Q']) {
    await run.start(ticketId, human)
    const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === ticketId)!
    ledger.advanceTicket(db, ticketId, 'ready', human, 'ready for acceptance', worker.id)
    ledger.recordAcceptance(db, { id: `accept-${ticketId}`, ticketId, executionBindingId: worker.id, scope: 'isolated fix', evidence: ['regression passed'], basis: 'regression passes', verdict: 'accepted' }, human)
    const ask = ledger.createAsk(db, { id: `delivery-${ticketId}`, ticketIds: [ticketId], source: 'test:delivery', decisionType: 'delivery', withinAuthorization: true, content: 'accept delivery?', options: ['accept_delivery', 'reject_delivery'] }, { kind: 'agent', sessionId: worker.sessionId })
    ledger.answerAsk(db, { askId: ask.id, policyBasis: ask.policyBasis, answer: 'accept_delivery', verified: true }, human)
    ledger.advanceTicket(db, ticketId, 'complete', human)
    await run.settleAttention(`execution:${worker.id}`, 'delivery accepted and verified')
  }
  expect(await run.closeSupervisor('coordination', 'all linked tickets succeeded')).toMatchObject({ status: 'closed' })
  expect(ledger.load(db, 'role_binding', 'coordinator')).toMatchObject({ status: 'closed' })
  expect(await run.closeSupervisor('coordination', 'idempotent close')).toMatchObject({ status: 'closed' })
})

it('does not auto-close a coordinator when a linked ticket is cancelled', async () => {
  const { run, sessions } = await fixture()
  await run.bind({ id: 'coordinator', role: 'supervisor', sessionId: 's-coordinator', supervisorId: 'coordination', ticketIds: ['P', 'Q'] }, human)
  await run.cancel('P', 'human cancellation', human)
  await run.boot(async () => 'verified')
  expect(ledger.load(db, 'supervisor', 'coordination')).toMatchObject({ status: 'active' })
  await expect(run.closeSupervisor('coordination', 'project cannot close', { kind: 'agent', sessionId: 's-p' })).rejects.toMatchObject({ code: 'scope_denied' })
  expect(sessions.cancellations).not.toContain('s-coordinator')
  expect(await run.closeSupervisor('coordination', 'main explicitly closes cancelled coordination', { kind: 'agent', sessionId: 's-main' })).toMatchObject({ status: 'closed' })
})

it('delivers a later event accepted while the same mailbox is draining without losing its wakeup', async () => {
  const { run, sessions } = await fixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const original = sessions.deliver.bind(sessions)
  sessions.deliver = async (id, message, mode) => {
    if (message.id === 'ordered-first') {
      entered.resolve()
      await release.promise
    }
    await original(id, message, mode)
  }
  const first = run.intake({ id: 'ordered-first', source: 'host:ordered-1', recipient: 'manager-p', ticketId: 'P', kind: 'message', content: 'first' })
  await entered.promise
  const second = run.intake({ id: 'ordered-second', source: 'host:ordered-2', recipient: 'manager-p', ticketId: 'P', kind: 'message', content: 'second' })
  release.resolve()
  await Promise.all([first, second])
  expect(sessions.deliveries).toEqual(['ordered-first', 'ordered-second'])
  expect(ledger.load(db, 'message', 'ordered-second')!.deliveredAt).not.toBeNull()
})

it('keeps failed startup responsibility without spawning substitutes on repeated boot', async () => {
  const { run, sessions } = await fixture()
  const create = sessions.create.bind(sessions)
  let attempts = 0
  sessions.create = async (...args) => {
    attempts++
    if (attempts === 1)
      throw new Error('injected startup failure')
    return create(...args)
  }
  await expect(run.start('P', human)).rejects.toThrow('injected startup failure')
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  expect(worker).toMatchObject({ status: 'unavailable', startedAt: null })
  await run.boot(async () => 'verified')
  await run.boot(async () => 'verified')
  expect(attempts).toBe(1)
  expect(ledger.list(db, 'role_binding').filter(item => item.ticketId === 'P')).toHaveLength(1)
  expect(await run.start('Q', human)).toMatchObject({ started: true })
})

it('resumes the same cold execution only after known external results and never duplicates its recovery prompt', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  sessions.sessions.set(worker.sessionId, { state: 'resumable', cwd: worker.worktree! })
  sessions.receipts.set(`execution:${worker.id}`, 'read')
  ledger.updateBinding(db, worker.id, 'unavailable', 'host restarted')
  await expect(run.recover(worker.id, async () => 'unknown')).rejects.toMatchObject({ code: 'unknown_remote_result' })
  expect(sessions.sessions.get(worker.sessionId)!.state).toBe('resumable')
  expect(await run.recover(worker.id, async () => 'verified')).toMatchObject({ state: 'recovered', binding: { id: worker.id, worktree: worker.worktree } })
  await run.recover(worker.id, async () => 'verified')
  expect(sessions.creates).toHaveLength(4)
  expect(sessions.deliveries.filter(id => id === `recovery:${worker.id}`)).toHaveLength(1)
})

it('records background budget interruption without completion approval or automatic recovery', async () => {
  const timers = new Timers()
  const { run, sessions } = await fixture(2, timers)
  ledger.updateSettings(db, { backgroundLimitMinutes: 1 }, human)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  await timers.advance(60000)
  expect(sessions.cancellations).toEqual([worker.sessionId])
  expect(ledger.load(db, 'ticket', 'P')).toMatchObject({ status: 'running' })
  expect(ledger.list(db, 'attention')).toContainEqual(expect.objectContaining({ bindingId: worker.id, reason: 'background_budget_expired', handledAt: null }))
  await expect(run.recover(worker.id, async () => 'verified')).rejects.toMatchObject({ code: 'background_budget_expired' })
  expect(ledger.list(db, 'ask')).toHaveLength(0)
})

it('does not produce false execution stagnation reminders after a verified human pause', async () => {
  const timers = new Timers()
  const { run } = await fixture(2, timers)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  await run.pause('P', true, 'planned human pause', human)
  await timers.advance(1200000)
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')).toHaveLength(0)
  expect(ledger.load(db, 'ticket', 'P')).toMatchObject({ paused: 1 })
})

it('reminds around the original human ask without creating approvals or resuming its paused ticket', async () => {
  const timers = new Timers()
  const { run } = await fixture(2, timers)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  ledger.createAsk(db, { id: 'human-wait', ticketIds: ['P'], source: 'verified:question', content: 'human choice required', decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, { kind: 'agent', sessionId: 's-p' })
  await run.suspend('s-p', 'human-wait')
  await run.pause('P', true, 'human pause', human)
  await timers.advance(600000)
  await timers.advance(600000)
  expect(ledger.list(db, 'ask')).toMatchObject([{ id: 'human-wait', status: 'pending', handler: 'human', answer: null }])
  const messages = ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')
  expect(messages.map(item => item.recipient)).toEqual(['manager-p', 'main'])
  expect(messages.every(item => item.askId === 'human-wait')).toBe(true)
  expect(ledger.load(db, 'ticket', 'P')).toMatchObject({ paused: 1, status: 'waiting' })
})
