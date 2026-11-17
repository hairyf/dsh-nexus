import type { H3 } from 'h3'

export function createDispatch(app: H3, trusted: WeakSet<Request>): (request: Request) => Promise<Response> {
  return async (request) => {
    let envelope: unknown
    try {
      envelope = await request.json()
    }
    catch {
      return invalid()
    }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope))
      return invalid()
    const value = envelope as Record<string, unknown>
    if (Object.keys(value).some(key => !['path', 'method', 'body'].includes(key)) || typeof value.path !== 'string' || typeof value.method !== 'string')
      return invalid()
    if (!['GET', 'HEAD', 'POST', 'PATCH'].includes(value.method) || !value.path || value.path.length > 4096)
      return invalid()
    const segments = value.path.split('/')
    if (segments.some(segment => !segment || !/^(?:[\w.~-]|%[A-F0-9]{2})+$/iu.test(segment)))
      return invalid()
    let decoded: string[]
    try {
      decoded = segments.map(segment => decodeURIComponent(segment))
    }
    catch {
      return invalid()
    }
    if (decoded[0] === 'dispatch' || decoded.some(segment => segment === '.' || segment === '..' || [...segment].some(char => char.charCodeAt(0) <= 32 || '/\\%'.includes(char))))
      return invalid()
    if ((value.method === 'GET' || value.method === 'HEAD') && value.body !== undefined)
      return invalid()
    const url = new URL(request.url)
    url.pathname = `/api/nexus/${value.path}`
    url.search = ''
    url.hash = ''
    const headers = new Headers(request.headers)
    headers.delete('content-length')
    headers.delete('transfer-encoding')
    if (value.body === undefined)
      headers.delete('content-type')
    else
      headers.set('content-type', 'application/json')
    const forwarded = new Request(url, { method: value.method, headers, body: value.body === undefined ? undefined : JSON.stringify(value.body), signal: request.signal })
    trusted.add(forwarded)
    try {
      return await app.fetch(forwarded)
    }
    finally {
      trusted.delete(forwarded)
    }
  }
}

function invalid(): Response {
  return Response.json({ message: 'invalid_dispatch', data: { code: 'invalid_dispatch' } }, { status: 400 })
}
