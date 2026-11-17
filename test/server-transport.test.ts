import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionFetchRoute } from '@deepseek-ai/dsh-client-connection'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { WebServerOptions } from '../src/types/web'
import { Buffer } from 'node:buffer'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Duplex } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { server } from '../src/server'

function fixture(options: { rejectRegistration?: boolean, value?: string } = {}) {
  const routes = new Map<string, WebRoute>()
  const fetchRoutes = new Map<string, ConnectionFetchRoute>()
  const mutations: unknown[] = []
  const ctx = {
    webServer: { register(route: WebRoute) {
      routes.set(`${route.kind}:${route.path}`, route)
      return () => routes.delete(`${route.kind}:${route.path}`)
    } },
    connection: { fetch: { register(route: ConnectionFetchRoute) {
      if (options.rejectRegistration)
        throw new Error('registration_failed')
      fetchRoutes.set(route.path, route)
      return async () => {
        fetchRoutes.delete(route.path)
      }
    } } },
  } as unknown as Context
  const config: WebServerOptions = { panel: {
    resolve: () => ({ value: options.value ?? 'first' }),
    mailbox: (id: string) => ({ sessionId: id, pendingCount: 2 }),
    setSettings: (body: unknown, actor: unknown) => {
      mutations.push({ body, actor })
      return body
    },
  } as unknown as WebServerOptions['panel'], owner: event => event.req.headers.get('cookie') === 'owner=yes' ? { kind: 'web', authenticated: true, userId: 'owner' } : null }
  const start = () => server(ctx, config)
  const carrier = (body: unknown, headers: HeadersInit = {}) => fetchRoutes.get('/api/nexus/dispatch')!.fetch(new Request('http://carrier.test/api/nexus/dispatch', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }))
  const http = async (path: string, init?: RequestInit): Promise<Response> => {
    const route = routes.get(`exact:${path}`)
    if (!route)
      throw new Error('test_route_not_registered')
    const chunks: Buffer[] = []
    const socket = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      },
    })
    const req = new IncomingMessage(socket as never)
    req.method = init?.method ?? 'GET'
    req.url = path
    req.headers = Object.fromEntries(new Headers({ 'host': 'carrier.test', 'content-length': String(Buffer.byteLength(String(init?.body ?? ''))), ...init?.headers }).entries())
    req.complete = true
    req.httpVersion = '1.1'
    if (init?.body)
      req.push(String(init.body))
    req.push(null)
    const res = new ServerResponse(req)
    res.assignSocket(socket as never)
    const finished = new Promise<void>((resolve, reject) => {
      res.once('finish', resolve)
      res.once('error', reject)
    })
    await route.handler(req, res)
    await finished
    const raw = Buffer.concat(chunks).toString()
    const body = raw.slice(raw.indexOf('\r\n\r\n') + 4)
    socket.destroy()
    return new Response(body, { status: res.statusCode, headers: Object.fromEntries(Object.entries(res.getHeaders()).map(([key, value]) => [key, String(value)])) })
  }
  return { start, carrier, http, routes, fetchRoutes, mutations }
}

describe('nexus shared H3 transport', () => {
  it('dispatches authenticated carrier GET and PATCH through the real H3 business handlers', async () => {
    const host = fixture()
    const dispose = host.start()
    try {
      const panel = await host.carrier({ path: 'panel', method: 'GET' })
      expect(panel.status).toBe(200)
      expect(await panel.json()).toEqual({ value: 'first' })
      expect(panel.headers.get('cache-control')).toBe('no-store')
      const mailbox = await host.carrier({ path: 'sessions/agent-1/mailbox', method: 'GET' })
      expect(await mailbox.json()).toEqual({ sessionId: 'agent-1', pendingCount: 2 })
      const patch = await host.carrier({ path: 'settings', method: 'PATCH', body: { maxWorkers: 3 } })
      expect(patch.status).toBe(200)
      expect(await patch.json()).toEqual({ maxWorkers: 3 })
      expect(host.mutations).toEqual([{ body: { maxWorkers: 3 }, actor: { kind: 'web', authenticated: true, userId: 'owner' } }])
    }
    finally { await dispose() }
  })

  it('rejects cross-origin carrier dispatch without changing business state', async () => {
    const host = fixture()
    const dispose = host.start()
    try {
      const response = await host.carrier({ path: 'settings', method: 'PATCH', body: { maxWorkers: 3 } }, { origin: 'http://other.test' })
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ data: { code: 'origin_denied' } })
      expect(host.mutations).toEqual([])
    }
    finally { await dispose() }
  })

  it.each(['../panel', '%2e%2e/panel', 'sessions/a%2fb/mailbox', 'sessions/a%5cb/mailbox', 'sessions/%252e%252e/mailbox', '//panel', '/panel', 'http://other.test/panel', 'dispatch', '%64ispatch', 'panel?x=1', 'panel#x', 'panel//next', 'panel/%ZZ'])('rejects unsafe dispatch path %s', async (path) => {
    const host = fixture()
    const dispose = host.start()
    try {
      const response = await host.carrier({ path, method: 'GET' })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ message: 'invalid_dispatch', data: { code: 'invalid_dispatch' } })
      expect(host.mutations).toEqual([])
    }
    finally { await dispose() }
  })

  it.each([null, [], {}, { path: 'panel', method: 'DELETE' }, { path: 'panel', method: 'GET', body: {} }, { path: 'panel', method: 'GET', actor: 'owner' }])('rejects malformed dispatch envelope %j', async (body) => {
    const host = fixture()
    const dispose = host.start()
    try {
      const response = await host.carrier(body)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ data: { code: 'invalid_dispatch' } })
    }
    finally { await dispose() }
  })

  it('keeps HTTP dispatch behind the original owner authentication', async () => {
    const host = fixture()
    const dispose = host.start()
    try {
      const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: 'panel', method: 'GET' }) }
      const denied = await host.http('/api/nexus/dispatch', init)
      expect(denied.status).toBe(401)
      expect(await denied.json()).toMatchObject({ data: { code: 'owner_required' } })
      const allowed = await host.http('/api/nexus/dispatch', { ...init, headers: { ...init.headers, cookie: 'owner=yes' } })
      expect(allowed.status).toBe(200)
      expect(await allowed.json()).toEqual({ value: 'first' })
    }
    finally { await dispose() }
  })

  it('keeps activation state independent and removes both route registrations on dispose', async () => {
    const first = fixture({ value: 'first' })
    const second = fixture({ value: 'second' })
    const disposeFirst = first.start()
    const disposeSecond = second.start()
    try {
      expect(await (await first.carrier({ path: 'panel', method: 'GET' })).json()).toEqual({ value: 'first' })
      expect(await (await second.carrier({ path: 'panel', method: 'GET' })).json()).toEqual({ value: 'second' })
      const closing = disposeFirst()
      expect(first.routes.size).toBe(0)
      expect(first.fetchRoutes.size).toBe(0)
      await closing
      expect(second.fetchRoutes.size).toBe(1)
    }
    finally {
      await disposeFirst()
      await disposeSecond()
    }
  })

  it('rolls back H3 routes when carrier registration fails', () => {
    const host = fixture({ rejectRegistration: true })
    expect(() => host.start()).toThrow('registration_failed')
    expect(host.routes.size).toBe(0)
    expect(host.fetchRoutes.size).toBe(0)
  })
})
