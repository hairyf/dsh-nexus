import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { NexusDatabase } from '../src/database'
import type { SessionSnapshot } from '../src/runtime/types'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GitHubChannel } from '../src/channel/github/channel'
import { createManagementTools } from '../src/communication/management'
import { createCommunicationTools } from '../src/communication/tools'
import { openDatabase } from '../src/database'
import { communication } from '../src/service/communication'
import { ledger } from '../src/service/ledger'
import { runtime } from '../src/service/runtime'

const human = { kind: 'web', authenticated: true, userId: 'owner' } as const
let db: NexusDatabase
let directory: string
let run: ReturnType<typeof runtime.create>
let github: GitHubChannel
let sessions: Map<string, SessionSnapshot>
let writersStopped: boolean
let nativeEvents: unknown[]

beforeEach(async () => {
  directory = join(import.meta.dirname, '../.temp', `management-${randomUUID()}`)
  db = await openDatabase(directory)
  sessions = new Map()
  writersStopped = true
  nativeEvents = []
  run = runtime.create(db, {
    inspect: async id => sessions.get(id) ?? { state: 'missing' },
    create: async (id, _preset, cwd) => {
      sessions.set(id, { state: 'idle', cwd })
    },
    resume: async () => {},
    deliver: async () => {},
    receipt: async () => 'read',
    cancel: async () => {},
    stop: async () => writersStopped,
  }, { timeout: () => () => {} }, join(directory, 'managers'))
  github = new GitHubChannel(db, { request: async () => {
    throw new Error('Unexpected GitHub request')
  } })
  await run.bind({ id: 'main', role: 'main', sessionId: 's-main' })
  for (const id of ['p', 'q']) {
    ledger.createProject(db, { id, name: id, workspaceId: id, directory: join(directory, id), remoteUrl: `https://github.com/org/${id}`, available: true })
    ledger.updateProject(db, id, true, human)
    await run.bind({ id, role: 'project', sessionId: `s-${id}`, projectId: id })
    ledger.createTicket(db, { id: id.toUpperCase(), projectId: id, channelId: 'github', title: id, authorization: 'fix bug', acceptanceCriteria: 'regression passes' }, human)
  }
  ledger.updateSettings(db, { whitelist: ['alice'] }, human)
})

