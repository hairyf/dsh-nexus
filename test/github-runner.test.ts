import type { ChildProcess, ExecFileOptions } from 'node:child_process'
import { execFile } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExecFileGhRunner } from '../src/channel/github/runner'

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))

afterEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
})

function processResponse(stdout: string, stderr = '', code?: string) {
  const stdin = { end: vi.fn() }
  vi.mocked(execFile).mockImplementation(((file: string, args: readonly string[], options: ExecFileOptions, callback: (error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void) => {
    callback(code ? Object.assign(new Error(stderr), { code }) : null, stdout, stderr)
    return { stdin } as unknown as ChildProcess
  }) as typeof execFile)
  return stdin
}

describe('execFile gh boundary', () => {
  it('uses gh api JSON stdin with the explicitly selected site and cancellable process', async () => {
    const stdin = processResponse('HTTP/2.0 201 Created\r\nContent-Type: application/json\r\n\r\n{"id":55}')
    const signal = new AbortController().signal
    expect(await new ExecFileGhRunner().request({ site: 'github.example.com', method: 'POST', path: 'repos/org/repo/issues/7/comments', body: { body: 'Question' }, signal })).toEqual({ id: 55 })
    expect(execFile).toHaveBeenCalledWith('gh', ['api', '--hostname', 'github.example.com', '--method', 'POST', '--include', 'repos/org/repo/issues/7/comments', '--input', '-'], expect.objectContaining({ signal, timeout: 30000 }), expect.any(Function))
    expect(stdin.end).toHaveBeenCalledWith('{"body":"Question"}')
  })

  it.each([
    ['ENOENT', '', 'secret token', 'gh_missing'],
    ['1', 'HTTP/2.0 401 Unauthorized\n\n{}', 'secret token', 'not_logged_in'],
    ['1', 'HTTP/2.0 403 Forbidden\n\n{}', 'secret token', 'forbidden'],
    ['1', 'HTTP/2.0 404 Not Found\n\n{}', 'secret token', 'not_found'],
    ['1', 'HTTP/2.0 503 Service Unavailable\n\n{}', 'secret token', 'transport_unknown'],
    ['ABORT_ERR', '', 'secret token', 'interrupted'],
  ])('returns sanitized %s failures without credential-bearing process output', async (code, stdout, stderr, expected) => {
    processResponse(stdout, stderr, code)
    const error = await new ExecFileGhRunner().request({ site: 'github.com', method: 'GET', path: 'user' }).catch(error => error)
    expect(error).toMatchObject({ code: expected, message: expected })
    expect(JSON.stringify(error)).not.toContain('secret token')
    expect(error).not.toHaveProperty('cause')
  })

  it('preserves numeric Retry-After and rejects malformed JSON instead of treating it as empty', async () => {
    processResponse('HTTP/2.0 429 Too Many Requests\nRetry-After: 60\n\n{}', 'credential omitted', '1')
    await expect(new ExecFileGhRunner().request({ site: 'github.com', method: 'GET', path: 'user' })).rejects.toMatchObject({ code: 'rate_limited', retryAfterSeconds: 60 })
    processResponse('HTTP/2.0 200 OK\n\nnot json')
    await expect(new ExecFileGhRunner().request({ site: 'github.com', method: 'GET', path: 'user' })).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
