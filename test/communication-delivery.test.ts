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
      session: { header: { cwd: directory }, snapshotEvents: () => [] },
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

it('notifies with only a count and exposes the original form on explicit mailbox read', async () => {
  const ask = await service.ask('s-worker', { requestId: 'visible-form', question: 'Which runtimes?', title: 'Targets', detail: 'Keep both compatible', options: ['node', 'bun'], multiSelect: true, decisionType: 'ordinary' })
  const notice = inputs.get('s-project')![0]
  expect(notice.content).toHaveLength(1)
  expect(JSON.parse(notice.content[0].text)).toMatchObject({ kind: 'nexus_mailbox', pendingCount: 1 })
  expect(notice.content[0].text).not.toContain('Which runtimes?')
  expect(notice.source).toMatchObject({ kind: 'nexus', source: 'nexus:mailbox' })
  const box = await service.readMailbox('s-project')
  expect(box.messages).toMatchObject([{ id: `ask:${ask.askId}`, content: 'Which runtimes?', recipient: 'nexus:project:p', readAt: expect.any(String), handledAt: null }])
  expect(box.questions).toMatchObject([{ askId: ask.askId, question: 'Which runtimes?', title: 'Targets', detail: 'Keep both compatible', options: ['node', 'bun'], multiSelect: true, ticketIds: ['T1'], state: 'pending' }])
  expect(db.connection.prepare('SELECT content FROM message WHERE id = ?').get(`ask:${ask.askId}`)).toEqual({ content: '' })
})

it('keeps a formal answer and selections associated with its original question without delivering the body', async () => {
  const ask = await service.ask('s-worker', { requestId: 'visible-answer', question: 'Which runtimes?', options: ['node', 'bun'], multiSelect: true, decisionType: 'ordinary' })
  await service.sendMessage('s-project', 'answer', { askId: ask.askId, policyBasis: ask.policyBasis, message: 'Both runtimes', selections: ['node', 'bun'] })
  expect(inputs.get('s-worker')![0].content[0].text).not.toContain('Both runtimes')
  const box = await service.readMailbox('s-worker')
  expect(box.messages).toMatchObject([{ id: `answer:${ask.askId}`, content: 'Both runtimes', askId: ask.askId }])
  expect(box.questions).toMatchObject([{ askId: ask.askId, state: 'answered', answer: 'Both runtimes', selections: ['node', 'bun'] }])
})

it('reads the current policy and exact merge target instead of a stale delivery snapshot', async () => {
  const target = { repository: 'github.com/org/p', pullRequest: 'https://github.com/org/p/pull/7', base: 'main', head: 'head-one' }
  ledger.setPolicy(db, 'T1', { questionLevel: 'automatic', mergePolicy: 'automatic_allowed' }, 'Allow project handling', human)
  ledger.setDeliveryTarget(db, 'T1', target, project)
  ledger.recordAcceptance(db, { id: 'evidence', executionBindingId: 'worker', ticketId: 'T1', scope: 'fix', evidence: ['regression passed'], basis: 'regression passes', verdict: 'accepted' }, project)
  const ask = ledger.createAsk(db, { id: 'current-policy', ticketIds: ['T1'], source: 'communication:current-policy', content: 'Merge exact target?', options: ['allow_merge', 'deny_merge'], presentation: { title: 'Merge', detail: 'Verified regression evidence', multiSelect: false }, decisionType: 'merge', target, withinAuthorization: true }, worker)
  ledger.setPolicy(db, 'T1', { questionLevel: 'important', mergePolicy: 'automatic_allowed' }, 'New policy revision, same handler', human)
  const current = ledger.load(db, 'ask', ask.id)!
  expect(current.policyBasis).not.toBe(ask.policyBasis)
  const box = await service.readMailbox('s-project')
  expect(box.questions).toMatchObject([{ askId: ask.id, policyBasis: current.policyBasis, title: 'Merge', target }])
})

it('stores ordinary report text only in Inbox and keeps structured facts in the business adapter', async () => {
  const facts = { state: 'ready' as const, summary: 'PR ready', evidence: ['regression passed'], acceptanceCriteria: 'regression passes' }
  const result = await service.sendMessage('s-worker', 'visible-report', { to: 'role:project', message: '实现已完成，等待验收。', facts })
  expect(inputs.get('s-project')![0].content[0].text).not.toContain('实现已完成')
  const box = await service.readMailbox('s-project')
  expect(box.messages).toMatchObject([{ id: result.messageId, content: '实现已完成，等待验收。', kind: 'message' }])
  expect(db.connection.prepare('SELECT content, facts FROM message WHERE id = ?').get(result.messageId)).toEqual({ content: '', facts: JSON.stringify(facts) })
  expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ status: 'running' })
  expect(service.list()).toEqual([])
})

it('preserves every affected ticket in the question adapter while the envelope stays generic', async () => {
  ledger.createTicket(db, { id: 'T2', projectId: 'p', channelId: 'test', title: 'Second bug', authorization: 'fix second bug', acceptanceCriteria: 'second regression passes' }, human)
  const ask = await service.ask('s-project', { requestId: 'multi-ticket', question: 'Coordinate both fixes?', ticketIds: ['T1', 'T2'], decisionType: 'ordinary' })
  const box = await service.readMailbox('s-main')
  expect(box.questions).toMatchObject([{ askId: ask.askId, ticketIds: ['T1', 'T2'] }])
  expect(box.messages).toMatchObject([{ content: 'Coordinate both fixes?', recipient: 'nexus:main:global' }])
  expect(box.messages[0]).not.toHaveProperty('ticketId')
})
