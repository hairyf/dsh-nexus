import type { Context } from '@deepseek-ai/cordis'
import type { NexusDatabase } from '../src/database'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase } from '../src/database'
import { createSessionGateway } from '../src/runtime/session-gateway'
import { communication } from '../src/service/communication'
import { ledger } from '../src/service/ledger'
import { runtime } from '../src/service/runtime'

interface Input {
  content: { type: string, text: string }[]
  source: { kind: string, messageId: string }
}

const human = { kind: 'web', authenticated: true, userId: 'owner' } as const
const project = { kind: 'agent', sessionId: 's-project' } as const
const worker = { kind: 'agent', sessionId: 's-worker' } as const
let db: NexusDatabase
let directory: string
let service: ReturnType<typeof communication.create>
let run: ReturnType<typeof runtime.create>
let inputs: Map<string, Input[]>

beforeEach(async () => {
  directory = join(import.meta.dirname, '../.temp', `communication-delivery-${randomUUID()}`)
  db = await openDatabase(directory)
  inputs = new Map()
  const live = new Map(['s-main', 's-project', 's-worker'].map((id) => {
    const inbox = { nextStep: [] as Input[], nextTurn: [] as Input[] }
    inputs.set(id, [])
    return [id, {
      status: 'idle',
      session: { header: { cwd: directory } },
      inbox,
      followup: (input: Input) => {
        inbox.nextTurn.push(input)
        inputs.get(id)!.push(input)
      },
      inject: (input: Input) => {
        inbox.nextStep.push(input)
        inputs.get(id)!.push(input)
      },
      cancel: () => {},
    }]
  }))
  const host = {
    agents: { get: (id: string) => live.get(id) },
    agentPresets: {},
    agentDefaultModel: {},
    sessionQuery: { readSession: async (id: string) => ({ session: live.get(id)!.session.header, events: [] }) },
  }
  const gateway = createSessionGateway({ get: (name: keyof typeof host) => host[name] } as unknown as Context, async () => true)
  run = runtime.create(db, gateway, { timeout: () => () => {} }, join(directory, 'managers'))
  ledger.createProject(db, { id: 'p', name: 'P', workspaceId: 'p', directory, remoteUrl: 'https://github.com/org/p', available: true })
  ledger.updateProject(db, 'p', true, human)
  ledger.bindRole(db, { id: 'main', role: 'main', sessionId: 's-main' })
  ledger.bindRole(db, { id: 'project', role: 'project', sessionId: 's-project', projectId: 'p' })
  ledger.createTicket(db, { id: 'T1', projectId: 'p', channelId: 'test', title: 'Bug', authorization: 'fix bug', acceptanceCriteria: 'regression passes' }, human)
  ledger.bindRole(db, { id: 'worker', role: 'worker', sessionId: 's-worker', projectId: 'p', ticketId: 'T1', repository: 'github.com/org/p', branch: 'ticket/T1', worktree: join(directory, 'worker') }, project)
  ledger.dispatchTicket(db, 'T1', project)
  ledger.startTicket(db, 'T1', 'worker', project)
  service = communication.create(db, run)
})

