import type { NexusDatabase } from '../src/database'
import type { HostTimers, SessionGateway, SessionSnapshot } from '../src/runtime/types'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase } from '../src/database'
import { communication } from '../src/service/communication'
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
    await execute('git', ['config', 'user.name', 'Nexus Test'], { cwd: root })
    await execute('git', ['config', 'user.email', 'nexus@example.invalid'], { cwd: root })
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
  expect(await run.pause('P', true, 'human pause', human, async () => 'verified')).toMatchObject({ stopped: false, reason: 'execution_stop_unconfirmed' })
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

it('wakes the responsible project after an owner resumes without replacing execution or answering a question', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  ledger.createAsk(db, { id: 'resume-pending', ticketIds: ['P'], source: 'test:resume', content: 'Await owner', decisionType: 'important', withinAuthorization: true, options: [] }, { kind: 'agent', sessionId: 's-p' })
  expect(await run.pause('P', true, 'Owner pauses', human, async () => 'verified')).toMatchObject({ stopped: false, reason: 'human_paused' })
  expect(ledger.load(db, 'role_binding', worker.id)).toMatchObject({ status: 'running', worktree: worker.worktree, sessionId: worker.sessionId })
  expect(ledger.load(db, 'ticket', 'P')).toMatchObject({ status: 'running', failureReason: null })
  const resumed = await run.pause('P', false, 'Owner resumes', human, async () => 'verified')
  expect(resumed.ticket).toMatchObject({ paused: 0, executionBindingId: worker.id })
  expect(ledger.load(db, 'ask', 'resume-pending')).toMatchObject({ status: 'pending', answer: null })
  const notice = ledger.load(db, 'message', sessions.deliveries.at(-1)!)!
  expect(notice).toMatchObject({ recipient: 'manager-p', ticketId: 'P', kind: 'runtime:human' })
  expect(sessions.modes.at(-1)).toBe('wake')
  expect(ledger.list(db, 'role_binding').filter(binding => binding.ticketId === 'P')).toHaveLength(1)
})

it('resumes the verified original session and preserves its unfinished workspace', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  await writeFile(join(worker.worktree!, 'unfinished.txt'), 'keep context')
  await run.pause('P', true, 'hold', human, async () => 'verified')
  const resumed = await run.pause('P', false, 'continue', human, async () => 'verified')
  expect(resumed).toMatchObject({ ticket: { status: 'running', paused: 0, failureReason: null, executionBindingId: worker.id } })
  expect(ledger.load(db, 'role_binding', worker.id)).toMatchObject({ status: 'running', sessionId: worker.sessionId, worktree: worker.worktree })
  expect(sessions.creates).toHaveLength(4)
  const continuation = ledger.list(db, 'message').find(item => item.source === 'ticket:P:resume' && item.recipient === worker.id)!
  expect(continuation).toMatchObject({ deliveredAt: expect.any(String) })
  expect(await readFile(join(worker.worktree!, 'unfinished.txt'), 'utf8')).toBe('keep context')
})

it('reports a genuinely dead session on explicit resume instead of creating a replacement', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  await run.pause('P', true, 'hold', human, async () => 'verified')
  sessions.sessions.set(worker.sessionId, { state: 'closed' })
  expect(await run.pause('P', false, 'continue', human, async () => 'verified')).toMatchObject({ stopped: false, reason: 'closed_session' })
  expect(sessions.creates).toHaveLength(4)
  expect(ledger.load(db, 'role_binding', worker.id)).toMatchObject({ status: 'unavailable', worktree: worker.worktree })
})

