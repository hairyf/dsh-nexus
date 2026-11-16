import type { Actor, AnswerInput, DecisionType, MergeTarget, MessageFacts, Row } from '../types/ledger'
import type { runtime } from './runtime'

export interface Question {
  requestId: string
  question: string
  ticketIds?: string[]
  threadId?: string
  options?: string[]
  multiSelect?: boolean
  title?: string
  detail?: string
  decisionType?: DecisionType
  target?: MergeTarget
}

export interface Escalation {
  askId: string
}

export interface MessageInput {
  message: string
  to?: string
  askId?: string
  agent_id?: string
  ticketId?: string
  facts?: MessageFacts
  policyBasis?: string
  selections?: string[]
}

export type FormalAnswer = AnswerInput

export type RuntimePort = Pick<ReturnType<typeof runtime.create>, 'resolve' | 'suspend' | 'deliver'>
export type MergeVerifier = (ask: Row<'ask'>, actor: Actor, signal?: AbortSignal) => Promise<{ target: MergeTarget, verified: boolean }>
export type Communication = ReturnType<typeof import('./communication').communication.create>

export interface DeliveryReceipt {
  state: 'pending' | 'accepted' | 'failed'
  error: string | null
  cause: string | null
}

export interface AskState {
  accepted: boolean
  askId: string
  state: string
  handler: string
  initiatorBinding: string | null
  responseRecipient: string | null
  ticketIds: string[]
  question: string
  options: string[]
  title?: string
  detail?: string
  multiSelect?: boolean
  policyBasis: string
  target: MergeTarget | null
  answer: string | null
  selections: string[] | null
  cancelReason: string | null
  delivery?: DeliveryReceipt
}

export interface AnswerReceipt extends AskState {
  messageId: string
  to: string | null
  reason?: 'ask_answered'
}

export interface MessageReceipt {
  accepted: boolean
  messageId: string
  to: string
  address: string
  ticketId: string | null
  outboxId: string | null
  delivery: DeliveryReceipt
}
