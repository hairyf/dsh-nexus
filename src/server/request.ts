import type { H3Event } from 'h3'
import type { WebServerOptions } from '../types/web'
import { getServerOptions } from 'dsh-h3/utils'
import { HTTPError, readBody } from 'h3'
import { LedgerError } from '../database'

export async function request<T>(event: H3Event, run: (panel: WebServerOptions['panel'], actor: NonNullable<ReturnType<WebServerOptions['owner']>>) => T | Promise<T>): Promise<T> {
  const options = getServerOptions<WebServerOptions>(event)
  const actor = options.owner(event)
  if (!actor?.authenticated || !actor.userId)
    throw new HTTPError({ status: 401, message: 'owner_required', data: { code: 'owner_required' } })
  const origin = event.req.headers.get('origin')
  if (origin && origin !== event.url.origin)
    throw new HTTPError({ status: 403, message: 'origin_denied', data: { code: 'origin_denied' } })
  event.res.headers.set('cache-control', 'no-store')
  try {
    return await run(options.panel, actor)
  }
  catch (error) {
    if (!(error instanceof LedgerError))
      throw error
    const status = error.code === 'not_found' || error.code === 'unknown_target' ? 404 : ['human_required', 'scope_denied', 'unauthorized', 'management_authorization_required'].includes(error.code) ? 403 : error.code.startsWith('invalid') || error.code.endsWith('_required') ? 400 : 409
    throw new HTTPError({ status, message: error.code, data: { code: error.code } })
  }
}

export async function input(event: H3Event, keys: readonly string[]): Promise<Record<string, unknown>> {
  const value = await readBody(event)
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    throw new HTTPError({ status: 400, message: 'invalid_parameters', data: { code: 'invalid_parameters' } })
  return value as Record<string, unknown>
}

export function text(value: unknown): string {
  if (typeof value !== 'string')
    throw new HTTPError({ status: 400, message: 'invalid_parameters', data: { code: 'invalid_parameters' } })
  return value
}
