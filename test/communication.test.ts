import type { NexusDatabase } from '../src/database'
import type { SessionGateway, SessionSnapshot } from '../src/runtime/types'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase } from '../src/database'
import { communication } from '../src/service/communication'
import { ledger } from '../src/service/ledger'
import { runtime } from '../src/service/runtime'

const human = { kind: 'web', authenticated: true, userId: 'owner' } as const
let db: NexusDatabase
let directory: string
let service: ReturnType<typeof communication.create>
let run: ReturnType<typeof runtime.create>
let sessions: Sessions

class Sessions implements SessionGateway {
  sessions = new Map<string, SessionSnapshot>()
  deliveries: { sessionId: string, messageId: string, mode: string }[] = []
  cancellations: string[] = []
  receipts = new Set<string>()
  failDelivery = false
  async inspect(id: string) { return this.sessions.get(id) ?? { state: 'missing' as const } }
  async create(id: string, _preset: string, cwd: string) { this.sessions.set(id, { state: 'idle', cwd }) }
  async resume() {}
  async deliver(sessionId: string, message: { id: string }, mode: string) {
    if (this.failDelivery)
      throw new Error('gateway_offline')
    this.deliveries.push({ sessionId, messageId: message.id, mode })
    this.receipts.add(message.id)
  }

  async receipt(_sessionId: string, messageId: string) { return this.receipts.has(messageId) ? 'queued' as const : 'absent' as const }
  async cancel(id: string) { this.cancellations.push(id) }
  async stop() { return true }
}

beforeEach(async () => {
  directory = join(import.meta.dirname, '../.temp', `communication-${randomUUID()}`)
  await mkdir(directory, { recursive: true })
  db = await openDatabase(directory)
  sessions = new Sessions()
  run = runtime.create(db, sessions, { timeout: () => () => {} }, join(directory, 'managers'))
  await run.bind({ id: 'main', role: 'main', sessionId: 's-main' })
  ledger.createProject(db, { id: 'p', name: 'P', workspaceId: 'p', directory, remoteUrl: 'https://github.com/org/p', available: true })
  ledger.updateProject(db, 'p', true, human)
  await run.bind({ id: 'project', role: 'project', sessionId: 's-project', projectId: 'p' })
  for (const id of ['T1', 'T2'])
    ledger.createTicket(db, { id, projectId: 'p', channelId: 'test', title: id, authorization: 'fix bug', acceptanceCriteria: 'regression passes' }, human)
  ledger.bindRole(db, { id: 'worker', role: 'worker', sessionId: 's-worker', projectId: 'p', ticketId: 'T1', repository: 'github.com/org/p', branch: 'ticket/T1', worktree: join(directory, 'worker') }, { kind: 'agent', sessionId: 's-project' })
  sessions.sessions.set('s-worker', { state: 'idle', cwd: join(directory, 'worker') })
  ledger.dispatchTicket(db, 'T1', { kind: 'agent', sessionId: 's-project' })
  ledger.startTicket(db, 'T1', 'worker', { kind: 'agent', sessionId: 's-project' })
  service = communication.create(db, run)
})

afterEach(async () => {
  await run?.dispose()
  if (db?.initialized)
    db.close()
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

it('keeps a main triage question on its verified source topic without inventing a ticket', async () => {
  ledger.saveChannel(db, 'github', 'GitHub', true)
  const thread = ledger.recordThread(db, { channelId: 'github', repository: 'github.com/org/p', kind: 'issue', resourceId: '7', projectId: 'p', title: 'Triage question' })
  const question = await service.ask('s-main', { requestId: 'triage-source', question: 'Which outcome?', options: ['investigate'], threadId: thread.id })
  const publication = ledger.publishMessage(db, `ask:${question.askId}`, thread.id, { kind: 'agent', sessionId: 's-main' })
  expect(publication).toMatchObject({ recipient: thread.id, ticketId: null, askId: question.askId })
  await expect(service.ask('s-project', { requestId: 'wrong-source', question: 'Choose', ticketIds: ['T1'], threadId: thread.id })).rejects.toMatchObject({ code: 'scope_denied' })
})

it('creates a durable pending question, preserves its form, and returns the same identity on retry', async () => {
  const input = { requestId: 'choice-1', question: 'Which implementation?', options: ['first', 'second'], multiSelect: true, title: 'Implementation', detail: 'Choose the compatible approach', decisionType: 'ordinary' as const }
  const first = await service.ask('s-worker', input)
  expect(first).toMatchObject({ accepted: true, state: 'pending', handler: 'project', ticketIds: ['T1'], question: input.question, options: ['first', 'second'], multiSelect: true, title: 'Implementation', detail: input.detail })
  expect(first.askId).toBeTruthy()
  const second = await communication.create(db, run).ask('s-worker', input)
  expect(second.askId).toBe(first.askId)
  expect(service.list()).toHaveLength(1)
  expect(ledger.list(db, 'message').filter(message => message.kind === 'ask')).toHaveLength(1)
  expect(sessions.cancellations).toEqual(['s-worker', 's-worker'])
  expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ status: 'running' })
})

