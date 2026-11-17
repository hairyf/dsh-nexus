import type { Context } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import { retireWriters } from '../src/host/writers'

function host() {
  const calls: string[] = []
  const root = { id: 'root' }
  let live = true
  const status = 'running'
  const services = {
    agents: { get: () => live ? root : undefined },
    subagents: {
      listDescendants: async () => [{ kind: 'child', id: 'helper' }],
      drainDescendants: async (parents: unknown[]) => {
        expect(parents).toEqual([root])
        calls.push('drain helpers')
      },
    },
    jobs: {
      list: (owner: string) => [{ id: `${owner}-job`, owner, status }, { id: 'unowned', status: 'running' }],
      kill: (id: string, owner: string) => { calls.push(`kill ${owner} ${id}`) },
      wait: async (id: string, _timeout: number, owner: string) => {
        calls.push(`wait ${owner} ${id}`)
        return { id, owner, status: 'killed' }
      },
    },
  }
  const ctx = {
    get: (name: keyof typeof services) => services[name],
    waterfall: async (_event: string, request: { sessionId: string }) => {
      calls.push(`verify ${request.sessionId}`)
      return []
    },
  } as unknown as Context
  return {
    ctx,
    calls,
    services,
    missing: () => { live = false },
  }
}

it('requires positive live-root provenance rather than treating a missing process as stopped', async () => {
  const fixture = host()
  fixture.missing()
  expect(await retireWriters(fixture.ctx, 'root')).toEqual({ stopped: false, reason: 'previous_process_writers_unverified' })
  expect(fixture.calls).toEqual([])
})

it('drains helpers and waits for every owned job before confirming all activity stopped', async () => {
  const fixture = host()
  expect(await retireWriters(fixture.ctx, 'root')).toEqual({ stopped: true })
  expect(fixture.calls).toEqual(['drain helpers', 'kill root root-job', 'wait root root-job', 'verify root', 'kill helper helper-job', 'wait helper helper-job', 'verify helper'])
})

it('does not turn cancellation acceptance or a job wait timeout into stop proof', async () => {
  const fixture = host()
  fixture.services.jobs.wait = async (id, _timeout, owner) => ({ id, owner, status: 'stopping' })
  expect(await retireWriters(fixture.ctx, 'root')).toEqual({ stopped: false, reason: 'native_job_stop_unconfirmed' })
  expect(fixture.calls).toEqual(['drain helpers', 'kill root root-job'])
})

it('surfaces missing native inspection rather than assuming there are no writers', async () => {
  const fixture = host()
  const get = fixture.ctx.get.bind(fixture.ctx)
  fixture.ctx.get = ((name: string) => name === 'jobs' ? undefined : get(name as never)) as Context['get']
  expect(await retireWriters(fixture.ctx, 'root')).toEqual({ stopped: false, reason: 'native_writer_inspection_unavailable' })
})
