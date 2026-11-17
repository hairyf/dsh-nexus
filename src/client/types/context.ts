import type { Context } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'

/**
 * Client-half Cordis context.
 *
 * The host `@deepseek-ai/dsh-session` augmentation declares the same
 * `sessions` service as the Client controller (`ISessions`), so declaration
 * merging in one program would resolve it to the Host `SessionStore`. The
 * client face is restored explicitly here.
 */
export type ClientContext = Omit<Context, 'sessions'> & {
  sessions: ISessions
  betterSidebar?: {
    getTab: (id: string) => unknown
    isTabEnabled: (id: string) => boolean
    openTab: (seed: { type: string }, scope: { sessionId: string }) => void
  }
}