it('escalates only the current handler and preserves question identity and multi-selection across channels', async () => {
  const created = await service.ask('s-worker', { requestId: 'escalate', question: 'Pick compatible targets', options: ['a', 'b'], multiSelect: true, title: 'Targets', detail: 'Keep both runtimes', decisionType: 'ordinary' })
  const escalated = await service.ask('s-project', { askId: created.askId })
  expect(escalated).toMatchObject({ askId: created.askId, handler: 'main', state: 'pending', question: 'Pick compatible targets', options: ['a', 'b'], multiSelect: true, title: 'Targets', detail: 'Keep both runtimes' })
  await expect(service.sendMessage('s-project', 'old-handler', { askId: created.askId, message: 'a', selections: ['a'], policyBasis: created.policyBasis })).rejects.toMatchObject({ code: 'not_current_handler' })
  const result = await service.answer({ askId: created.askId, answer: 'Both', selections: ['a', 'b'], policyBasis: created.policyBasis }, human)
  expect(result).toMatchObject({ accepted: true, state: 'answered', to: 'worker', answer: 'Both', selections: ['a', 'b'] })
  expect(ledger.list(db, 'ask')).toHaveLength(1)
  expect(ledger.load(db, 'ask', created.askId)).toMatchObject({ escalations: 1, answerSource: 'web' })
  expect(sessions.deliveries.at(-1)).toMatchObject({ sessionId: 's-worker', messageId: `answer:${created.askId}`, mode: 'wake' })
})

it('rejects altered retries rather than reusing a question with different options or ticket scope', async () => {
  const input = { requestId: 'stable', question: 'Choose', options: ['a'], decisionType: 'ordinary' as const }
  await service.ask('s-worker', input)
  await expect(service.ask('s-worker', { ...input, options: ['b'] })).rejects.toMatchObject({ code: 'identity_conflict' })
  await expect(service.ask('s-worker', { ...input, ticketIds: ['T2'] })).rejects.toMatchObject({ code: 'scope_denied' })
  expect(service.list()).toHaveLength(1)
})

it('uses ordinary structured reports only as messages and never as an answer or ticket status mutation', async () => {
  const ask = await service.ask('s-worker', { requestId: 'report', question: 'Proceed?', options: ['yes', 'no'], decisionType: 'ordinary' })
  const report = { state: 'ready' as const, summary: 'PR prepared', evidence: ['test suite passed'], acceptanceCriteria: 'regression passes' }
  const result = await service.sendMessage('s-worker', 'report-1', { to: 'role:project', message: 'yes', facts: report })
  expect(result).toMatchObject({ accepted: true, to: 'project', ticketId: 'T1' })
  expect(ledger.load(db, 'message', result.messageId!)).toMatchObject({ content: 'yes', kind: 'message', askId: null, facts: JSON.stringify(report) })
  expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ status: 'running' })
  expect(ledger.load(db, 'ask', ask.askId)).toMatchObject({ status: 'pending', answer: null })
  await expect(service.sendMessage('s-worker', 'report-1', { to: 'role:project', message: 'yes', facts: { ...report, state: 'failed' } })).rejects.toMatchObject({ code: 'identity_conflict' })
})

