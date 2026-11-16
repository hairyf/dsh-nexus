import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'

interface Job {
  id: string
  owner?: string
  status: string
}
interface Jobs {
  list: (owner: string) => Job[]
  kill: (id: string, owner: string, reason: string) => unknown
  wait: (id: string, milliseconds: number, owner: string, signal?: AbortSignal) => Promise<Job>
}
interface Subagents {
  listDescendants: (sessionId: string, signal?: AbortSignal) => Promise<({ kind: 'child', id: string } | { kind: 'diagnostic' })[]>
  drainDescendants: (parents: Agent[]) => Promise<void>
}

export async function retireWriters(ctx: Context, sessionId: string, signal?: AbortSignal): Promise<{ stopped: boolean, reason?: string }> {
  signal?.throwIfAborted()
  const root = ctx.get('agents')!.get(SessionId(sessionId))
  if (!root)
    return { stopped: false, reason: 'previous_process_writers_unverified' }
  const optional = ctx as unknown as { get: (name: string) => unknown }
  const jobs = optional.get('jobs') as Jobs | undefined
  const subagents = optional.get('subagents') as Subagents | undefined
  if (!jobs || !subagents)
    return { stopped: false, reason: 'native_writer_inspection_unavailable' }
  const descendants = await subagents.listDescendants(sessionId, signal)
  if (descendants.some(item => item.kind === 'diagnostic'))
    return { stopped: false, reason: 'helper_catalog_unverified' }
  const owners = [sessionId, ...descendants.filter(item => item.kind === 'child').map(item => item.id)]
  await subagents.drainDescendants([root])
  for (const owner of owners) {
    for (const job of jobs.list(owner).filter(job => job.owner === owner && ['running', 'stopping'].includes(job.status))) {
      jobs.kill(job.id, owner, 'nexus_execution_stopped')
      const settled = await jobs.wait(job.id, 30000, owner, signal)
      if (['running', 'stopping'].includes(settled.status))
        return { stopped: false, reason: 'native_job_stop_unconfirmed' }
    }
    const activity = await ctx.waterfall('workspace/session-activity', { sessionId: SessionId(owner) }, async () => [])
    if (activity.length)
      return { stopped: false, reason: 'native_session_activity_remaining' }
  }
  return { stopped: true }
}