afterEach(async () => {
  await run.dispose()
  db.close()
  await rm(directory, { recursive: true, force: true })
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function call(role: string, name: string, args: Record<string, unknown> = {}, sessionId = `s-${role}`, signal = new AbortController().signal): Promise<any> {
  const binding = ledger.load(db, 'role_binding', role)!
  const tool = createManagementTools(db, run, github, binding).find(tool => tool.name === name)
  if (!tool)
    throw new Error(`Missing tool: ${name}`)
  return tool.execute(args, { agent: { session: { id: sessionId, snapshotEvents: () => nativeEvents } }, signal, callId: `call-${name}` } as unknown as ToolRunContext)
}

function source(projectId: string, resourceId: string, login = 'alice') {
  const thread = ledger.recordThread(db, { channelId: 'github', projectId, repository: `github.com/org/${projectId}`, kind: 'issue', resourceId, title: 'Fix bug' })
  const { trigger } = ledger.recordTrigger(db, { id: `trigger-${resourceId}`, threadId: thread.id, kind: 'comment', text: 'Please fix bug', at: new Date().toISOString(), mentioned: true }, { kind: 'github', verified: true, providerId: '42', login, bot: false, outbound: false })
  return { thread, trigger }
}

it('admits tickets only from currently authorized persisted sources and deduplicates retries', async () => {
  const { thread, trigger } = source('p', '2')
  const args = { requestId: 'fix-2', triggerId: trigger.id, projectId: 'p', title: 'Fix bug', authorization: 'fix only the reported bug', acceptanceCriteria: 'reported regression passes' }
  const first = await call('main', 'create_ticket', args)
  const again = await call('main', 'create_ticket', args)
  expect(again.ticket.id).toBe(first.ticket.id)
  expect(first.ticket).toMatchObject({ status: 'waiting', authorization: args.authorization, acceptanceCriteria: args.acceptanceCriteria })
  expect((await call('main', 'list_ticket')).subscriptions).toContainEqual(expect.objectContaining({ ticketId: first.ticket.id, threadId: thread.id }))
  await expect(call('main', 'create_ticket', { ...args, projectId: 'q', requestId: 'cross' })).rejects.toMatchObject({ code: 'scope_denied' })
  const untrusted = source('p', '3', 'mallory')
  await expect(call('main', 'create_ticket', { ...args, triggerId: untrusted.trigger.id, actor: human })).rejects.toMatchObject({ code: 'unauthorized_source' })
  ledger.updateSettings(db, { whitelist: [] }, human)
  await expect(call('main', 'create_ticket', { ...args, requestId: 'revoked' })).rejects.toMatchObject({ code: 'unauthorized_source' })
  expect((await call('main', 'list_ticket')).tickets).toHaveLength(3)
})

it('admits native owner goals across enabled projects and preserves the actual source atomically', async () => {
  const message = createUserMessage({ content: [{ type: 'text', text: 'Investigate p and q, both read only' }], source: { kind: 'user' } })
  nativeEvents = [{ type: 'user/message', data: { ...message, source: { kind: 'user', rpcId: 'owner-request' } } }]
  const args = { requestId: 'native-q', sourceMessageId: message.id, projectId: 'q', title: 'Read-only q', authorization: 'read-only investigation', acceptanceCriteria: 'actual branch report' }
  expect((await call('main', 'list_ticket')).nativeSource).toMatchObject({ messageId: message.id, rpcId: 'owner-request' })
  const first = await call('main', 'create_ticket', args)
  expect(first.source).toMatchObject({ messageId: message.id, rpcId: 'owner-request', sessionId: 's-main' })
  expect(first.ticket).toMatchObject({ projectId: 'q', channelId: 'nexus', questionLevel: 'important', mergePolicy: 'follow_question_level' })
  expect((await call('main', 'create_ticket', args)).ticket.id).toBe(first.ticket.id)
  const source = ledger.list(db, 'source_state').find(row => row.name === `native_source:${first.ticket.id}`)!
  expect(JSON.parse(source.value)).toEqual({ kind: 'native_user', sessionId: 's-main', messageId: message.id, rpcId: 'owner-request' })
  expect(ledger.list(db, 'ticket_thread').filter(row => row.ticketId === first.ticket.id)).toEqual([])
  expect(ledger.list(db, 'ticket')).toHaveLength(3)
})

it('rejects missing, mixed, forged and unverifiable native sources without a partial ticket', async () => {
  const message = createUserMessage({ content: [{ type: 'text', text: 'Owner goal' }], source: { kind: 'user' } })
  const args = { requestId: 'native-reject', projectId: 'q', title: 'q', authorization: 'read only', acceptanceCriteria: 'report' }
  await expect(call('main', 'create_ticket', args)).rejects.toMatchObject({ code: 'invalid_source' })
  await expect(call('main', 'create_ticket', { ...args, sourceMessageId: message.id, triggerId: 'fake' })).rejects.toMatchObject({ code: 'invalid_source' })
  await expect(call('main', 'create_ticket', { ...args, sourceMessageId: message.id, actor: human, human: true, verified: true })).rejects.toMatchObject({ code: 'unauthorized_source' })
  nativeEvents = [{ type: 'user/message', data: message }]
  await expect(call('main', 'create_ticket', { ...args, sourceMessageId: message.id })).rejects.toMatchObject({ code: 'source_unverifiable' })
  nativeEvents = [{ type: 'user/message', data: { ...message, source: { kind: 'nexus', rpcId: 'not-owner' } } }]
  await expect(call('main', 'create_ticket', { ...args, sourceMessageId: message.id })).rejects.toMatchObject({ code: 'unauthorized_source' })
  nativeEvents = [{ type: 'user/message', data: { ...message, source: { kind: 'user', rpcId: 'owner-request' } } }]
  await expect(call('main', 'create_ticket', { ...args, sourceMessageId: 'absent' })).rejects.toMatchObject({ code: 'unauthorized_source' })
  await expect(call('main', 'create_ticket', { ...args, sourceMessageId: message.id }, 's-q')).rejects.toMatchObject({ code: 'unbound_actor' })
  nativeEvents = [{ type: 'user/message', data: { ...message, source: { kind: 'user', rpcId: 'guest-request', principal: { kind: 'share-viewer' } } } }]
  expect((await call('main', 'list_ticket')).nativeSource).toBeNull()
  await expect(call('main', 'create_ticket', { ...args, sourceMessageId: message.id })).rejects.toMatchObject({ code: 'unauthorized_source' })
  const newer = createUserMessage({ content: [{ type: 'text', text: 'Replace the old goal' }], source: { kind: 'user' } })
  nativeEvents = [{ type: 'user/message', data: { ...message, source: { kind: 'user', rpcId: 'owner-request' } } }, { type: 'user/message', data: { ...newer, source: { kind: 'user', rpcId: 'new-owner-request' } } }]
  await expect(call('main', 'create_ticket', { ...args, sourceMessageId: message.id })).rejects.toMatchObject({ code: 'unauthorized_source' })
  nativeEvents = [{ type: 'user/message', data: { ...message, source: { kind: 'user', rpcId: 'owner-request' } } }]
  ledger.updateProject(db, 'q', false, human)
  await expect(call('main', 'create_ticket', { ...args, sourceMessageId: message.id })).rejects.toMatchObject({ code: 'project_disabled' })
  expect(ledger.list(db, 'ticket')).toHaveLength(2)
  expect(ledger.list(db, 'source_state')).toEqual([])
})

it('rolls native creation back if its authoritative provenance cannot persist', async () => {
  const message = createUserMessage({ content: [{ type: 'text', text: 'Owner goal' }], source: { kind: 'user' } })
  nativeEvents = [{ type: 'user/message', data: { ...message, source: { kind: 'user', rpcId: 'owner-request' } } }]
  db.connection.exec('CREATE TRIGGER reject_native_source BEFORE INSERT ON source_state BEGIN SELECT RAISE(ABORT, \'provenance unavailable\'); END')
  await expect(call('main', 'create_ticket', { requestId: 'native-atomic', sourceMessageId: message.id, projectId: 'q', title: 'q', authorization: 'read only', acceptanceCriteria: 'report' })).rejects.toThrow('provenance unavailable')
  expect(ledger.list(db, 'ticket')).toHaveLength(2)
  expect(ledger.list(db, 'source_state')).toEqual([])
})

it('lists only trusted role scope and includes source associations for main triage', async () => {
  const { thread } = source('p', '1')
  ledger.subscribeThread(db, 'P', thread.id, human)
  const global = await call('main', 'list_ticket')
  expect(global.tickets.map((ticket: any) => ticket.id)).toEqual(['P', 'Q'])
  expect(global.projects.map((project: any) => project.id)).toEqual(['p', 'q'])
  expect(global.subscriptions).toEqual([expect.objectContaining({ ticketId: 'P', threadId: thread.id })])
  expect((await call('p', 'list_ticket')).tickets.map((ticket: any) => ticket.id)).toEqual(['P'])
  await expect(call('p', 'list_ticket', {}, 's-main')).rejects.toMatchObject({ code: 'unbound_actor' })
  sessions.set('s-p', { state: 'idle', origin: 'subagent', parentSession: 's-main' })
  await expect(call('p', 'list_ticket')).rejects.toMatchObject({ code: 'unknown_binding' })
})

it('scopes channel reads to project or subscribed tickets and marks only the caller inbox handled', async () => {
  const p = source('p', '4')
  const q = source('q', '5')
  ledger.subscribeThread(db, 'P', p.thread.id, human)
  expect(await call('p', 'read_channel', { resource: `trigger/${p.trigger.id}` })).toMatchObject({ items: [expect.objectContaining({ id: p.trigger.id })], next_offset: null })
  await expect(call('p', 'read_channel', { resource: `thread/${q.thread.id}` })).rejects.toMatchObject({ code: 'scope_denied' })
  await expect(call('p', 'read_channel', { resource: 'ticket/Q' })).rejects.toMatchObject({ code: 'scope_denied' })
  await run.intake({ id: 'm-p', source: 'test', recipient: 'p', ticketId: 'P', kind: 'message', content: 'review evidence' })
  await run.intake({ id: 'm-q', source: 'test', recipient: 'q', ticketId: 'Q', kind: 'message', content: 'private q' })
  expect((await call('p', 'inbox_list')).items).toEqual([expect.objectContaining({ id: 'm-p', content: 'review evidence' })])
  await expect(call('p', 'inbox_kill', { ids: ['m-q'] })).rejects.toMatchObject({ code: 'scope_denied' })
  expect(await call('p', 'inbox_kill', { ids: ['m-p'] })).toMatchObject({ items: [expect.objectContaining({ id: 'm-p', handledAt: expect.any(String) })] })
  expect((await call('p', 'inbox_list')).items).toEqual([])
  const signal = AbortSignal.abort()
  await expect(call('p', 'inbox_list', {}, 's-p', signal)).rejects.toMatchObject({ code: 'interrupted_tool' })
})

it('routes main dispatch to the project without starting work and subscribes sources through ledger', async () => {
  const { thread } = source('p', '6')
  expect(await call('main', 'triage_thread', { threadId: thread.id, action: 'claim', projectId: 'p' })).toMatchObject({ thread: { triage: 'claimed', projectId: 'p' } })
  await call('main', 'attach_thread_to_ticket', { ticketId: 'P', threadId: thread.id })
  expect((await call('p', 'read_channel', { resource: 'ticket/P' })).items).toHaveLength(1)
  const dispatched = await call('main', 'dispatch_ticket', { ticketId: 'P', requestId: 'dispatch-P' })
  expect(dispatched).toMatchObject({ accepted: true, started: false })
  expect((await call('p', 'inbox_list')).items).toEqual([expect.objectContaining({ ticketId: 'P', kind: 'runtime:ticket' })])
  expect((await call('main', 'list_ticket')).tickets.find((ticket: any) => ticket.id === 'P').status).toBe('waiting')
  expect([...sessions.keys()]).toEqual(['s-main', 's-p', 's-q'])
})

it('creates scoped supervisors and records only dependencies between their associated tickets', async () => {
  const created = await call('main', 'create_supervisor', { requestId: 'coordination', ticketIds: ['P', 'Q'], reason: 'API migration across projects' })
  const supervisor = created.binding
  expect(supervisor).toMatchObject({ role: 'supervisor', supervisorId: expect.any(String) })
  expect((await call(supervisor.id, 'list_ticket', {}, supervisor.sessionId)).tickets.map((ticket: any) => ticket.id)).toEqual(['P', 'Q'])
  expect(await call(supervisor.id, 'link_dependency', { ticketId: 'Q', dependsOn: 'P' }, supervisor.sessionId)).toMatchObject({ linked: true })
  await expect(call('q', 'create_worker', { ticketId: 'Q' })).rejects.toMatchObject({ code: 'dependency_unsatisfied' })
  ledger.createTicket(db, { id: 'R', projectId: 'p', channelId: 'github', title: 'outside scope', authorization: 'fix', acceptanceCriteria: 'test passes' }, human)
  await expect(call(supervisor.id, 'link_dependency', { ticketId: 'Q', dependsOn: 'R' }, supervisor.sessionId)).rejects.toMatchObject({ code: 'scope_denied' })
  expect((await call('main', 'close_supervisor', { supervisorId: supervisor.supervisorId, reason: 'Return ownership to projects' })).supervisor.status).toBe('closed')
})

async function execution() {
  const root = join(directory, 'p')
  await mkdir(root)
  const git = promisify(execFile)
  await git('git', ['init', '-b', 'main'], { cwd: root })
  await git('git', ['commit', '--allow-empty', '-m', 'fixture'], { cwd: root })
  await git('git', ['remote', 'add', 'origin', 'https://github.com/org/p'], { cwd: root })
  return call('p', 'create_worker', { ticketId: 'P' })
}

it('records verified management progress but never refreshes attention on repeated reads', async () => {
  const started = await execution()
  const id = `execution:${started.binding.id}`
  const original = ledger.load(db, 'attention', id)!.progressAt
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.parse(original) + 300000)
  await call('p', 'list_ticket')
  expect(ledger.load(db, 'attention', id)!.progressAt).toBe(original)
  await call('p', 'advance_ticket', { ticketId: 'P', executionBindingId: started.binding.id, event: 'ready', reason: 'Verified tests and review evidence ready' })
  expect(ledger.load(db, 'attention', id)).toMatchObject({ progressAt: new Date().toISOString(), waitingFor: 'Verified tests and review evidence ready', escalatedAt: null })
  vi.setSystemTime(Date.now() + 300000)
  const args = { requestId: 'progress-acceptance', ticketId: 'P', executionBindingId: started.binding.id, scope: 'fix', evidence: ['tests passed'], basis: 'Regression verified', verdict: 'accepted' }
  await call('p', 'record_acceptance', args)
  const acceptedAt = new Date().toISOString()
  expect(ledger.load(db, 'attention', id)).toMatchObject({ progressAt: acceptedAt, waitingFor: 'Regression verified' })
  vi.setSystemTime(Date.now() + 300000)
  await call('p', 'record_acceptance', args)
  expect(ledger.load(db, 'attention', id)!.progressAt).toBe(acceptedAt)
})

it('returns the existing review state for duplicate ready without postponing its reminder', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  const started = await execution()
  const id = `execution:${started.binding.id}`
  vi.setSystemTime(new Date('2026-11-16T01:10:00Z'))
  const args = { ticketId: 'P', executionBindingId: started.binding.id, event: 'ready', reason: 'Verified regression ready' }
  const first = await call('p', 'advance_ticket', args)
  const attention = ledger.load(db, 'attention', id)!
  const transitions = ledger.list(db, 'ticket_transition')
  expect(attention).toMatchObject({ progressAt: '2026-11-16T01:10:00.000Z', dueAt: '2026-11-16T01:20:00.000Z' })
  vi.setSystemTime(new Date('2026-11-16T01:19:00Z'))
  expect(await call('p', 'advance_ticket', args)).toEqual(first)
  expect(ledger.list(db, 'ticket_transition')).toEqual(transitions)
  expect(ledger.load(db, 'attention', id)).toEqual(attention)
  vi.setSystemTime(new Date('2026-11-16T01:20:00Z'))
  await run.remind(id)
  expect(ledger.list(db, 'message').filter(item => item.kind === 'runtime:reminder')).toMatchObject([{ recipient: 'p', acceptedAt: '2026-11-16T01:20:00.000Z' }])
})