it('keeps only the first formal answer across Web and GitHub and never repeats its return delivery', async () => {
  ledger.updateSettings(db, { whitelist: ['alice'] }, human)
  const ask = await service.ask('s-worker', { requestId: 'race', question: 'Proceed?', options: ['yes', 'no'] })
  const github = { kind: 'github', verified: true, providerId: '42', login: 'alice', bot: false, outbound: false } as const
  const results = await Promise.all([
    service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'yes' }, human),
    communication.create(db, run).answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'no' }, github),
  ])
  expect(results.map(result => result.accepted)).toEqual([true, false])
  expect(results[1]).toMatchObject({ reason: 'ask_answered', state: 'answered', answer: 'yes' })
  expect(ledger.load(db, 'ask', ask.askId)).toMatchObject({ answerSource: 'web', answerActor: JSON.stringify(human) })
  await service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'yes' }, human)
  expect(ledger.list(db, 'message').filter(message => message.kind === 'answer')).toHaveLength(1)
  expect(sessions.deliveries.filter(message => message.messageId === `answer:${ask.askId}`)).toHaveLength(1)
})

it('distinguishes cancellation and target invalidation without half-settled answers', async () => {
  const ask = await service.ask('s-worker', { requestId: 'cancel', question: 'Proceed?' })
  expect(await service.cancel(ask.askId, 'No longer needed', human)).toMatchObject({ state: 'cancelled', cancelReason: 'No longer needed [owner]' })
  await expect(service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'yes' }, human)).rejects.toMatchObject({ code: 'ask_cancelled' })
  const target = { repository: 'github.com/org/p', pullRequest: 'https://github.com/org/p/pull/7', base: 'main', head: 'abc' }
  const project = { kind: 'agent', sessionId: 's-project' } as const
  ledger.setDeliveryTarget(db, 'T1', target, project)
  ledger.recordAcceptance(db, { id: 'accept', executionBindingId: 'worker', ticketId: 'T1', scope: 'bug fix', evidence: ['regression passed'], basis: 'regression passes', verdict: 'accepted' }, project)
  const merge = await service.ask('s-worker', { requestId: 'merge-target', question: 'Merge this PR?', decisionType: 'merge', target, options: ['allow_merge', 'deny_merge'] })
  ledger.setDeliveryTarget(db, 'T1', { ...target, head: 'def' }, project)
  await expect(service.answer({ askId: merge.askId, policyBasis: merge.policyBasis, answer: 'allow_merge', target, verified: true }, human)).rejects.toMatchObject({ code: 'target_changed' })
  expect(ledger.list(db, 'message').filter(message => message.kind === 'answer')).toHaveLength(0)
  expect(ledger.load(db, 'ask', merge.askId)).toMatchObject({ status: 'cancelled', answer: null })
})

it('rejects stale policy tokens and model/default answers when current policy requires a human', async () => {
  const ask = await service.ask('s-worker', { requestId: 'policy', question: 'Proceed?', decisionType: 'ordinary', options: ['yes', 'no'] })
  ledger.setPolicy(db, 'T1', { questionLevel: 'detailed', mergePolicy: 'human_required' }, 'Risk increased', human)
  await expect(service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'yes' }, human)).rejects.toMatchObject({ code: 'policy_changed' })
  const current = service.list().find(item => item.askId === ask.askId)!
  await expect(service.sendMessage('s-project', 'default', { askId: ask.askId, message: 'yes', policyBasis: current.policyBasis })).rejects.toMatchObject({ code: 'human_required' })
  await expect(service.answer({ askId: ask.askId, policyBasis: current.policyBasis, answer: 'yes' }, { kind: 'github', verified: true, providerId: '42', login: 'alice', bot: true, outbound: false })).rejects.toMatchObject({ code: 'human_required' })
  expect(ledger.load(db, 'ask', ask.askId)).toMatchObject({ status: 'pending', answerActor: null })
  expect(await service.answer({ askId: ask.askId, policyBasis: current.policyBasis, answer: 'no' }, human)).toMatchObject({ state: 'answered', answer: 'no' })
})

