import type { ClientContext } from '../src/client/types/context'
import type { NexusDatabase } from '../src/database'
import type { SessionSnapshot } from '../src/runtime/types'
import type { ProjectInput } from '../src/types/ledger'
import type { WebPorts, WebServerOptions } from '../src/types/web'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { H3 } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GitHubChannel } from '../src/channel/github/channel'
import { openSidechat } from '../src/client/service/sidechat'
import { openDatabase } from '../src/database'
import { postAnswer } from '../src/server/routes/asks.post'
import { getPanel } from '../src/server/routes/panel.get'
import { patchSettings } from '../src/server/routes/settings.patch'
import { getTicket } from '../src/server/routes/tickets.get'
import { postTicket } from '../src/server/routes/tickets.post'
import { communication } from '../src/service/communication'
import { ledger } from '../src/service/ledger'
import { runtime } from '../src/service/runtime'
import { webPanel } from '../src/service/web-panel'

const owner = { kind: 'web', authenticated: true, userId: 'owner' } as const
let db: NexusDatabase
let directory: string
let panel: ReturnType<typeof webPanel.create>
let run: ReturnType<typeof runtime.create>
let discovered: ProjectInput[]
let ports: WebPorts
let sessions: Map<string, SessionSnapshot>

beforeEach(async () => {
  directory = join(import.meta.dirname, '../.temp', `web-${randomUUID()}`)

  await mkdir(directory, { recursive: true })

  db = await openDatabase(directory)

  ledger.getSettings(db)

  ledger.bindRole(db, { id: 'main', role: 'main', sessionId: 's-main' })

  ledger.createProject(db, { id: 'p', name: 'Project', workspaceId: 'w', directory, remoteUrl: 'https://github.com/org/p', available: true })

  ledger.updateProject(db, 'p', true, owner)

  ledger.bindRole(db, { id: 'project', role: 'project', sessionId: 's-project', projectId: 'p' })

  ledger.createTicket(db, { id: 'T1', projectId: 'p', channelId: 'github', title: 'Fix', authorization: 'Fix the bug', acceptanceCriteria: 'Regression passes' }, owner)

  sessions = new Map(['s-main', 's-project'].map(id => [id, { state: 'idle' }]))

  run = runtime.create(db, {
    inspect: async id => sessions.get(id) ?? { state: 'missing' },
    create: async () => {},
    resume: async () => {},
    deliver: async () => {},
    receipt: async () => 'absent',
    cancel: async () => {},
    stop: async () => true,
  }, { timeout: () => () => {} }, join(directory, 'managers'))

  discovered = [{ id: 'p', name: 'Project', workspaceId: 'w', directory, remoteUrl: 'https://github.com/org/p', available: true }]

  const github = new GitHubChannel(db, { request: async () => {
    throw new Error('network_forbidden')
  } })

  ports = { startup: () => ({ state: 'ready', reason: null }), runtime: run, communication: communication.create(db, run), discoverProjects: async () => discovered, sourceContext: async sessionId => ({ sessionId, available: false, reason: 'source_missing', entries: [] }), githubStatus: projectId => github.status(projectId), verifyMerge: async ask => ({ target: JSON.parse(ask.target!), verified: true }), reconcileExternal: async () => 'unknown' }

  panel = webPanel.create(db, ports)
})

afterEach(async () => {
  await run.dispose()

  db.close()

  vi.restoreAllMocks()

  vi.useRealTimers()

  await rm(directory, { recursive: true, force: true })
})

it('distinguishes idle, running, unavailable and delivery failure from durable facts', () => {
  ports.startup = () => ({ state: 'starting', reason: null })
  expect(panel.resolve().run.state).toBe('initializing')
  ports.startup = () => ({ state: 'failed', reason: 'preset_unavailable' })
  expect(panel.resolve().run).toMatchObject({ state: 'initialization_failed', reason: 'preset_unavailable' })
  ports.startup = () => ({ state: 'ready', reason: null })
  expect(panel.resolve().run).toMatchObject({ state: 'idle', reason: null })
  ledger.updateBinding(db, 'project', 'running', 'turn started')
  expect(panel.resolve().run.state).toBe('running')
  ledger.updateBinding(db, 'project', 'unavailable', 'model_unavailable')
  expect(panel.resolve().run).toMatchObject({ state: 'unavailable', reason: 'model_unavailable' })
  const message = ledger.sendMessage(db, 'failed-delivery', 'main', 'T1', 'Delivery', owner)
  ledger.updateMessage(db, message.id, 'failed', 'session_unavailable')
  expect(panel.resolve().run).toMatchObject({ state: 'delivery_failed', reason: 'session_unavailable' })
})

