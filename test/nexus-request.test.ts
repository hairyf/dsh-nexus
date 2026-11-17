import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from '../src/client/apis/nexus'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('nexus HTTP responses', () => {
  it('reports a missing host route without trying to parse plain text as JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })))
    await expect(request('panel')).rejects.toThrow('Nexus 服务接口未就绪（HTTP 404）')
  })

  it('requests the API relative to the host mount and retains credentials', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ pendingCount: 2 }))
    vi.stubGlobal('fetch', fetch)
    await request('panel')
    expect(fetch).toHaveBeenCalledWith('api/nexus/dispatch', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: JSON.stringify({ path: 'panel', method: 'GET' }) }))
  })

  it('carries a resource mutation through the same fixed host endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ accepted: true }))
    vi.stubGlobal('fetch', fetch)
    await request('projects/p', 'PATCH', { enabled: true })
    expect(fetch).toHaveBeenCalledWith('api/nexus/dispatch', expect.objectContaining({ method: 'POST', body: JSON.stringify({ path: 'projects/p', method: 'PATCH', body: { enabled: true } }) }))
  })

  it('preserves a domain not-found error instead of reporting a missing route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: { code: 'unknown_target' } }, { status: 404 })))
    await expect(request('tickets/missing')).rejects.toThrow('unknown_target')
  })

  it('preserves structured host error codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: { code: 'owner_required' } }, { status: 401 })))
    await expect(request('panel')).rejects.toThrow('owner_required')
  })

  it('rejects a successful non-JSON response instead of treating it as an empty ledger', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>shell</html>', { headers: { 'content-type': 'text/html' } })))
    await expect(request('panel')).rejects.toThrow('Nexus 服务返回了无效数据')
  })

  it('returns a valid JSON payload unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ pendingCount: 2 })))
    await expect(request('panel')).resolves.toEqual({ pendingCount: 2 })
  })
})