it('lets a manager serve another ticket while its own ask remains pending', async () => {
  const ask = await service.ask('s-project', { requestId: 'manager-wait', question: 'Need a product decision', ticketIds: ['T1'] })
  expect(ask).toMatchObject({ state: 'pending', handler: 'human' })
  const next = await service.sendMessage('s-project', 'other-ticket', { to: 'role:main', message: 'T2 ready for planning', ticketId: 'T2' })
  expect(next).toMatchObject({ accepted: true, ticketId: 'T2', to: 'main' })
  expect(sessions.deliveries.at(-1)).toMatchObject({ sessionId: 's-main', mode: 'wake' })
  expect(ledger.load(db, 'ask', ask.askId)).toMatchObject({ status: 'pending' })
})

it('keeps a question durable when interruption ends only the suspension wait, then wakes its original worker', async () => {
  const controller = new AbortController()
  vi.spyOn(sessions, 'cancel').mockImplementationOnce(async () => {
    controller.abort()
  })
  await expect(service.ask('s-worker', { requestId: 'interrupt', question: 'Wait for user' }, controller.signal)).rejects.toMatchObject({ code: 'interrupted_tool' })
  const [ask] = service.list()
  expect(ask).toMatchObject({ state: 'pending', initiatorBinding: 'worker' })
  expect(await service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'Continue with option A' }, human)).toMatchObject({ accepted: true, to: 'worker', state: 'answered' })
  expect(sessions.deliveries.at(-1)).toMatchObject({ sessionId: 's-worker', messageId: `answer:${ask.askId}`, mode: 'wake' })
})

it('records a late answer but queues it without lifting a human pause', async () => {
  const ask = await service.ask('s-worker', { requestId: 'pause', question: 'Proceed?' })
  ledger.pauseTicket(db, 'T1', true, 'Human pause', human)
  expect(await service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'Proceed' }, human)).toMatchObject({ state: 'answered' })
  expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ paused: 1, status: 'running' })
  expect(sessions.deliveries.at(-1)).toMatchObject({ sessionId: 's-worker', mode: 'queue' })
})

it('preserves an accepted answer with explicit recovery failure rather than injecting a closed initiator', async () => {
  const ask = await service.ask('s-project', { requestId: 'closed', question: 'Decision', ticketIds: ['T2'] })
  ledger.updateBinding(db, 'project', 'closed', 'Host confirmed closure')
  const result = await service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'Keep current scope' }, human)
  expect(result).toMatchObject({ accepted: true, state: 'answered', delivery: { state: 'failed', error: 'initiator_requires_recovery' } })
  expect(ledger.load(db, 'message', `answer:${ask.askId}`)).toMatchObject({ recipient: 'project', error: 'initiator_requires_recovery', deliveredAt: null })
  expect(sessions.deliveries.filter(message => message.messageId === `answer:${ask.askId}`)).toEqual([])
})

it('preserves durable pending and answered state when the host gateway cannot deliver', async () => {
  sessions.failDelivery = true
  const ask = await service.ask('s-worker', { requestId: 'offline', question: 'Decision', decisionType: 'ordinary' })
  expect(ask).toMatchObject({ state: 'pending', delivery: { state: 'failed', error: 'delivery_failed' } })
  const result = await service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'A' }, human)
  expect(result).toMatchObject({ accepted: true, state: 'answered', delivery: { state: 'failed', error: 'delivery_failed' } })
  expect(ledger.load(db, 'ask', ask.askId)).toMatchObject({ status: 'answered', answer: 'A' })
  expect(ledger.load(db, 'message', `answer:${ask.askId}`)).toMatchObject({ error: 'gateway_offline', deliveredAt: null })
})