it('projects only human pending questions and preserves who waits, form and reminders on the original ask', () => {
  ledger.createAsk(db, { id: 'human', ticketIds: ['T1'], source: 'topic:7', content: 'Choose targets', options: ['a', 'b'], presentation: { multiSelect: true }, decisionType: 'important', withinAuthorization: true }, { kind: 'agent', sessionId: 's-main' })

  ledger.createAsk(db, { id: 'agent', ticketIds: ['T1'], source: 'topic:8', content: 'Internal question', options: [], decisionType: 'ordinary', withinAuthorization: true }, { kind: 'agent', sessionId: 's-project' })

  ledger.recordAttention(db, { id: 'reminder', askId: 'human', reason: 'pending_ask', waitingFor: 'human', progressAt: '2026-11-01T00:00:00.000Z', recipient: 'human' })

  ledger.updateAttention(db, 'reminder', 'reminded', 'Waiting for owner')

  const inbox = panel.inbox()

  expect(inbox.pending).toHaveLength(1)

  expect(inbox.pending[0]).toMatchObject({ id: 'human', waiting: { role: 'main', sessionId: 's-main' }, options: ['a', 'b'], presentation: { multiSelect: true }, ticketIds: ['T1'], source: 'topic:7', actionable: true })

  expect(inbox.pending[0].waitingMilliseconds).toBeGreaterThanOrEqual(0)

  expect(inbox.pending[0].reminders).toEqual([expect.objectContaining({ id: 'reminder', remindedAt: expect.any(String), due: true })])
})

it('reconciles GitHub answers without another pending card and exposes failed sync on the settled ask', async () => {
  ledger.updateSettings(db, { whitelist: ['alice'] }, owner)

  const ask = ledger.createAsk(db, { id: 'cross', ticketIds: ['T1'], source: 'topic:7', content: 'Proceed?', options: ['yes', 'no'], decisionType: 'important', withinAuthorization: true }, { kind: 'agent', sessionId: 's-main' })

  communication.answer(db, { askId: ask.id, policyBasis: ask.policyBasis, answer: 'yes' }, { kind: 'github', verified: true, providerId: '42', login: 'alice', bot: false, outbound: false })

  expect(panel.inbox().pending).toEqual([])

  expect(panel.inbox().resolved[0]).toMatchObject({ id: 'cross', answer: 'yes', answerSource: 'github', actionable: false })

  const duplicate = await panel.answer({ askId: ask.id, policyBasis: ask.policyBasis, answer: 'no' }, owner)

  expect(duplicate).toMatchObject({ result: { accepted: false, reason: 'ask_answered', answer: 'yes' }, ask: { answerSource: 'github', actionable: false } })

  const thread = ledger.recordThread(db, { channelId: 'github', repository: 'github.com/org/p', resourceId: '7', kind: 'issue', title: 'Original', projectId: 'p' })

  ledger.subscribeThread(db, 'T1', thread.id, owner)

  const outgoing = ledger.publishMessage(db, 'answer:cross', thread.id, owner)

  ledger.updateOutbox(db, outgoing.id, 'failed', 'github_offline')

  expect(panel.inbox().resolved[0].publications).toEqual([expect.objectContaining({ state: 'failed', error: 'github_offline' })])

  expect(panel.inbox().pending).toHaveLength(0)
})