afterEach(async () => {
  await run?.dispose()
  if (db?.initialized)
    db.close()
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

it('delivers actionable question identity and form through the real gateway without changing the public question text', async () => {
  const ask = await service.ask('s-worker', { requestId: 'visible-form', question: 'Which runtimes?', title: 'Targets', detail: 'Keep both compatible', options: ['node', 'bun'], multiSelect: true, decisionType: 'ordinary' })
  const request = inputs.get('s-project')![0]
  expect(request.content).toHaveLength(2)
  expect(JSON.parse(request.content[0].text)).toMatchObject({ kind: 'nexus_context', messageId: `ask:${ask.askId}`, askId: ask.askId, ticketId: 'T1', facts: null, question: { question: 'Which runtimes?', title: 'Targets', detail: 'Keep both compatible', multiSelect: true, options: ['node', 'bun'], policyBasis: ask.policyBasis, state: 'pending', target: null } })
  expect(request.content[1]).toEqual({ type: 'text', text: 'Which runtimes?' })
  expect(ledger.load(db, 'message', `ask:${ask.askId}`)).toMatchObject({ content: 'Which runtimes?' })
  expect(request.source).toMatchObject({ kind: 'nexus', messageId: `ask:${ask.askId}` })
  await service.ask('s-project', { askId: ask.askId })
  expect(JSON.parse(inputs.get('s-main')![0].content[0].text)).toMatchObject({ askId: ask.askId, question: { title: 'Targets', detail: 'Keep both compatible', multiSelect: true, options: ['node', 'bun'] } })
})

it('prepends original question association to a formal answer while preserving its public text and complete selections', async () => {
  const ask = await service.ask('s-worker', { requestId: 'visible-answer', question: 'Which runtimes?', options: ['node', 'bun'], multiSelect: true, decisionType: 'ordinary' })
  await service.sendMessage('s-project', 'answer', { askId: ask.askId, policyBasis: ask.policyBasis, message: 'Both runtimes', selections: ['node', 'bun'] })
  const answer = inputs.get('s-worker')![0]
  expect(answer.content).toHaveLength(2)
  expect(JSON.parse(answer.content[0].text)).toMatchObject({ messageId: `answer:${ask.askId}`, askId: ask.askId, ticketId: 'T1', question: { question: 'Which runtimes?', options: ['node', 'bun'], state: 'answered', selections: ['node', 'bun'] } })
  expect(answer.content[1]).toEqual({ type: 'text', text: 'Both runtimes' })
  expect(ledger.load(db, 'message', `answer:${ask.askId}`)).toMatchObject({ content: 'Both runtimes' })
})

it('projects the current policy and precise merge target at delivery time rather than persisting a stale form snapshot', async () => {
  const target = { repository: 'github.com/org/p', pullRequest: 'https://github.com/org/p/pull/7', base: 'main', head: 'head-one' }
  ledger.setPolicy(db, 'T1', { questionLevel: 'automatic', mergePolicy: 'automatic_allowed' }, 'Allow project handling', human)
  ledger.setDeliveryTarget(db, 'T1', target, project)
  ledger.recordAcceptance(db, { id: 'evidence', executionBindingId: 'worker', ticketId: 'T1', scope: 'fix', evidence: ['regression passed'], basis: 'regression passes', verdict: 'accepted' }, project)
  const ask = ledger.createAsk(db, { id: 'current-policy', ticketIds: ['T1'], source: 'communication:current-policy', content: 'Merge exact target?', options: ['allow_merge', 'deny_merge'], presentation: { title: 'Merge', detail: 'Verified regression evidence', multiSelect: false }, decisionType: 'merge', target, withinAuthorization: true }, worker)
  ledger.setPolicy(db, 'T1', { questionLevel: 'important', mergePolicy: 'automatic_allowed' }, 'New policy revision, same handler', human)
  const current = ledger.load(db, 'ask', ask.id)!
  expect(current.policyBasis).not.toBe(ask.policyBasis)
  await run.deliver(`ask:${ask.id}`)
  const message = inputs.get('s-project')![0]
  expect(message.content).toHaveLength(2)
  expect(JSON.parse(message.content[0].text)).toMatchObject({ askId: ask.id, question: { policyBasis: current.policyBasis, options: ['allow_merge', 'deny_merge'], title: 'Merge', detail: 'Verified regression evidence', target } })
  expect(message.content[1].text).toBe('Merge exact target?')
  expect(ledger.load(db, 'message', `ask:${ask.id}`)).toMatchObject({ content: 'Merge exact target?' })
})

it('carries structured ordinary progress facts alongside unchanged text without inventing an ask or approval', async () => {
  const facts = { state: 'ready' as const, summary: 'PR ready', evidence: ['regression passed'], acceptanceCriteria: 'regression passes' }
  const result = await service.sendMessage('s-worker', 'visible-report', { to: 'role:project', message: '实现已完成，等待验收。', facts })
  const report = inputs.get('s-project')![0]
  expect(report.content).toHaveLength(2)
  expect(JSON.parse(report.content[0].text)).toMatchObject({ messageId: result.messageId, askId: null, ticketId: 'T1', question: null, facts })
  expect(report.content[1]).toEqual({ type: 'text', text: '实现已完成，等待验收。' })
  expect(ledger.load(db, 'message', result.messageId)).toMatchObject({ content: '实现已完成，等待验收。', facts: JSON.stringify(facts) })
  expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ status: 'running' })
  expect(service.list()).toEqual([])
})

it('preserves every affected ticket in a manager question instead of showing only the first delivery partition', async () => {
  ledger.createTicket(db, { id: 'T2', projectId: 'p', channelId: 'test', title: 'Second bug', authorization: 'fix second bug', acceptanceCriteria: 'second regression passes' }, human)
  const ask = await service.ask('s-project', { requestId: 'multi-ticket', question: 'Coordinate both fixes?', ticketIds: ['T1', 'T2'], decisionType: 'ordinary' })
  const request = inputs.get('s-main')![0]
  expect(JSON.parse(request.content[0].text)).toMatchObject({ askId: ask.askId, ticketId: 'T1', question: { ticketIds: ['T1', 'T2'] } })
  expect(request.content[1].text).toBe('Coordinate both fixes?')
})
