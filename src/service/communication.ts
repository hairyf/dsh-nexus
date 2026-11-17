import type { NexusDatabase } from '../database'
import type { Actor, Row } from '../types/ledger'
import type { AnswerReceipt, AskState, DeliveryReceipt, Escalation, FormalAnswer, MergeVerifier, MessageInput, MessageReceipt, Question, RuntimePort } from './communication.types'
import { createHash } from 'node:crypto'
import { LedgerError } from '../database'
import { checkInterrupt } from '../runtime/interrupt'
import { defineService } from '../utils/service'
import { ledger } from './ledger'

export const communication = defineService({
  answer(database: NexusDatabase, input: FormalAnswer, actor: Actor): { accepted: boolean, ask: Row<'ask'> } {
    const current = loadAsk(database, input.askId)
    if (current.status === 'answered')
      return { accepted: false, ask: current }
    if (current.status === 'cancelled')
      throw new LedgerError(current.cancelReason === 'delivery_target_changed' ? 'target_changed' : 'ask_cancelled')
    if (!input.answer.trim())
      throw new LedgerError('invalid_answer')
    const form = current.presentation ? JSON.parse(current.presentation) as { multiSelect?: boolean } : {}
    const options = JSON.parse(current.options) as string[]
    if (form.multiSelect) {
      if (!input.selections?.length || new Set(input.selections).size !== input.selections.length || input.selections.some(selection => !options.includes(selection)))
        throw new LedgerError('invalid_answer')
    }
    else if (input.selections || (['merge', 'delivery'].includes(current.decisionType) && !options.includes(input.answer))) {
      throw new LedgerError('invalid_answer')
    }
    return { accepted: true, ask: ledger.answerAsk(database, input, actor) }
  },
  create(database: NexusDatabase, host: RuntimePort, verifyMerge?: MergeVerifier) {
    function state(ask: Row<'ask'>): AskState {
      const presentation = ask.presentation ? JSON.parse(ask.presentation) as { title?: string, detail?: string, multiSelect?: boolean } : {}
      return { accepted: true, askId: ask.id, state: ask.status, handler: ask.handler, initiatorBinding: ask.initiatorBinding, responseRecipient: ask.responseRecipient, ticketIds: ledger.list(database, 'ask_ticket').filter(link => link.askId === ask.id).map(link => link.ticketId), question: ask.content, options: JSON.parse(ask.options) as string[], ...presentation, policyBasis: ask.policyBasis, target: ask.target ? JSON.parse(ask.target) : null, answer: ask.answer, selections: ask.selections ? JSON.parse(ask.selections) as string[] : null, cancelReason: ask.cancelReason }
    }

    async function resolve(sessionId: string, signal?: AbortSignal): Promise<Row<'role_binding'>> {
      return (await host.resolve(sessionId, signal)).binding
    }

    async function deliver(message: Row<'message'>, signal?: AbortSignal): Promise<DeliveryReceipt> {
      if (message.recipient === 'human' || ledger.load(database, 'thread', message.recipient))
        return { state: 'pending', error: null, cause: null }
      if (message.error === 'initiator_requires_recovery')
        return { state: 'failed', error: message.error, cause: null }
      try {
        const delivered = await host.deliver(message.id, signal)
        return { state: delivered.deliveredAt ? 'accepted' : 'pending', error: null, cause: null }
      }
      catch (error) {
        checkInterrupt(signal)
        if (error instanceof LedgerError && error.code === 'interrupted_tool')
          throw error
        if (error instanceof LedgerError && error.code === 'delivery_pending')
          return { state: 'pending', error: null, cause: null }
        return { state: 'failed', error: 'delivery_failed', cause: error instanceof LedgerError ? error.code : error instanceof Error ? error.message : String(error) }
      }
    }

    async function ask(sessionId: string, input: Question | Escalation, signal?: AbortSignal): Promise<AskState> {
      const binding = await resolve(sessionId, signal)
      const actor = { kind: 'agent', sessionId } as const
      if ('askId' in input) {
        if (Object.keys(input).some(key => key !== 'askId'))
          throw new LedgerError('parameter_conflict')
        const escalated = ledger.escalateAsk(database, input.askId, actor)
        const request = ledger.list(database, 'message').find(message => message.askId === escalated.id && message.kind === 'ask' && !message.supersededAt)!
        return { ...state(escalated), delivery: await deliver(request, signal) }
      }
      if (!input.requestId?.trim() || !input.question?.trim())
        throw new LedgerError('invalid_parameters')
      const ticketIds = input.ticketIds ?? (binding.role === 'worker' ? [binding.ticketId!] : [])
      if (input.threadId) {
        const thread = ledger.load(database, 'thread', input.threadId)
        const project = thread?.projectId ? ledger.load(database, 'project', thread.projectId) : null
        if (binding.role !== 'main' || ticketIds.length || !thread || !project?.enabled || !project.available || thread.repository !== project.repository)
          throw new LedgerError('scope_denied')
      }
      if (binding.role !== 'main' && !ticketIds.length)
        throw new LedgerError('ticket_required')
      if (input.multiSelect && (!input.options?.length || input.decisionType === 'merge' || input.decisionType === 'delivery'))
        throw new LedgerError('invalid_parameters')
      const id = `ask-${createHash('sha256').update(JSON.stringify([binding.role, binding.scope, input.requestId])).digest('hex').slice(0, 32)}`
      const record = ledger.createAsk(database, { id, source: input.threadId ?? `communication:${input.requestId}`, ticketIds, content: input.question, options: input.options ?? [], presentation: { title: input.title, detail: input.detail, multiSelect: input.multiSelect ?? false }, decisionType: input.decisionType ?? 'important', withinAuthorization: true, target: input.target }, actor)
      if (record.status !== 'pending')
        return state(record)
      const request = ledger.list(database, 'message').find(message => message.askId === id && message.kind === 'ask' && !message.supersededAt)!
      const delivery = await deliver(request, signal)
      await host.suspend(sessionId, id, signal)
      checkInterrupt(signal)
      return { ...state(loadAsk(database, id)), delivery }
    }

    async function answer(input: FormalAnswer, actor: Actor, signal?: AbortSignal): Promise<AnswerReceipt> {
      checkInterrupt(signal)
      if (actor.kind === 'agent')
        await resolve(actor.sessionId, signal)
      const { accepted, ask: settled } = communication.answer(database, input, actor)
      if (!accepted)
        return { ...state(settled), accepted: false, reason: 'ask_answered', messageId: `answer:${settled.id}`, to: settled.responseRecipient }
      const response = ledger.load(database, 'message', `answer:${settled.id}`)!
      return { ...state(settled), to: response.recipient, messageId: response.id, delivery: await deliver(response, signal) }
    }

    function address(to: string): string {
      if (to.startsWith('role:')) {
        const role = to.slice(5)
        if (!['main', 'project', 'supervisor', 'worker'].includes(role))
          throw new LedgerError('unknown_target')
        const candidates = ledger.list(database, 'role_binding').filter(binding => binding.role === role && binding.status !== 'closed')
        if (candidates.length > 1)
          throw new LedgerError('ambiguous_address')
        if (!candidates.length)
          throw new LedgerError('unknown_target')
        return candidates[0].id
      }
      if (to.startsWith('session:')) {
        const binding = ledger.list(database, 'role_binding').find(binding => binding.sessionId === to.slice(8))
        if (!binding)
          throw new LedgerError('unknown_target')
        return binding.id
      }
      if (to.startsWith('binding:')) {
        const id = to.slice(8)
        if (!ledger.load(database, 'role_binding', id))
          throw new LedgerError('unknown_target')
        return id
      }
      if (to.startsWith('channel:')) {
        const id = to.slice(8)
        if (!ledger.load(database, 'thread', id))
          throw new LedgerError('unknown_target')
        return id
      }
      throw new LedgerError('unknown_target')
    }

    async function sendMessage(sessionId: string, requestId: string, input: MessageInput, signal?: AbortSignal): Promise<MessageReceipt | AnswerReceipt> {
      const binding = await resolve(sessionId, signal)
      if ([input.to, input.askId, input.agent_id].filter(value => value !== undefined).length !== 1 || input.agent_id !== undefined)
        throw new LedgerError('address_conflict')
      const actor = { kind: 'agent', sessionId } as const
      if (input.askId) {
        if (input.facts || input.ticketId)
          throw new LedgerError('parameter_conflict')
        if (!input.policyBasis)
          throw new LedgerError('policy_basis_required')
        const current = loadAsk(database, input.askId)
        let verification = {}
        if (current.status === 'pending' && current.decisionType === 'merge' && input.message === 'allow_merge') {
          if (!verifyMerge)
            throw new LedgerError('verification_required')
          verification = await verifyMerge(current, actor, signal)
        }
        return answer({ askId: input.askId, answer: input.message, selections: input.selections, policyBasis: input.policyBasis, target: current.target ? JSON.parse(current.target) : undefined, ...verification }, actor, signal)
      }
      if (input.policyBasis || input.selections)
        throw new LedgerError('parameter_conflict')
      if (!requestId.trim() || !input.message.trim())
        throw new LedgerError('invalid_parameters')
      const recipient = address(input.to!)
      const ticketId = input.ticketId ?? binding.ticketId
      const id = `message-${createHash('sha256').update(JSON.stringify([binding.role, binding.scope, requestId])).digest('hex').slice(0, 32)}`
      const message = ledger.sendMessage(database, id, recipient, ticketId, input.message, actor, input.facts)
      const publication = ledger.load(database, 'thread', recipient) ? ledger.publishMessage(database, id, recipient, actor) : null
      return { accepted: true, messageId: message.id, to: recipient, address: input.to!, ticketId, outboxId: publication?.id ?? null, delivery: await deliver(message, signal) }
    }

    async function cancel(askId: string, reason: string, actor: Actor, signal?: AbortSignal): Promise<AskState> {
      checkInterrupt(signal)
      if (actor.kind === 'agent')
        await resolve(actor.sessionId, signal)
      return state(ledger.cancelAsk(database, askId, reason, actor))
    }

    function list(): AskState[] {
      return ledger.list(database, 'ask').map(state)
    }

    return { resolve, ask, sendMessage, answer, cancel, list, readMailbox: async (sessionId: string, signal?: AbortSignal) => {
      const box = await host.readMailbox(sessionId, signal)
      return { ...box, questions: list().filter(question => box.messages.some(message => message.askId === question.askId)) }
    }, handleMail: host.handleMail }
  },
})

function loadAsk(database: NexusDatabase, id: string): Row<'ask'> {
  const ask = ledger.load(database, 'ask', id)
  if (!ask)
    throw new LedgerError('unknown_target')
  return ask
}