it('shows a human-required merge with exact evidence and withdraws controls when the head changes', async () => {
  const manager = { kind: 'agent', sessionId: 's-project' } as const

  ledger.bindRole(db, { id: 'worker', role: 'worker', sessionId: 's-worker', projectId: 'p', ticketId: 'T1', repository: 'github.com/org/p', worktree: join(directory, 'worker'), branch: 'ticket/T1' }, manager)

  ledger.dispatchTicket(db, 'T1', manager)

  ledger.startTicket(db, 'T1', 'worker', manager)

  ledger.setPolicy(db, 'T1', { questionLevel: 'automatic', mergePolicy: 'human_required' }, 'Owner reviews merges', owner)

  const target = { repository: 'github.com/org/p', pullRequest: 'https://github.com/org/p/pull/7', base: 'main', head: 'abc' }

  ledger.setDeliveryTarget(db, 'T1', target, manager)

  ledger.recordAcceptance(db, { id: 'accept', executionBindingId: 'worker', ticketId: 'T1', scope: 'fix', evidence: ['regression passed'], basis: 'Regression passes', verdict: 'accepted' }, manager)

  const ask = ledger.createAsk(db, { id: 'merge', ticketIds: ['T1'], source: 'topic:7', content: 'Merge?', options: ['allow_merge', 'deny_merge'], decisionType: 'merge', withinAuthorization: true, target }, { kind: 'agent', sessionId: 's-worker' })

  expect(panel.inbox().pending[0]).toMatchObject({ id: 'merge', target, humanRequired: true, actionable: true, evidence: [expect.objectContaining({ id: 'accept', evidence: '["regression passed"]' })] })

  ledger.recordPullRequest(db, 'T1', { ...target, head: 'def' }, 'open', 'pending')

  expect(panel.inbox().pending).toEqual([])

  expect(panel.ticket('T1').asks[0]).toMatchObject({ id: 'merge', status: 'cancelled', cancelReason: 'delivery_target_changed', actionable: false })

  await expect(panel.answer({ askId: ask.id, policyBasis: ask.policyBasis, answer: 'allow_merge', target }, owner)).rejects.toMatchObject({ code: 'target_changed' })
})

it('keeps existing ticket snapshots when saving global defaults and records explicit per-ticket changes', () => {
  panel.setSettings({ defaultQuestionLevel: 'detailed', defaultMergePolicy: 'human_required', maxWorkers: 3, whitelist: ['Alice'] }, owner)

  expect(panel.settings()).toMatchObject({ defaultQuestionLevel: 'detailed', maxWorkers: 3, whitelist: ['alice'] })

  expect(panel.ticket('T1').ticket).toMatchObject({ questionLevel: 'important', mergePolicy: 'follow_question_level' })

  panel.setPolicy('T1', { questionLevel: 'automatic', mergePolicy: 'automatic_allowed' }, 'Explicit exception', owner)

  expect(panel.ticket('T1').ticket).toMatchObject({ questionLevel: 'automatic', mergePolicy: 'automatic_allowed' })

  expect(() => panel.setSettings({ maxWorkers: 17 }, owner)).toThrow('invalid_config')
})

it('refreshes real project discovery without enabling new projects or deleting unavailable history', async () => {
  discovered.push({ id: 'new', name: 'New', workspaceId: 'new', directory, remoteUrl: 'https://github.com/org/new', available: true })

  expect(await panel.refreshProjects()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'p', enabled: 1 }), expect.objectContaining({ id: 'new', enabled: 0 })]))

  await panel.setProject('p', false, owner)

  await panel.refreshProjects()

  expect(panel.overview().projects.find(item => item.id === 'p')).toMatchObject({ enabled: 0, available: 1 })

  discovered = []

  await panel.refreshProjects()

  expect(panel.overview().projects).toHaveLength(2)

  expect(panel.overview().projects.find(item => item.id === 'p')).toMatchObject({ enabled: 0, available: 0 })

  await expect(panel.setProject('p', true, owner)).rejects.toMatchObject({ code: 'project_unavailable' })
})

it('projects graph relationships, dependencies, topics and honest GitHub environment status', () => {
  ledger.createTicket(db, { id: 'T2', projectId: 'p', channelId: 'github', title: 'Follow-up', authorization: 'Next', acceptanceCriteria: 'Pass' }, owner)

  ledger.linkTickets(db, 'T2', 'T1', 'depends', owner)

  const thread = ledger.recordThread(db, { channelId: 'github', repository: 'github.com/org/p', resourceId: '7', kind: 'issue', title: 'Original', projectId: 'p', url: 'https://github.com/org/p/issues/7' })

  ledger.subscribeThread(db, 'T1', thread.id, owner)

  expect(panel.overview().graph.edges).toEqual(expect.arrayContaining([{ source: 'binding:main', target: 'project:p', kind: 'flow' }, { source: 'project:p', target: 'ticket:T1', kind: 'flow' }, { source: 'ticket:T2', target: 'ticket:T1', kind: 'dependency' }]))

  expect(panel.ticket('T1').topics).toEqual([expect.objectContaining({ id: thread.id, url: 'https://github.com/org/p/issues/7' })])

  expect(panel.channels()[0]).toMatchObject({ available: false, reason: 'environment_not_selected' })

  ledger.saveSourceState(db, 'github', 'github:github.com/org/p:environment_status', JSON.stringify({ available: false, reason: 'account_changed' }))

  expect(panel.channels()[0]).toMatchObject({ available: false, reason: 'account_changed', facts: [expect.objectContaining({ name: 'environment_status', value: { available: false, reason: 'account_changed' } })] })
})

