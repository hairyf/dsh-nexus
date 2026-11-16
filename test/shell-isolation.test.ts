import { existsSync } from 'node:fs'
import { readdir, readFile, realpath, symlink } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { assertShellLandingPaths, createShellIsolation, exchangeProcessLaunchToken, processLaunchUrlFromLog } from './__setup__/shell.utils'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  for (const cleanup of cleanups.splice(0))
    await cleanup()
})

it('creates fresh private shell storage without inheriting user storage overrides', async () => {
  const inherited = { PATH: '/test/bin', DSH_HOME: '/user/home', DSH_AGENTS_HOME: '/user/agents', DEEPSEEK_API_KEY: 'inherited-only' }
  const first = await createShellIsolation(inherited)
  cleanups.push(first.close)
  const second = await createShellIsolation(inherited)
  cleanups.push(second.close)
  expect(first.home).not.toBe(second.home)
  expect(isAbsolute(first.home)).toBe(true)
  expect(await realpath(first.home)).toBe(first.home)
  expect(first.env).toMatchObject({ PATH: '/test/bin', DEEPSEEK_API_KEY: 'inherited-only', DSH_HOME: first.home, DSH_AGENTS_HOME: join(first.home, 'agents'), npm_config_cache: join(first.home, 'cache/npm'), XDG_CACHE_HOME: join(first.home, 'cache'), XDG_DATA_HOME: join(first.home, 'data') })
  expect(await readdir(first.home)).toEqual(expect.arrayContaining(['agents', 'artifacts', 'sessions', 'storages', 'tmp']))
  expect(await readdir(join(first.home, 'agents'))).toEqual([])
  expect(JSON.parse(await readFile(first.patch, 'utf8'))).toContainEqual({ id: 'permission', config: { defaultPreset: 'danger-full-access' } })
  await expect(assertShellLandingPaths(first.home, [join(first.home, 'sessions'), join(first.home, 'storages/nexus/worktrees')])).resolves.toBeUndefined()
  expect(inherited.DSH_HOME).toBe('/user/home')
  await first.close()
  expect(existsSync(first.home)).toBe(false)
  await first.close()
})

it('references an explicitly selected credential file without copying its contents', async () => {
  const isolation = await createShellIsolation({ DSH_E2E_CREDENTIALS_FILE: import.meta.filename })
  cleanups.push(isolation.close)
  expect(isolation.env.DSH_E2E_CREDENTIALS_FILE).toBe(import.meta.filename)
  expect(await readdir(isolation.home)).not.toContain('.credentials.yaml')
  expect(await readFile(isolation.patch, 'utf8')).toContain(import.meta.filename)
})

it('rejects actual storage symlinks escaping the temporary home', async () => {
  const first = await createShellIsolation({})
  const second = await createShellIsolation({})
  cleanups.push(first.close, second.close)
  const escape = join(first.home, 'escaped-storage')
  await symlink(join(second.home, 'sessions'), escape, 'junction')
  await expect(assertShellLandingPaths(first.home, [escape])).rejects.toThrow('escaped its isolated home')
})

it('rejects missing credential references and profile traversal before launching a CLI', async () => {
  await expect(createShellIsolation({ DSH_E2E_CREDENTIALS_FILE: '/missing/e2e-credentials.yaml' })).rejects.toThrow('credential reference')
  await expect(createShellIsolation({ DSH_E2E_PROFILE: '../web' })).rejects.toThrow('simple profile name')
})

it('selects only the latest trusted launch URL from a private process log', () => {
  expect(processLaunchUrlFromLog('http://127.0.0.1:3091', [
    'dsh web: http://127.0.0.1:3091/?token=old-private-token',
    'dsh web: http://127.0.0.1:3081/?token=user-instance',
    'dsh web: http://127.0.0.1:3091/?token=current-private-token',
    'dsh web: http://127.0.0.1:3091/other?token=untrusted',
  ].join('\n'))).toBe('http://127.0.0.1:3091/?token=current-private-token')
  expect(processLaunchUrlFromLog('http://127.0.0.1:3091', 'dsh web: http://example.com/?token=unsafe')).toBe('')
})

it('does not disclose launch tokens when the exchange fails', async () => {
  await expect(exchangeProcessLaunchToken('http://127.0.0.1:3091', 'http://127.0.0.1:3091/?token=private-token', async () => new Response(null, { status: 401 }))).rejects.toThrow('HTTP 401, expected 303')
})
