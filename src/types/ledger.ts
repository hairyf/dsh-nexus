import type { Selectable } from 'kysely'
import type { DB } from '../database/types'

export type Role = 'main' | 'project' | 'supervisor' | 'worker'
export type QuestionLevel = 'detailed' | 'important' | 'automatic'
export type MergePolicy = 'follow_question_level' | 'human_required' | 'automatic_allowed'
export type DecisionType = 'ordinary' | 'important' | 'final' | 'merge' | 'delivery'
export interface PolicySnapshot {
  questionLevel: QuestionLevel
  mergePolicy: MergePolicy
}
export type Actor
  = | { kind: 'web', authenticated: boolean, userId: string }
    | { kind: 'github', verified: boolean, providerId: string, login: string, bot: boolean, outbound: boolean }
    | { kind: 'agent', sessionId: string }
export interface MergeTarget {
  repository: string
  pullRequest: string
  base: string
  head: string
}
export type Row<T extends keyof DB> = Selectable<DB[T]>
export type IdTable = { [T in keyof DB]: DB[T] extends { id: unknown } ? T : never }[keyof DB]
export interface ProjectInput {
  id: string
  name: string
  workspaceId: string
  directory: string
  remoteUrl: string
  available: boolean
}
export interface TicketInput {
  id: string
  projectId: string
  channelId: string
  title: string
  acceptanceCriteria: string
  authorization: string
  description?: string
}
export interface BindingInput {
  id: string
  role: Role
  sessionId: string
  projectId?: string
  ticketId?: string
  supervisorId?: string
  ticketIds?: string[]
  worktree?: string
  branch?: string
  repository?: string
  previousBindingId?: string
  recoveryReason?: string
}
export interface AskInput {
  id: string
  ticketIds: string[]
  source: string
  content: string
  decisionType: DecisionType
  withinAuthorization: boolean
  options: string[]
  target?: MergeTarget
  supersedesId?: string
}
export interface AnswerInput {
  askId: string
  policyBasis: string
  answer: string
  target?: MergeTarget
  verified?: boolean
}
export interface AcceptanceInput {
  executionBindingId: string
  id: string
  ticketId: string
  scope: string
  evidence: string[]
  basis: string
  verdict: 'accepted' | 'rejected'
  askId?: string
}
export interface ThreadInput {
  channelId: string
  repository: string
  kind: 'issue' | 'pull' | 'ci' | 'chat'
  resourceId: string
  title: string
  url?: string
  projectId?: string
}
export interface TriggerInput {
  id: string
  threadId: string
  kind: 'comment' | 'open' | 'close' | 'ci' | 'push'
  text: string
  at: string
  mentioned: boolean
  url?: string
  ref?: string
}
export interface AttentionInput {
  id: string
  ticketId?: string
  askId?: string
  bindingId?: string
  reason: string
  waitingFor: string
  progressAt: string
  recipient: string
}
export type SettingsPatch = Partial<{
  defaultQuestionLevel: QuestionLevel
  defaultMergePolicy: MergePolicy
  whitelist: string[]
  maxWorkers: number
  backgroundLimitMinutes: number
  reminderIntervalMinutes: number
  deliveryMaxAttempts: number
  deliveryRetryCeilingSeconds: number
}>
