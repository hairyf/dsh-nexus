import type { MergeTarget, Row } from '../../types/ledger'

export interface GhRequest {
  site: string
  method: 'GET' | 'POST' | 'PATCH' | 'PUT'
  path: string
  body?: Record<string, unknown>
  signal?: AbortSignal
}

export interface GhRunner {
  request: (request: GhRequest) => Promise<unknown>
}

export interface EnvironmentSelection {
  site: string
  login: string
  automationIds: string[]
}

export interface EnvironmentStatus {
  available: boolean
  reason: string | null
  repository: string
  site: string | null
  login: string | null
  providerId?: string
  repositoryId?: string
  checkedAt: string
}

export interface Intake {
  id: string
  kind: 'triage' | 'context' | 'facts'
  projectId: string
  threadId: string
  triggerId: string
  ticketIds: string[]
  historical: boolean
  acknowledged: boolean
}

export interface AnswerResult {
  askId: string | null
  result: string
}

export interface PullRequestFact {
  target: MergeTarget
  number: number
  state: 'open' | 'closed' | 'merged'
  ciState: NonNullable<Row<'ticket'>['ciState']>
  collectedAt: string
  ciCollectedAt: string | null
  updatedAt: string
}