it('refreshes review attention for genuinely new acceptance evidence, not repeated ready wording', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'))
  const started = await execution()
  const id = `execution:${started.binding.id}`
  vi.setSystemTime(new Date('2026-11-16T01:10:00Z'))
  const ready = { ticketId: 'P', executionBindingId: started.binding.id, event: 'ready', reason: 'Ready for review' }
  await call('p', 'advance_ticket', ready)
  const acceptance = { requestId: 'first-evidence', ticketId: 'P', executionBindingId: started.binding.id, scope: 'fix', evidence: ['regression passed'], basis: 'Regression verified', verdict: 'accepted' }
  await call('p', 'record_acceptance', acceptance)
  vi.setSystemTime(new Date('2026-11-16T01:19:00Z'))
  await call('p', 'record_acceptance', { ...acceptance, requestId: 'new-evidence', evidence: ['regression passed', 'integration passed'], basis: 'Integration verified' })
  const attention = ledger.load(db, 'attention', id)!
  expect(attention).toMatchObject({ progressAt: '2026-11-16T01:19:00.000Z', dueAt: '2026-11-16T01:29:00.000Z', waitingFor: 'Integration verified' })
  vi.setSystemTime(new Date('2026-11-16T01:20:00Z'))
  await call('p', 'advance_ticket', { ...ready, reason: 'Different wording is not new evidence' })
  expect(ledger.load(db, 'attention', id)).toEqual(attention)
})