it('keeps dispatch acceptance separate from execution and never clears a human pause through ordinary messages', async () => {
  expect(await panel.command('T1', 'dispatch', '', owner)).toMatchObject({ accepted: true, started: false, ticket: { status: 'queued' } })

  await panel.command('T1', 'pause', 'Owner stopped work', owner)

  expect(panel.inbox().blocked[0]).toMatchObject({ ticket: { id: 'T1', paused: 1 }, waitingFor: 'human' })

  ledger.sendMessage(db, 'ordinary', 'project', 'T1', 'Please continue', owner)

  expect(panel.ticket('T1').ticket.paused).toBe(1)

  await panel.command('T1', 'resume', 'Explicit owner resume', owner)

  expect(panel.ticket('T1').ticket.paused).toBe(0)

  expect(await panel.context('s-main')).toEqual({ sessionId: 's-main', available: false, reason: 'source_missing', entries: [] })

  await expect(panel.context('not-a-session')).rejects.toMatchObject({ code: 'unknown_binding' })
})

function routes(): H3 {
  const app = new H3()

  const options: WebServerOptions = { panel, owner: event => event.req.headers.get('x-test-authenticated-owner') === 'yes' ? owner : null }

  app.use((event) => {
    event.context.__host_instance = { context: {}, options }
  })

  app.get('/api/nexus/panel', getPanel)

  app.get('/api/nexus/tickets/:id', getTicket)

  app.post('/api/nexus/tickets/:id/:action', postTicket)

  app.post('/api/nexus/asks/:id/answers', postAnswer)

  app.patch('/api/nexus/settings', patchSettings)

  return app
}