it('rejects conflicts unknown ambiguous and unauthorized addresses without fallback or broadcast', async () => {
  for (const input of [
    { message: 'hi' },
    { message: 'hi', askId: 'A', to: 'role:main' },
    { message: 'hi', agent_id: 'helper', to: 'role:main' },
  ])
    await expect(service.sendMessage('s-worker', 'conflict', input)).rejects.toMatchObject({ code: 'address_conflict' })
  await expect(service.sendMessage('s-worker', 'unknown', { to: 'random topic', message: 'hi' })).rejects.toMatchObject({ code: 'unknown_target' })
  await expect(service.sendMessage('s-worker', 'scope', { to: 'role:main', message: 'hi' })).rejects.toMatchObject({ code: 'scope_denied' })
  await expect(service.sendMessage('helper', 'unbound', { to: 'role:project', message: 'hi' })).rejects.toMatchObject({ code: 'unknown_binding' })
  ledger.createProject(db, { id: 'q', name: 'Q', workspaceId: 'q', directory: join(directory, 'q'), remoteUrl: 'https://github.com/org/q', available: true })
  ledger.updateProject(db, 'q', true, human)
  await run.bind({ id: 'project-q', role: 'project', projectId: 'q', sessionId: 's-project-q' })
  await expect(service.sendMessage('s-main', 'ambiguous', { to: 'role:project', message: 'hi' })).rejects.toMatchObject({ code: 'ambiguous_address' })
  await expect(service.sendMessage('s-worker', 'cross', { to: 'session:s-project-q', message: 'hi' })).rejects.toMatchObject({ code: 'scope_denied' })
  expect(ledger.list(db, 'message')).toHaveLength(0)
})

it('requires affected tickets for project and supervisor questions and derives the worker ticket', async () => {
  await expect(service.ask('s-project', { requestId: 'no-ticket', question: 'Decision' })).rejects.toMatchObject({ code: 'ticket_required' })
  await expect(service.ask('s-worker', { requestId: 'wrong-ticket', question: 'Decision', ticketIds: ['T2'] })).rejects.toMatchObject({ code: 'scope_denied' })
  const triage = await service.ask('s-main', { requestId: 'triage', question: 'Which project?' })
  expect(triage).toMatchObject({ state: 'pending', handler: 'human', ticketIds: [] })
  expect(ledger.list(db, 'ticket')).toHaveLength(2)
})

it('queues subscribed channel messages with explicit target and preserves the public message text', async () => {
  const thread = ledger.recordThread(db, { channelId: 'test', repository: 'github.com/org/p', kind: 'issue', resourceId: '7', title: 'Bug', projectId: 'p' })
  ledger.subscribeThread(db, 'T1', thread.id, human)
  const message = await service.sendMessage('s-worker', 'channel-message', { to: `channel:${thread.id}`, message: '测试已通过，等待验收。' })
  expect(message).toMatchObject({ accepted: true, to: thread.id, delivery: { state: 'pending' } })
  expect('outboxId' in message).toBe(true)
  if (!('outboxId' in message))
    throw new Error('Expected an ordinary channel receipt')
  expect(ledger.load(db, 'outbox', message.outboxId!)).toMatchObject({ recipient: thread.id, content: '测试已通过，等待验收。', state: 'pending' })
  expect(sessions.deliveries).toEqual([])
  expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ status: 'running' })
})

it('returns an answer arriving during request delivery without trying to suspend a settled ask', async () => {
  const original = sessions.deliver.bind(sessions)
  vi.spyOn(sessions, 'deliver').mockImplementation(async (sessionId, message, mode) => {
    await original(sessionId, message, mode)
    if (message.id.startsWith('mailbox:project:')) {
      const [pending] = service.list()
      await service.answer({ askId: pending.askId, policyBasis: pending.policyBasis, answer: 'Use A' }, human)
    }
  })
  expect(await service.ask('s-worker', { requestId: 'early-answer', question: 'Choose', decisionType: 'ordinary' })).toMatchObject({ state: 'answered', answer: 'Use A' })
  expect(sessions.cancellations).toEqual([])
})

