import type { Row } from '../types/ledger'

export type StartResult
  = | { accepted: true, started: false, reason?: string, ticket: Row<'ticket'> }
    | { accepted: true, started: true, ticket: Row<'ticket'>, binding: Row<'role_binding'> }

export type StopResult = { stopped: true } | { stopped: false, reason: string }

export interface RecoveryResult {
  binding: Row<'role_binding'>
  state: 'suspended' | 'recovered'
}

export interface SessionSnapshot {
  state: 'idle' | 'running' | 'resumable' | 'closed' | 'missing' | 'unknown'
  cwd?: string
  origin?: string
  parentSession?: string
}

export interface SessionGateway {
  inspect: (sessionId: string, signal?: AbortSignal) => Promise<SessionSnapshot>
  create: (sessionId: string, preset: string, cwd: string, signal?: AbortSignal) => Promise<void>
  resume: (sessionId: string, preset: string, signal?: AbortSignal) => Promise<void>
  deliver: (sessionId: string, message: Pick<Row<'message'>, 'id' | 'content' | 'source'> & Partial<Pick<Row<'message'>, 'askId' | 'ticketId' | 'facts'>> & { question?: Pick<Row<'ask'>, 'content' | 'options' | 'presentation' | 'status' | 'policyBasis' | 'target' | 'selections'> & { ticketIds: string[] } }, mode: 'wake' | 'queue' | 'interrupt', signal?: AbortSignal) => Promise<void>
  receipt: (sessionId: string, messageId: string, signal?: AbortSignal) => Promise<'absent' | 'queued' | 'read' | 'unknown'>
  cancel: (sessionId: string, reason: string, signal?: AbortSignal) => Promise<void>
  stop: (sessionId: string, reason: string, signal?: AbortSignal) => Promise<boolean>
}

export interface HostTimers {
  timeout: (callback: () => Promise<void>, milliseconds: number) => () => void
}

export interface Workspace {
  bindingId: string
  projectId: string
  ticketId: string
  repository: string
  root: string
  remoteUrl: string
  path: string
  branch: string
  baseCommit: string
}
