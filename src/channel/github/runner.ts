import type { GhRequest, GhRunner } from './types'
import { execFile } from 'node:child_process'

export class GhError extends Error {
  constructor(public readonly code: string, public readonly retryAfterSeconds?: number) {
    super(code)
  }
}

export class ExecFileGhRunner implements GhRunner {
  async request(request: GhRequest): Promise<unknown> {
    const args = ['api', '--hostname', request.site, '--method', request.method, '--include', request.path]
    if (request.body)
      args.push('--input', '-')
    return new Promise((resolve, reject) => {
      const child = execFile('gh', args, { signal: request.signal, timeout: 30000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
        const response = stdout.replace(/\r\n/g, '\n')
        const status = Number(/^HTTP\/\S+ (\d+)/m.exec(response)?.[1])
        const retryAfter = /^retry-after: (\d+)/im.exec(response)?.[1]
        if (error) {
          const code = (error as NodeJS.ErrnoException).code
          reject(new GhError(code === 'ENOENT' ? 'gh_missing' : status === 401 || /gh auth login|not logged/i.test(stderr) ? 'not_logged_in' : status === 429 || /rate limit/i.test(stderr) ? 'rate_limited' : status === 403 ? 'forbidden' : status === 404 ? 'not_found' : status >= 400 && status < 500 ? 'remote_rejected' : code === 'ABORT_ERR' ? 'interrupted' : 'transport_unknown', retryAfter ? Number(retryAfter) : undefined))
          return
        }
        try {
          const separator = response.indexOf('\n\n')
          if (separator < 0)
            throw new GhError('invalid_response')
          const body = response.slice(separator + 2).trim()
          resolve(body ? JSON.parse(body) : null)
        }
        catch {
          reject(new GhError('invalid_response'))
        }
      })
      if (request.body)
        child.stdin!.end(JSON.stringify(request.body))
    })
  }
}