it('does not lose answerability after restart or when an old role binding is explicitly replaced', async () => {
  const question = { requestId: 'recovery', question: 'Which project strategy?', ticketIds: ['T2'] }
  const original = await service.ask('s-project', question)
  ledger.updateBinding(db, 'project', 'closed', 'verified old process retirement')
  await run.bind({ id: 'project-new', role: 'project', sessionId: 's-project-new', projectId: 'p', previousBindingId: 'project', recoveryReason: 'replace closed manager' }, { kind: 'agent', sessionId: 's-main' })
  const resumed = await communication.create(db, run).ask('s-project-new', question)
  expect(resumed).toMatchObject({ askId: original.askId, state: 'pending', initiatorBinding: 'project', responseRecipient: 'project-new' })
  expect(service.list()).toHaveLength(1)
  expect(await service.answer({ askId: original.askId, policyBasis: original.policyBasis, answer: 'Keep current strategy' }, human)).toMatchObject({ to: 'project-new', state: 'answered' })
  expect(sessions.deliveries.at(-1)).toMatchObject({ sessionId: 's-project-new', messageId: `answer:${original.askId}` })
})

it('does not let read or handled receipts settle a pending question', async () => {
  const question = await service.ask('s-worker', { requestId: 'receipts', question: 'Choose', decisionType: 'ordinary' })
  const messageId = `ask:${question.askId}`
  vi.spyOn(sessions, 'receipt').mockResolvedValue('read' as never)
  await run.read('s-project', messageId)
  await run.handled('s-project', messageId)
  expect(ledger.load(db, 'message', messageId)).toMatchObject({ deliveryState: 'delivered' })
  expect(ledger.load(db, 'message', messageId)!.handledAt).not.toBeNull()
  expect(ledger.load(db, 'ask', question.askId)).toMatchObject({ status: 'pending', answer: null })
})

it('validates complete choices and nonempty formal answers before any settlement', async () => {
  const single = await service.ask('s-worker', { requestId: 'single', question: 'Choose', options: ['a', 'b'] })
  await expect(service.answer({ askId: single.askId, policyBasis: single.policyBasis, answer: '' }, human)).rejects.toMatchObject({ code: 'invalid_answer' })
  const multiple = await service.ask('s-worker', { requestId: 'multiple', question: 'Choose', options: ['a', 'b'], multiSelect: true })
  for (const selections of [undefined, [], ['a', 'a'], ['foreign']])
    await expect(service.answer({ askId: multiple.askId, policyBasis: multiple.policyBasis, answer: 'Selected', selections }, human)).rejects.toMatchObject({ code: 'invalid_answer' })
  expect(service.list().map(ask => ask.state)).toEqual(['pending', 'pending'])
  expect(ledger.list(db, 'message').filter(message => message.kind === 'answer')).toEqual([])
})

it('retires only the pending ask attention when a formal answer settles its wait', async () => {
  const ask = await service.ask('s-worker', { requestId: 'attention', question: 'Decision' })
  ledger.recordAttention(db, { id: 'paused-attention', ticketId: 'T1', bindingId: 'worker', recipient: 'project', reason: 'human_paused', waitingFor: 'Human unpause', progressAt: new Date().toISOString() })
  await service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'Use current scope' }, human)
  expect(ledger.load(db, 'attention', `ask:${ask.askId}`)).toMatchObject({ resolution: 'ask_answered' })
  expect(ledger.load(db, 'attention', `ask:${ask.askId}`)!.handledAt).not.toBeNull()
  expect(ledger.load(db, 'attention', 'paused-attention')).toMatchObject({ handledAt: null, reason: 'human_paused' })
})

it('shares one synchronous settlement contract with channel adapters without requiring a live tool call', async () => {
  const ask = await service.ask('s-worker', { requestId: 'adapter', question: 'Select targets', options: ['a', 'b'], multiSelect: true, detail: 'Both runtimes' })
  expect(() => communication.answer(db, { askId: ask.askId, policyBasis: ask.policyBasis, answer: 'default' }, human)).toThrow('invalid_answer')
  const result = communication.answer(db, { askId: ask.askId, policyBasis: ask.policyBasis, answer: 'Both selected', selections: ['a', 'b'] }, human)
  expect(result).toMatchObject({ accepted: true, ask: { id: ask.askId, status: 'answered', answer: 'Both selected', selections: '["a","b"]' } })
  expect(communication.answer(db, { askId: ask.askId, policyBasis: ask.policyBasis, answer: 'Different' }, human)).toMatchObject({ accepted: false, ask: { answer: 'Both selected' } })
  expect(ledger.list(db, 'message').filter(message => message.kind === 'answer')).toHaveLength(1)
})