it.each([true, false])('requires formal delivery before done and reports actual writer retirement (verified=%s)', async (verified) => {
  writersStopped = verified
  const started = await execution()
  expect(started).toMatchObject({ accepted: true, started: true, binding: { role: 'worker', ticketId: 'P', branch: expect.stringMatching(/^nexus\//) } })
  const executionBindingId = started.binding.id
  const own = source('p', 'worker-own')
  const foreign = source('q', 'worker-foreign')
  await call('p', 'attach_thread_to_ticket', { ticketId: 'P', threadId: own.thread.id })
  expect((await call(started.binding.id, 'read_channel', { resource: `trigger/${own.trigger.id}` }, started.binding.sessionId)).items).toHaveLength(1)
  await expect(call(started.binding.id, 'read_channel', { resource: `trigger/${foreign.trigger.id}` }, started.binding.sessionId)).rejects.toMatchObject({ code: 'scope_denied' })
  await expect(call('p', 'advance_ticket', { ticketId: 'P', event: 'ready', executionBindingId: 'stale', reason: 'review' })).rejects.toMatchObject({ code: 'stale_execution' })
  expect(await call('p', 'advance_ticket', { ticketId: 'P', event: 'ready', executionBindingId, reason: 'Worker evidence ready' })).toMatchObject({ ticket: { status: 'review' } })
  await expect(call('p', 'advance_ticket', { ticketId: 'P', event: 'complete', executionBindingId, reason: 'seems done' })).rejects.toMatchObject({ code: 'acceptance_evidence_required' })
  const acceptance = { requestId: 'review-P', ticketId: 'P', executionBindingId, scope: 'reported bug', evidence: ['node test/regression.js: pass'], basis: 'Verified regression and authorized scope', verdict: 'accepted' }
  await expect(call('p', 'record_acceptance', { ...acceptance, evidence: [] })).rejects.toMatchObject({ code: 'acceptance_evidence_required' })
  expect(await call('p', 'record_acceptance', acceptance)).toMatchObject({ acceptance: { executionBindingId, verdict: 'accepted' } })
  await expect(call('p', 'advance_ticket', { ticketId: 'P', event: 'complete', executionBindingId, reason: 'reviewed' })).rejects.toMatchObject({ code: 'delivery_decision_required' })
  const service = communication.create(db, run)
  const ask = createCommunicationTools(service, 's-p', async () => ({ messageId: 'native' })).find(tool => tool.name === 'ask')!
  const question = await ask.execute({ requestId: 'deliver-P', question: 'Accept non-PR delivery?', ticketIds: ['P'], options: ['accept_delivery', 'reject_delivery'], decisionType: 'delivery' }, { agent: { session: { id: 's-p' } }, signal: new AbortController().signal, callId: 'delivery' } as unknown as ToolRunContext) as { askId: string, policyBasis: string }
  await service.answer({ askId: question.askId, policyBasis: question.policyBasis, answer: 'accept_delivery' }, human)
  expect(ledger.load(db, 'role_binding', executionBindingId)).toMatchObject({ status: 'running' })
  expect(await call('p', 'advance_ticket', { ticketId: 'P', event: 'complete', executionBindingId, reason: 'Formal delivery accepted' })).toMatchObject({ ticket: { status: 'done' }, retirement: { stopped: verified } })
  expect(ledger.load(db, 'role_binding', executionBindingId)).toMatchObject({ status: verified ? 'closed' : 'running' })
  await expect(call('q', 'create_worker', { ticketId: 'P' })).rejects.toMatchObject({ code: 'scope_denied' })
})

it('collects delivery targets from real GitHub facts and merges only after current acceptance and formal approval', async () => {
  const started = await execution()
  const executionBindingId = started.binding.id
  const thread = ledger.recordThread(db, { channelId: 'github', projectId: 'p', repository: 'github.com/org/p', kind: 'pull', resourceId: '7', title: 'Fix bug', url: 'https://github.com/org/p/pull/7' })
  await call('p', 'attach_thread_to_ticket', { ticketId: 'P', threadId: thread.id })
  expect(await call('p', 'set_delivery_target', { ticketId: 'P', threadId: thread.id })).toMatchObject({ ok: false, reason: 'environment_not_selected' })
  expect((await call('p', 'list_ticket')).tickets[0].deliveryTarget).toBeNull()
  let merged = false
  const writes: string[] = []
  github = new GitHubChannel(db, { request: async (request) => {
    if (request.path === 'user')
      return { id: 1, login: 'nexus', type: 'User' }
    if (request.path === 'repos/org/p')
      return { id: 100, full_name: 'org/p' }
    if (request.path === 'repos/org/p/pulls/7')
      return { number: 7, head: { sha: 'head-one' }, base: { ref: 'main', repo: { full_name: 'org/p' } }, html_url: 'https://github.com/org/p/pull/7', state: merged ? 'closed' : 'open', merged, updated_at: new Date().toISOString() }
    if (request.path.includes('/check-runs?'))
      return { check_runs: [] }
    if (request.path.includes('/status?'))
      return { sha: 'head-one', statuses: [{ id: 1, context: 'regression', state: 'success', updated_at: new Date().toISOString() }] }
    if (request.path === 'graphql')
      return { data: { repository: { nameWithOwner: 'org/p', pullRequest: { number: 7, headRefOid: 'head-one', baseRefName: 'main', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', reviewDecision: null, baseRef: { branchProtectionRule: null }, commits: { nodes: [{ commit: { oid: 'head-one', statusCheckRollup: { state: 'SUCCESS' } } }] } } } } }
    if (request.path.includes('/rules/branches/'))
      return []
    if (request.path === 'repos/org/p/pulls/7/merge' && request.method === 'PUT') {
      writes.push(request.path)
      expect(request.body).toEqual({ sha: 'head-one', merge_method: 'merge' })
      merged = true
      return { merged: true, sha: 'merge-one' }
    }
    throw new Error(`Unexpected GitHub path: ${request.path}`)
  } })
  await github.selectEnvironment('p', { site: 'github.com', login: 'nexus', automationIds: [] })
  const collected = await call('p', 'set_delivery_target', { ticketId: 'P', threadId: thread.id, target: { head: 'model-forgery' } })
  expect(collected).toMatchObject({ ok: true, ticket: { deliveryTarget: JSON.stringify({ repository: 'github.com/org/p', pullRequest: 'https://github.com/org/p/pull/7', base: 'main', head: 'head-one' }), prState: 'open', ciState: 'passing' } })
  await call('p', 'advance_ticket', { ticketId: 'P', executionBindingId, event: 'ready', reason: 'Ready for review' })
  await call('p', 'record_acceptance', { requestId: 'pr-review', ticketId: 'P', executionBindingId, scope: 'Fix bug', evidence: ['regression passed on head-one'], basis: 'Verified change and CI', verdict: 'accepted' })
  const service = communication.create(db, run, async ask => github.preflight(ask.id))
  const question = await service.ask('s-p', { requestId: 'merge-P', question: 'Merge reviewed fix?', ticketIds: ['P'], options: ['allow_merge', 'deny_merge'], decisionType: 'merge', target: JSON.parse(collected.ticket.deliveryTarget) })
  expect(await call('p', 'merge_pull_request', { askId: question.askId })).toMatchObject({ ok: false, reason: 'decision_invalid' })
  expect(writes).toEqual([])
  const verification = await github.preflight(question.askId)
  expect(verification.verified).toBe(true)
  await service.answer({ askId: question.askId, policyBasis: question.policyBasis, answer: 'allow_merge', target: verification.target, verified: verification.verified }, human)
  expect(await call('p', 'merge_pull_request', { askId: question.askId })).toEqual({ ok: true, state: 'merged' })
  expect(writes).toEqual(['repos/org/p/pulls/7/merge'])
  expect(await call('p', 'advance_ticket', { ticketId: 'P', executionBindingId, event: 'complete', reason: 'PR merge observed and decision current' })).toMatchObject({ ticket: { status: 'done', prState: 'merged' } })
})