it('does not wake an unpaused execution until its real external reconciliation succeeds', async () => {
  const { run, sessions } = await fixture()
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  await run.pause('P', true, 'hold', human, async () => 'verified')
  const reconcile = vi.fn(async () => 'unknown' as const)
  expect(await run.pause('P', false, 'continue', human, reconcile)).toMatchObject({ reason: 'unknown_remote_result', stopped: false })
  expect(reconcile).toHaveBeenCalledOnce()
  await run.intake({ id: 'still-unverified', source: 'answer:late', recipient: worker.id, ticketId: 'P', kind: 'answer', content: 'answer persisted' })
  expect(sessions.modes.at(-1)).toBe('queue')
  expect(ledger.load(db, 'role_binding', worker.id)).toMatchObject({ status: 'unavailable' })
  expect(sessions.creates).toHaveLength(4)
  await run.recover(worker.id, async () => 'verified')
  expect(ledger.load(db, 'role_binding', worker.id)).toMatchObject({ status: 'running', worktree: worker.worktree })
  expect(ledger.list(db, 'attention').filter(item => item.reason === 'unknown_remote_result')).toMatchObject([{ handledAt: expect.any(String), resolution: 'session and workspace reconciled' }])
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
  await run.retire('P', 'execution actually ended', undefined, human)
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
  await run.pause('P', true, 'wait for human', human, async () => 'verified')
  await run.intake({ id: 'paused-answer', source: 'answer:known', recipient: worker.id, ticketId: 'P', kind: 'answer', content: 'answer persisted' })
  const target = { repository: 'github.com/org/p', pullRequest: 'https://github.com/org/p/pull/1', base: 'main', head: 'verified-head' }
  ledger.setDeliveryTarget(db, 'P', target, human)
  ledger.recordPullRequest(db, 'P', target, 'open', 'passing')
  await run.intake({ id: 'paused-ci', source: 'ci:verified', recipient: worker.id, ticketId: 'P', kind: 'message', content: 'CI passed' })
  expect(sessions.modes.slice(-2)).toEqual(['queue', 'queue'])
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

it('re-arms stagnation reminders only for newly delivered evidence-bearing progress, not receipts or empty turns', async () => {
  const timers = new Timers()
  const { run } = await fixture(2, timers)
  const service = communication.create(db, run)
  ledger.updateSettings(db, { backgroundLimitMinutes: 120 }, human)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  const id = `execution:${worker.id}`
  for (let step = 1; step <= 5; step++) {
    await timers.advance(540000)
    await service.sendMessage(worker.sessionId, `healthy-${step}`, { to: 'binding:manager-p', message: 'verified continuation', facts: { state: 'progress', summary: `completed chunk ${step}`, evidence: [`chunk-${step}: regression passed`] } })
    expect(ledger.load(db, 'attention', id)).toMatchObject({ progressAt: new Date().toISOString(), waitingFor: `completed chunk ${step}`, escalatedAt: null })
  }
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')).toHaveLength(0)
  const progressAt = ledger.load(db, 'attention', id)!.progressAt
  await timers.advance(540000)
  await service.sendMessage(worker.sessionId, 'accepted-only', { to: 'binding:manager-p', message: 'notification accepted' })
  await run.observe(worker.sessionId, 'empty-turn', 'turn/end')
  expect(ledger.load(db, 'attention', id)!.progressAt).toBe(progressAt)
  await timers.advance(60000)
  const reminders = ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')
  expect(reminders).toMatchObject([{ recipient: 'manager-p' }])
  expect(JSON.parse(reminders[0].content)).toMatchObject({ waitingFor: 'completed chunk 5', progressAt })
})

it.each(['manager-p', 'worker'] as const)('does not refresh execution attention when a dependency notification to %s is handled', async (recipient) => {
  const timers = new Timers()
  const { run, sessions } = await fixture(2, timers)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  const id = `execution:${worker.id}`
  const original = ledger.load(db, 'attention', id)!
  sessions.receipts.set(id, 'read')
  await run.read(worker.sessionId, id)
  await run.handled(worker.sessionId, id)
  await timers.advance(540000)
  const target = recipient === 'worker' ? worker : ledger.load(db, 'role_binding', recipient)!
  const notification = await run.intake({ id: 'dependency-only', source: 'wakeup:dependency-Q', recipient: target.id, ticketId: 'P', kind: 'ticket', content: 'Dependency Q completed; awareness only' })
  sessions.receipts.set(notification.id, 'read')
  await run.read(target.sessionId, notification.id)
  await run.handled(target.sessionId, notification.id)
  expect(ledger.load(db, 'attention', id)).toEqual(original)
  await timers.advance(60000)
  const reminders = ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')
  expect(reminders).toMatchObject([{ recipient: 'manager-p', acceptedAt: '2026-11-16T01:10:00.000Z' }])
  expect(JSON.parse(reminders[0].content)).toMatchObject({ waitingFor: worker.id, progressAt: '2026-11-16T01:00:00.000Z' })
})

it('refreshes only its own execution when a worker handles its real dispatch continuation', async () => {
  const timers = new Timers()
  const { run, sessions } = await fixture(2, timers)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  const id = `execution:${worker.id}`
  await run.watch({ id: `runtime:${worker.id}:fault`, bindingId: worker.id, ticketId: 'P', recipient: worker.id, reason: 'unknown_remote_result', waitingFor: 'runtime reconciliation', progressAt: new Date().toISOString() })
  const fault = ledger.load(db, 'attention', `runtime:${worker.id}:fault`)!
  await timers.advance(300000)
  sessions.receipts.set(id, 'read')
  await run.read(worker.sessionId, id)
  await run.handled(worker.sessionId, id)
  expect(ledger.load(db, 'attention', id)).toMatchObject({ progressAt: '2026-11-16T01:05:00.000Z', dueAt: '2026-11-16T01:15:00.000Z' })
  expect(ledger.load(db, 'attention', `runtime:${worker.id}:fault`)).toEqual(fault)
  await timers.advance(300000)
  await run.handled(worker.sessionId, id)
  expect(ledger.load(db, 'attention', id)!.progressAt).toBe('2026-11-16T01:05:00.000Z')
})

it('does not let manager evidence for a task ask refresh the worker execution or runtime fault wait', async () => {
  const { run } = await fixture()
  const service = communication.create(db, run)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  const id = `execution:${worker.id}`
  const original = ledger.load(db, 'attention', id)!
  const ask = await service.ask('s-p', { requestId: 'scope-wait', ticketIds: ['P'], question: 'Owner decision?' })
  await run.watch({ id: `runtime:${worker.id}:fault`, bindingId: worker.id, ticketId: 'P', recipient: worker.id, reason: 'unknown_remote_result', waitingFor: 'runtime reconciliation', progressAt: new Date().toISOString() })
  const fault = ledger.load(db, 'attention', `runtime:${worker.id}:fault`)!
  vi.setSystemTime(new Date('2026-11-16T01:05:00Z'))
  await service.sendMessage('s-p', 'ask-only-evidence', { to: 'binding:main', ticketId: 'P', message: 'Owner review confirmed', facts: { state: 'progress', summary: 'Wait for owner review', evidence: ['Owner review scheduled at 02:00'] } })
  expect(ledger.load(db, 'attention', `ask:${ask.askId}`)).toMatchObject({ progressAt: '2026-11-16T01:05:00.000Z', waitingFor: 'Wait for owner review' })
  expect(ledger.load(db, 'attention', id)).toEqual(original)
  expect(ledger.load(db, 'attention', `runtime:${worker.id}:fault`)).toEqual(fault)
})

it('does not count an undelivered progress report or its later duplicate as fresh progress', async () => {
  const timers = new Timers()
  const { run, sessions } = await fixture(2, timers)
  const service = communication.create(db, run)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const deliver = sessions.deliver.bind(sessions)
  sessions.deliver = async (...args) => {
    entered.resolve()
    await release.promise
    await deliver(...args)
  }
  await timers.advance(300000)
  const pending = service.sendMessage(worker.sessionId, 'gated-progress', { to: 'binding:manager-p', message: 'chunk done', facts: { state: 'progress', summary: 'verified chunk', evidence: ['regression: pass'] } })
  await entered.promise
  const id = `execution:${worker.id}`
  expect(ledger.load(db, 'attention', id)!.progressAt).toBe('2026-11-16T01:00:00.000Z')
  release.resolve()
  const sent = await pending
  expect(ledger.load(db, 'attention', id)!.progressAt).toBe('2026-11-16T01:05:00.000Z')
  await timers.advance(60000)
  await run.deliver(sent.messageId)
  expect(ledger.load(db, 'attention', id)!.progressAt).toBe('2026-11-16T01:05:00.000Z')
})

it('re-arms an unchanged ask only after its responsible manager records an evidenced continued-wait decision', async () => {
  const timers = new Timers()
  const { run } = await fixture(2, timers)
  const service = communication.create(db, run)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  const ask = await service.ask('s-p', { requestId: 'continued-wait', ticketIds: ['P'], question: 'External decision?' })
  await timers.advance(600000)
  const first = ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder' && item.askId === ask.askId)
  expect(first).toMatchObject([{ recipient: 'manager-p' }])
  await service.sendMessage('s-p', 'wait-disposition', { to: 'binding:main', ticketId: 'P', message: 'Continue waiting for scheduled decision', facts: { state: 'progress', summary: 'Waiting for scheduled owner review', evidence: ['Owner review scheduled at 02:00'] } })
  expect(ledger.load(db, 'attention', `ask:${ask.askId}`)).toMatchObject({ progressAt: '2026-11-16T01:10:00.000Z', escalatedAt: null, waitingFor: 'Waiting for scheduled owner review' })
  await timers.advance(540000)
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder' && item.askId === ask.askId)).toHaveLength(1)
  await timers.advance(60000)
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder' && item.askId === ask.askId).map(item => item.recipient)).toEqual(['manager-p', 'manager-p'])
  await service.answer({ askId: ask.askId, answer: 'decided', policyBasis: ask.policyBasis }, human)
  await timers.advance(1200000)
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder' && item.askId === ask.askId)).toHaveLength(2)
})

it.each(['progress', 'answer'] as const)('retires undelivered stale ask reminders after %s', async (disposition) => {
  const timers = new Timers()
  const { run, sessions } = await fixture(2, timers)
  const service = communication.create(db, run)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  const ask = await service.ask('s-p', { requestId: 'stale-reminder', ticketIds: ['P'], question: 'Owner decision?' })
  const manager = sessions.sessions.get('s-p')!
  sessions.sessions.set('s-p', { state: 'closed' })
  await expect(timers.advance(600000)).rejects.toMatchObject({ code: 'closed_session' })
  const reminder = ledger.list(db, 'message').find(item => item.kind === 'runtime:reminder' && item.askId === ask.askId)!
  sessions.sessions.set('s-p', manager)
  if (disposition === 'progress') {
    await service.sendMessage('s-p', 'reconciled-wait', { to: 'binding:main', ticketId: 'P', message: 'Owner review scheduled', facts: { state: 'progress', summary: 'Scheduled review confirmed', evidence: ['Review confirmed for 02:00'] } })
  }
  else {
    await service.answer({ askId: ask.askId, answer: 'decided', policyBasis: ask.policyBasis }, human)
  }
  expect(ledger.load(db, 'message', reminder.id)).toMatchObject({ supersededAt: expect.any(String), deliveryState: 'superseded' })
  vi.setSystemTime(Date.now() + 2000)
  await run.deliver(reminder.id)
  expect(sessions.deliveries).not.toContain(reminder.id)
})

it('skips a reminder retired by an earlier progress report in the same durable mailbox batch', async () => {
  const { run, sessions } = await fixture()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  vi.setSystemTime(new Date('2026-11-16T01:09:00Z'))
  const report = ledger.sendMessage(db, 'offline-progress', 'manager-p', 'P', 'verified chunk completed', { kind: 'agent', sessionId: worker.sessionId }, { state: 'progress', summary: 'Chunk regression verified', evidence: ['regression passed'] })
  const manager = sessions.sessions.get('s-p')!
  sessions.sessions.set('s-p', { state: 'closed' })
  vi.setSystemTime(new Date('2026-11-16T01:10:00Z'))
  await expect(run.remind(`execution:${worker.id}`)).rejects.toMatchObject({ code: 'closed_session' })
  const reminder = ledger.list(db, 'message').find(item => item.kind === 'runtime:reminder')!
  sessions.sessions.set('s-p', manager)
  vi.setSystemTime(Date.now() + 2000)
  await expect(run.deliver(report.id)).resolves.toMatchObject({ deliveryState: 'delivered' })
  expect(sessions.deliveries).not.toContain(reminder.id)
  expect(ledger.load(db, 'message', reminder.id)).toMatchObject({ deliveryState: 'superseded' })
})

it('settles answered asks and completed execution attention before any stale reminder can fire', async () => {
  const timers = new Timers()
  const { run } = await fixture(2, timers)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
  ledger.advanceTicket(db, 'P', 'ready', human, 'ready', worker.id)
  ledger.recordAcceptance(db, { id: 'terminal-accept', ticketId: 'P', executionBindingId: worker.id, scope: 'fix', evidence: ['tests passed'], basis: 'criteria verified', verdict: 'accepted' }, human)
  const ask = ledger.createAsk(db, { id: 'terminal-delivery', ticketIds: ['P'], source: 'test', decisionType: 'delivery', withinAuthorization: true, content: 'accept?', options: ['accept_delivery', 'reject_delivery'] }, { kind: 'agent', sessionId: worker.sessionId })
  await run.suspend(worker.sessionId, ask.id)
  ledger.answerAsk(db, { askId: ask.id, policyBasis: ask.policyBasis, answer: 'accept_delivery' }, human)
  ledger.advanceTicket(db, 'P', 'complete', human)
  await timers.advance(1200000)
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')).toHaveLength(0)
  expect(ledger.load(db, 'attention', `execution:${worker.id}`)).toMatchObject({ handledAt: expect.any(String) })
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

it('delivers durable dependency wakeups once across flush and boot, then auto-closes successful coordination', async () => {
  const { run, sessions } = await fixture()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.bind({ id: 'coordinator', role: 'supervisor', sessionId: 's-coordinator', supervisorId: 'coordination', ticketIds: ['P', 'Q'] }, human)
  ledger.linkTickets(db, 'Q', 'P', 'depends', human)
  await expect(run.start('Q', human)).rejects.toMatchObject({ code: 'dependency_unsatisfied' })
  for (const ticketId of ['P', 'Q']) {
    await run.start(ticketId, human)
    const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === ticketId)!
    ledger.advanceTicket(db, ticketId, 'ready', human, 'ready for acceptance', worker.id)
    ledger.recordAcceptance(db, { id: `wake-accept-${ticketId}`, ticketId, executionBindingId: worker.id, scope: 'isolated fix', evidence: ['regression passed'], basis: 'regression passes', verdict: 'accepted' }, human)
    const ask = ledger.createAsk(db, { id: `wake-delivery-${ticketId}`, ticketIds: [ticketId], source: 'test:delivery', decisionType: 'delivery', withinAuthorization: true, content: 'accept delivery?', options: ['accept_delivery', 'reject_delivery'] }, { kind: 'agent', sessionId: worker.sessionId })
    ledger.answerAsk(db, { askId: ask.id, policyBasis: ask.policyBasis, answer: 'accept_delivery', verified: true }, human)
    ledger.advanceTicket(db, ticketId, 'complete', human)
    await run.retire(ticketId, 'delivery complete', undefined, human)
    if (ticketId === 'P') {
      const coordinator = sessions.sessions.get('s-coordinator')!
      sessions.sessions.set('s-coordinator', { state: 'closed' })
      expect(await run.flush()).toContainEqual({ id: 'Q:P', reason: 'closed_session' })
      expect(ledger.load(db, 'wakeup', 'Q:P')).toMatchObject({ handledAt: null })
      sessions.sessions.set('s-coordinator', coordinator)
      vi.setSystemTime(Date.now() + 2000)
      await run.boot(async () => 'verified')
    }
    await run.flush()
    if (ticketId === 'P') {
      expect(ledger.resolveTicket(db, 'Q').dependencySatisfied).toBe(true)
      expect(ledger.load(db, 'supervisor', 'coordination')).toMatchObject({ status: 'active' })
      expect(ledger.load(db, 'wakeup', 'Q:P')).toMatchObject({ handledAt: expect.any(String) })
      expect(ledger.list(db, 'message').filter(item => item.source === 'wakeup:Q:P')).toMatchObject([
        { recipient: 'manager-q', ticketId: 'Q', deliveredAt: expect.any(String) },
        { recipient: 'coordinator', ticketId: 'Q', deliveredAt: expect.any(String) },
      ])
      const before = sessions.deliveries.length
      await run.flush()
      await run.boot(async () => 'verified')
      expect(sessions.deliveries).toHaveLength(before)
    }
  }
  expect(ledger.load(db, 'supervisor', 'coordination')).toMatchObject({ status: 'closed' })
  expect(ledger.load(db, 'role_binding', 'coordinator')).toMatchObject({ status: 'closed' })
})

it.each(['cancelled', 'failed'] as const)('never wakes a dependency or auto-closes a %s link as success', async (outcome) => {
  const { run } = await fixture()
  await run.bind({ id: 'coordinator', role: 'supervisor', sessionId: 's-coordinator', supervisorId: 'coordination', ticketIds: ['P', 'Q'] }, human)
  ledger.linkTickets(db, 'Q', 'P', 'depends', human)
  if (outcome === 'cancelled') {
    await run.cancel('P', 'human cancellation', human)
  }
  else {
    await run.start('P', human)
    const worker = ledger.list(db, 'role_binding').find(item => item.ticketId === 'P')!
    ledger.advanceTicket(db, 'P', 'failed', human, 'verified failure', worker.id)
  }
  await run.flush()
  expect(ledger.list(db, 'wakeup')).toHaveLength(0)
  expect(ledger.resolveTicket(db, 'Q').dependencySatisfied).toBe(false)
  expect(ledger.load(db, 'supervisor', 'coordination')).toMatchObject({ status: 'active' })
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

it('re-arms queued worker-limit reminders after explicit resume and still escalates without reviving other waits', async () => {
  const timers = new Timers()
  const { run } = await fixture(1, timers)
  ledger.updateSettings(db, { backgroundLimitMinutes: 120 }, human)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  expect(await run.start('Q', human)).toMatchObject({ started: false, reason: 'worker_limit' })
  expect(ledger.load(db, 'attention', 'queue:Q')).toMatchObject({ handledAt: null, reason: 'worker_limit' })
  await run.watch({ id: 'runtime:queue-fault', ticketId: 'Q', recipient: 'manager-q', reason: 'unknown_remote_result', waitingFor: 'reconciliation', progressAt: new Date().toISOString() })
  await run.settleAttention('runtime:queue-fault', 'reconciled')
  await run.watch({ id: 'human-paused-wait', ticketId: 'Q', recipient: 'manager-q', reason: 'human_paused', waitingFor: 'human', progressAt: new Date().toISOString() })
  const fault = ledger.load(db, 'attention', 'runtime:queue-fault')!
  const humanWait = ledger.load(db, 'attention', 'human-paused-wait')!
  await run.pause('Q', true, 'planned queue pause', human, async () => 'verified')
  expect(ledger.load(db, 'attention', 'queue:Q')).toMatchObject({ handledAt: '2026-11-16T01:00:00.000Z', resolution: 'human_paused' })
  await timers.advance(1200000)
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder' && item.ticketId === 'Q')).toEqual([])
  await run.pause('Q', false, 'resume queue', human, async () => 'verified')
  expect(await run.start('Q', human)).toMatchObject({ started: false, reason: 'worker_limit' })
  expect(ledger.load(db, 'attention', 'queue:Q')).toMatchObject({ handledAt: null, resolution: null, progressAt: '2026-11-16T01:20:00.000Z', dueAt: '2026-11-16T01:30:00.000Z', waitingFor: 'worker slot' })
  expect(ledger.load(db, 'attention', 'runtime:queue-fault')).toEqual(fault)
  expect(ledger.load(db, 'attention', 'human-paused-wait')).toEqual(humanWait)
  await timers.advance(600000)
  await timers.advance(600000)
  const reminders = ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder' && item.ticketId === 'Q')
  expect(reminders.map(item => ({ recipient: item.recipient, acceptedAt: item.acceptedAt }))).toEqual([{ recipient: 'manager-q', acceptedAt: '2026-11-16T01:30:00.000Z' }, { recipient: 'main', acceptedAt: '2026-11-16T01:40:00.000Z' }])
  expect(ledger.load(db, 'attention', 'queue:Q')).toMatchObject({ escalatedAt: '2026-11-16T01:40:00.000Z', handledAt: null })
  expect(ledger.load(db, 'ticket', 'Q')).toMatchObject({ status: 'queued', paused: 0, executionBindingId: null, startedAt: null })
})

it('does not produce false execution stagnation reminders after a verified human pause', async () => {
  const timers = new Timers()
  const { run } = await fixture(2, timers)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  await run.start('P', human)
  await run.pause('P', true, 'planned human pause', human, async () => 'verified')
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
  await run.pause('P', true, 'human pause', human, async () => 'verified')
  await timers.advance(600000)
  await timers.advance(600000)
  expect(ledger.list(db, 'ask')).toMatchObject([{ id: 'human-wait', status: 'pending', handler: 'human', answer: null }])
  const messages = ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')
  expect(messages.map(item => item.recipient)).toEqual(['manager-p', 'main'])
  expect(messages.every(item => item.askId === 'human-wait')).toBe(true)
  expect(ledger.load(db, 'ticket', 'P')).toMatchObject({ paused: 1, status: 'waiting' })
})