it('requires current merge acceptance evidence and a trusted verifier rather than text or a default approval', async () => {
  const actor = { kind: 'agent', sessionId: 's-project' } as const
  const target = { repository: 'github.com/org/p', pullRequest: 'https://github.com/org/p/pull/7', base: 'main', head: 'abc' }
  ledger.setDeliveryTarget(db, 'T1', target, actor)
  const input = { requestId: 'verified-merge', question: 'Merge exact PR?', decisionType: 'merge' as const, target, options: ['allow_merge', 'deny_merge'] }
  await expect(service.ask('s-worker', input)).rejects.toMatchObject({ code: 'acceptance_evidence_required' })
  expect(service.list()).toEqual([])
  ledger.recordAcceptance(db, { id: 'merge-acceptance', executionBindingId: 'worker', ticketId: 'T1', scope: 'fix', evidence: ['regression suite passed'], basis: 'regression passes', verdict: 'accepted' }, actor)
  ledger.setPolicy(db, 'T1', { questionLevel: 'automatic', mergePolicy: 'automatic_allowed' }, 'Explicit human policy', human)
  const pending = await service.ask('s-worker', input)
  await expect(service.sendMessage('s-project', 'no-verifier', { askId: pending.askId, message: 'allow_merge', policyBasis: pending.policyBasis })).rejects.toMatchObject({ code: 'verification_required' })
  const verified = communication.create(db, run, async () => ({ target, verified: true }))
  expect(await verified.sendMessage('s-project', 'verified', { askId: pending.askId, message: 'allow_merge', policyBasis: pending.policyBasis })).toMatchObject({ accepted: true, state: 'answered', answer: 'allow_merge' })
  expect(ledger.load(db, 'ask', pending.askId)).toMatchObject({ verified: 1, target: JSON.stringify(target) })
  expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ status: 'running', prState: 'open' })
})

it('rejects supervisor no-ticket asks and external publication while preserving its scoped messages', async () => {
  ledger.bindRole(db, { id: 'supervisor', role: 'supervisor', sessionId: 's-supervisor', supervisorId: 'S', ticketIds: ['T1'] }, { kind: 'agent', sessionId: 's-main' })
  sessions.sessions.set('s-supervisor', { state: 'idle' })
  await expect(service.ask('s-supervisor', { requestId: 'supervisor-no-ticket', question: 'Decision' })).rejects.toMatchObject({ code: 'ticket_required' })
  await expect(service.ask('s-supervisor', { requestId: 'supervisor-cross', question: 'Decision', ticketIds: ['T2'] })).rejects.toMatchObject({ code: 'scope_denied' })
  const thread = ledger.recordThread(db, { channelId: 'test', repository: 'github.com/org/p', kind: 'issue', resourceId: '7', title: 'Bug', projectId: 'p' })
  ledger.subscribeThread(db, 'T1', thread.id, human)
  await expect(service.sendMessage('s-supervisor', 'supervisor-external', { to: `channel:${thread.id}`, ticketId: 'T1', message: 'No authority to publish' })).rejects.toMatchObject({ code: 'scope_denied' })
  expect(await service.sendMessage('s-supervisor', 'supervisor-main', { to: 'role:main', ticketId: 'T1', message: 'Need coordination', facts: { state: 'progress', summary: 'Dependencies mapped', evidence: ['T1 depends on shared API'] } })).toMatchObject({ accepted: true, to: 'main' })
  expect(ledger.list(db, 'outbox')).toEqual([])
})

it('preserves an explicit human custom answer instead of forcing ordinary questions into a questionnaire', async () => {
  const ask = await service.ask('s-worker', { requestId: 'custom', question: 'Which approach?', options: ['a', 'b'] })
  expect(await service.answer({ askId: ask.askId, policyBasis: ask.policyBasis, answer: 'Neither; keep the current behavior' }, human)).toMatchObject({ accepted: true, state: 'answered', answer: 'Neither; keep the current behavior' })
})