function http(path: string, method = 'GET', body?: unknown, authenticated = true, origin = 'http://nexus'): Request {
  return new Request(`http://nexus/api/nexus/${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-authenticated-owner': authenticated ? 'yes' : 'no', origin }, body: body === undefined ? undefined : JSON.stringify(body) })
}

it('rejects unauthenticated and cross-origin requests without trusting a body-claimed owner', async () => {
  const app = routes()

  const unauthorized = await app.fetch(http('settings', 'PATCH', { maxWorkers: 1, actor: owner }, false))

  expect(unauthorized.status).toBe(401)

  expect(await unauthorized.json()).toMatchObject({ data: { code: 'owner_required' } })

  const claimed = await app.fetch(http('settings', 'PATCH', { maxWorkers: 1, actor: owner }))

  expect(claimed.status).toBe(400)

  const foreign = await app.fetch(http('settings', 'PATCH', { maxWorkers: 1 }, true, 'http://foreign'))

  expect(foreign.status).toBe(403)

  expect(panel.settings().maxWorkers).toBe(4)
})

it('routes controlled owner queries and validated writes through the real ledger with distinguishable errors', async () => {
  const app = routes()

  const response = await app.fetch(http('panel'))

  expect(response.status).toBe(200)

  expect(response.headers.get('cache-control')).toBe('no-store')

  expect(await response.json()).toMatchObject({ projects: [expect.objectContaining({ id: 'p' })], tickets: [{ ticket: { id: 'T1' } }] })

  const saved = await app.fetch(http('settings', 'PATCH', { maxWorkers: 2 }))

  expect(saved.status).toBe(200)

  expect(panel.settings().maxWorkers).toBe(2)

  expect((await app.fetch(http('settings', 'PATCH', { maxWorkers: '2' }))).status).toBe(400)

  expect((await app.fetch(http('tickets/missing'))).status).toBe(404)

  expect((await app.fetch(http('tickets/T1/retry', 'POST', { reason: 'Retry requested' }))).status).toBe(409)

  expect((await app.fetch(http('tickets/T1/fake', 'POST', { reason: 'No such action' }))).status).toBe(404)
})

it('returns the actual competing answer through HTTP and never accepts browser-supplied merge verification', async () => {
  const ask = ledger.createAsk(db, { id: 'http', ticketIds: ['T1'], source: 'web-test', content: 'Choose', options: ['a', 'b'], presentation: { multiSelect: true }, decisionType: 'important', withinAuthorization: true }, { kind: 'agent', sessionId: 's-main' })

  const app = routes()

  expect((await app.fetch(http('asks/http/answers', 'POST', { answer: 'Both', selections: ['a', 'b'], policyBasis: ask.policyBasis, verified: true }))).status).toBe(400)

  expect((await app.fetch(http('asks/http/answers', 'POST', { answer: 'Both', selections: ['a', 'bad'], policyBasis: ask.policyBasis }))).status).toBe(400)

  const answered = await app.fetch(http('asks/http/answers', 'POST', { answer: 'Both', selections: ['a', 'b'], policyBasis: ask.policyBasis }))

  expect(answered.status).toBe(200)

  expect(await answered.json()).toMatchObject({ result: { accepted: true }, ask: { answer: 'Both', selections: ['a', 'b'], answerSource: 'web', answerActor: JSON.stringify(owner) } })

  const duplicate = await app.fetch(http('asks/http/answers', 'POST', { answer: 'Other', selections: ['b'], policyBasis: ask.policyBasis }))

  expect(await duplicate.json()).toMatchObject({ result: { accepted: false, reason: 'ask_answered' }, ask: { answer: 'Both', actionable: false, answerSource: 'web' } })

  expect(ledger.list(db, 'message').filter(message => message.kind === 'answer')).toHaveLength(1)
})

it('keeps a Web answer settled when updating a previously sent GitHub comment fails', async () => {
  const ask = ledger.createAsk(db, { id: 'sync', ticketIds: ['T1'], source: 'topic:7', content: 'Proceed?', options: [], decisionType: 'important', withinAuthorization: true }, { kind: 'agent', sessionId: 's-main' })

  const thread = ledger.recordThread(db, { channelId: 'github', repository: 'github.com/org/p', resourceId: '7', kind: 'issue', title: 'Original', projectId: 'p' })

  ledger.subscribeThread(db, 'T1', thread.id, owner)

  const request = ledger.list(db, 'message').find(message => message.askId === ask.id)!

  const publication = ledger.publishMessage(db, request.id, thread.id, owner)

  ledger.updateOutbox(db, publication.id, 'sent', '', 'comment-1', 'https://github.com/org/p/issues/7#issuecomment-1')

  await panel.answer({ askId: ask.id, policyBasis: ask.policyBasis, answer: 'Continue' }, owner)

  ledger.saveSourceState(db, 'github', `github:github.com/org/p:delivery_status:${publication.id}`, JSON.stringify({ ok: false, reason: 'rate_limited' }))

  expect(panel.inbox().pending).toEqual([])

  expect(panel.inbox().resolved[0]).toMatchObject({ answerSource: 'web', actionable: false, publications: [expect.objectContaining({ state: 'sent', syncProblem: 'rate_limited', syncAt: expect.any(String) })] })
})

it('shows a due human escalation on the original agent-handled ask rather than creating another ask card', () => {
  ledger.createAsk(db, { id: 'agent-wait', ticketIds: ['T1'], source: 'topic:7', content: 'Agent decision', options: [], decisionType: 'ordinary', withinAuthorization: true }, { kind: 'agent', sessionId: 's-project' })

  expect(panel.inbox().pending).toEqual([])

  ledger.recordAttention(db, { id: 'escalated', askId: 'agent-wait', reason: 'pending_ask', waitingFor: 'main', progressAt: '2026-11-01T00:00:00Z', recipient: 'human' })

  expect(panel.inbox().pending).toEqual([expect.objectContaining({ id: 'agent-wait', actionable: false, reminders: [expect.objectContaining({ id: 'escalated', due: true })] })])

  ledger.updateAttention(db, 'escalated', 'reminded', 'Owner notified')

  expect(panel.inbox().pending).toHaveLength(1)

  expect(ledger.list(db, 'ask')).toHaveLength(1)
})

it('opens only the explicit source sidechat without answering or settling the persistent ask', () => {
  ledger.createAsk(db, { id: 'sidechat', ticketIds: ['T1'], source: 'topic:7', content: 'Need background', options: [], decisionType: 'important', withinAuthorization: true }, { kind: 'agent', sessionId: 's-main' })

  const openTab = vi.fn()

  const openSession = vi.fn()

  const sidebar = { getTab: () => ({ id: 'sidechat' }), isTabEnabled: () => true, openTab }

  const ctx = { get: () => sidebar, uiWorkspace: { openSession } } as unknown as ClientContext

  Object.defineProperty(ctx, 'betterSidebar', { get: () => {
    throw new Error('cannot get property betterSidebar without inject')
  } })

  openSidechat(ctx, 's-main')

  expect(openTab).toHaveBeenCalledExactlyOnceWith({ type: 'sidechat' }, { sessionId: 's-main' })

  expect(openSession).toHaveBeenCalledExactlyOnceWith('s-main')

  expect(panel.inbox().pending[0]).toMatchObject({ id: 'sidechat', status: 'pending', answer: null })

  const disabled = { ...ctx, get: () => ({ ...sidebar, isTabEnabled: () => false }) } as unknown as ClientContext

  expect(() => openSidechat(disabled, 's-main')).toThrow('禁用')

  expect(openTab).toHaveBeenCalledTimes(1)
})

it('verifies a Web merge answer against the exact visible head before the communication service settles it', async () => {
  const manager = { kind: 'agent', sessionId: 's-project' } as const

  ledger.bindRole(db, { id: 'merge-worker', role: 'worker', sessionId: 's-merge-worker', projectId: 'p', ticketId: 'T1', repository: 'github.com/org/p', worktree: join(directory, 'worker'), branch: 'ticket/T1' }, manager)

  ledger.dispatchTicket(db, 'T1', manager)

  ledger.startTicket(db, 'T1', 'merge-worker', manager)

  ledger.setPolicy(db, 'T1', { questionLevel: 'automatic', mergePolicy: 'human_required' }, 'Owner reviews merges', owner)

  const target = { repository: 'github.com/org/p', pullRequest: 'https://github.com/org/p/pull/7', base: 'main', head: 'abc' }

  ledger.setDeliveryTarget(db, 'T1', target, manager)

  ledger.recordAcceptance(db, { id: 'accept', executionBindingId: 'merge-worker', ticketId: 'T1', scope: 'fix', evidence: ['regression passed'], basis: 'Regression passes', verdict: 'accepted' }, manager)

  const ask = ledger.createAsk(db, { id: 'verified-merge', ticketIds: ['T1'], source: 'topic:7', content: 'Merge?', options: ['allow_merge', 'deny_merge'], decisionType: 'merge', withinAuthorization: true, target }, { kind: 'agent', sessionId: 's-merge-worker' })

  const input = { askId: ask.id, policyBasis: ask.policyBasis, answer: 'allow_merge', target }

  const verifier = vi.fn(async () => ({ verified: false, target }))

  const service = webPanel.create(db, { ...ports, verifyMerge: verifier })

  await expect(service.answer(input, owner)).rejects.toMatchObject({ code: 'verification_required' })

  expect(service.inbox().pending[0].answer).toBeNull()

  verifier.mockResolvedValueOnce({ verified: true, target: { ...target, head: 'changed-during-preflight' } })

  await expect(service.answer(input, owner)).rejects.toMatchObject({ code: 'stale_target' })

  expect(service.inbox().pending[0].actionable).toBe(true)

  verifier.mockResolvedValueOnce({ verified: true, target })

  expect(await service.answer(input, owner)).toMatchObject({ result: { accepted: true }, ask: { answerSource: 'web', verified: 1, actionable: false } })

  expect(verifier).toHaveBeenCalledWith(expect.objectContaining({ id: ask.id, target: JSON.stringify(target) }), owner)

  expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ status: 'running', prState: 'open' })
})

it('retains workspace identity and enable choice when discovery supplies a regenerated display id', async () => {
  discovered = [{ ...discovered[0], id: 'regenerated', name: 'Renamed project' }]

  await panel.refreshProjects()

  expect(panel.overview().projects).toEqual([expect.objectContaining({ id: 'p', workspaceId: 'w', name: 'Renamed project', enabled: 1 })])

  await panel.command('T1', 'cancel', 'No longer needed', owner)

  expect(panel.ticket('T1').ticket.status).toBe('cancelled')
})

it('bounds source context while preserving origin time and explicit source-read failures', async () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({ origin: 'assistant/message', at: `2026-11-16T00:00:${String(index).padStart(2, '0')}Z`, text: `Original event ${index}` }))

  const source = webPanel.create(db, { ...ports, sourceContext: async sessionId => ({ sessionId, available: true, reason: null, entries }) })

  const context = await source.context('s-main')

  expect(context.entries).toHaveLength(8)

  expect(context.entries[0]).toEqual({ origin: 'assistant/message', at: '2026-11-16T00:00:04Z', text: 'Original event 4' })

  expect(context.entries[7]).toEqual({ origin: 'assistant/message', at: '2026-11-16T00:00:11Z', text: 'Original event 11' })

  const failed = webPanel.create(db, { ...ports, sourceContext: async () => {
    throw new Error('session_store_unavailable')
  } })

  await expect(failed.context('s-main')).rejects.toThrow('session_store_unavailable')
})
