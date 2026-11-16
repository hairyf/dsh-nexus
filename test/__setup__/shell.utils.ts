import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative } from 'node:path'
import process from 'node:process'
import { x } from 'tinyexec'

export interface ShellIsolation {
  home: string
  profile: string
  patch: string
  profileDirectory: string
  env: NodeJS.ProcessEnv
  close: () => Promise<void>
}

export async function createShellIsolation(inherited: NodeJS.ProcessEnv = process.env): Promise<ShellIsolation> {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'dsh-nexus-e2e-')))
  const profile = inherited.DSH_E2E_PROFILE ?? 'nexus-e2e'
  if (!/^[a-z0-9][\w-]*$/iu.test(profile)) {
    await rm(home, { recursive: true, force: true })
    throw new Error('DSH_E2E_PROFILE must be a simple profile name')
  }
  const directories = ['agents', 'artifacts', 'sessions', 'tmp', 'storages/nexus/worktrees', 'cache/npm', 'data']
  await Promise.all(directories.map(directory => mkdir(join(home, directory), { recursive: true })))
  const patch = join(home, 'e2e.patch.json')
  const credentials = inherited.DSH_E2E_CREDENTIALS_FILE
  if (credentials && (!isAbsolute(credentials) || !existsSync(credentials))) {
    await rm(home, { recursive: true, force: true })
    throw new Error('DSH_E2E_CREDENTIALS_FILE must name an existing absolute read-only credential reference')
  }
  await writeFile(patch, JSON.stringify([
    { id: 'credentials', config: { path: credentials ?? join(home, '.credentials.yaml'), watch: false } },
    { id: 'permission', config: { defaultPreset: 'danger-full-access' } },
    { id: 'session-persistence-jsonl', config: { root: join(home, 'sessions') } },
    { id: 'storage-json', config: { root: join(home, 'storages') } },
    { id: 'attachment-local', config: { dshHome: home } },
    { id: 'dsh-nexus', config: { dataDir: join(home, 'storages/nexus') } },
    { id: 'llm-pi-ai', config: { providers: { magpie: {
      apiKeyEnv: 'MAGPIE_API_KEY',
      api: 'anthropic-messages',
      baseURL: inherited.DSH_E2E_MAGPIE_BASE_URL,
      models: [{ id: 'auto/deepseek-flash', name: 'DeepSeek V4.1 Flash', contextWindow: 1000000, maxTokens: 393216, input: ['text', 'image'], reasoningEfforts: { max: 'max' } }],
    } } } },
    { id: 'agent-default-model', config: { provider: 'magpie', model: 'auto/deepseek-flash', reasoningEffort: 'max' } },
  ], null, 2), { mode: 0o600 })
  return {
    home,
    profile,
    patch,
    profileDirectory: join(home, 'profiles', profile),
    env: { ...inherited, CI: 'true', DSH_HOME: home, DSH_AGENTS_HOME: join(home, 'agents'), npm_config_cache: join(home, 'cache/npm'), XDG_CACHE_HOME: join(home, 'cache'), XDG_DATA_HOME: join(home, 'data'), TMPDIR: join(home, 'tmp'), TMP: join(home, 'tmp'), TEMP: join(home, 'tmp') },
    close: () => rm(home, { recursive: true, force: true }),
  }
}

export async function assertShellLandingPaths(home: string, paths: string[]): Promise<void> {
  const root = await realpath(home)
  for (const path of paths) {
    const landing = await realpath(path)
    const child = relative(root, landing)
    if (!child || child === '..' || child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(child))
      throw new Error('DSH E2E storage escaped its isolated home')
  }
}

export function processLaunchUrlFromLog(baseUrl: string, output: string): string {
  let latest = ''
  for (const line of output.split(/\r?\n/u)) {
    const match = /^dsh web:\s+(https?:\/\/\S+)\s*$/u.exec(line)
    if (match && trustedProcessLaunchUrl(baseUrl, match[1]!) !== null)
      latest = match[1]!
  }
  return latest
}

export interface BrowserSeedCookie {
  name: string
  value: string
  url: string
  expires: number
  httpOnly: true
  secure: boolean
  sameSite: 'Strict'
}

export function dshCommand(): string | null {
  const explicit = process.env.DSH_E2E_DSH ?? process.env.DSHM_E2E_DSH
  if (explicit)
    return explicit

  const path = process.env.PATH ?? ''
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD;.PS1').split(';')
    : ['']

  for (const directory of path.split(process.platform === 'win32' ? ';' : ':')) {
    if (!directory)
      continue
    for (const extension of extensions) {
      if (existsSync(join(directory, `dsh${extension}`)))
        return 'dsh'
    }
  }
  return null
}

export function dshAvailable(): boolean {
  if (dshCommand() !== null)
    return true
  if (process.env.DSH_E2E_REQUIRED === '1' || process.env.DSHM_E2E_REQUIRED === '1')
    throw new Error('DSH_E2E_REQUIRED=1 but no dsh CLI is reachable')
  return false
}

export function cleanRootUrl(baseUrl: string): URL {
  const url = new URL(baseUrl)
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return url
}

export function trustedProcessLaunchUrl(baseUrl: string, value: string): URL | null {
  try {
    const expected = cleanRootUrl(baseUrl)
    const candidate = new URL(value)
    if (
      candidate.origin !== expected.origin
      || candidate.pathname !== '/'
      || candidate.hash !== ''
      || candidate.username !== ''
      || candidate.password !== ''
    ) {
      return null
    }
    if (candidate.search === '')
      return candidate
    const entries = [...candidate.searchParams.entries()]
    if (entries.length !== 1 || entries[0]?.[0] !== 'token' || !entries[0]?.[1])
      return null
    return candidate
  }
  catch {
    return null
  }
}

export function parseSessionCookie(header: string, expected: URL): BrowserSeedCookie {
  const segments = header.split(';').map(s => s.trim())
  const pair = segments.shift() ?? ''
  const separator = pair.indexOf('=')
  if (separator <= 0)
    throw new Error('process launch token exchange returned a malformed Set-Cookie')

  const name = pair.slice(0, separator).trim()
  const rawValue = pair.slice(separator + 1).trim()
  const value = rawValue.startsWith('"') && rawValue.endsWith('"') ? rawValue.slice(1, -1) : rawValue

  if (!/^[!#$%&'*+\-.^\w`|~]+$/u.test(name))
    throw new Error('process launch token exchange returned an unsafe cookie name')
  if (!/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/u.test(value))
    throw new Error('process launch token exchange returned an unsafe cookie value')

  const attributes = new Map<string, string | true>()
  for (const segment of segments) {
    if (!segment)
      continue
    const at = segment.indexOf('=')
    const key = (at < 0 ? segment : segment.slice(0, at)).trim().toLowerCase()
    const val = at < 0 ? true : segment.slice(at + 1).trim()
    if (attributes.has(key))
      throw new Error(`process launch token exchange duplicated ${key}`)
    attributes.set(key, val)
  }

  const allowed = new Set(['max-age', 'path', 'expires', 'httponly', 'secure', 'samesite', 'domain'])
  if ([...attributes.keys()].some(key => !allowed.has(key)))
    throw new Error('process launch token exchange returned an unsupported cookie attribute')
  if (attributes.has('domain') || attributes.get('path') !== '/' || attributes.get('httponly') !== true)
    throw new Error('process launch token exchange returned an invalid host-only cookie')
  if (attributes.get('samesite') !== 'Strict')
    throw new Error('process launch token exchange cookie was not SameSite=Strict')

  const secure = attributes.get('secure') === true
  if (secure !== (expected.protocol === 'https:'))
    throw new Error('process launch token exchange cookie Secure did not match the origin scheme')

  const maxAge = attributes.get('max-age')
  const maxAgeSeconds = typeof maxAge === 'string' ? Number(maxAge) : Number.NaN
  if (typeof maxAge !== 'string' || !/^\d+$/u.test(maxAge) || !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds <= 0)
    throw new Error('process launch token exchange cookie Max-Age was not positive')

  const expires = typeof attributes.get('expires') === 'string' ? Date.parse(attributes.get('expires') as string) : Number.NaN
  if (!Number.isFinite(expires) || expires <= Date.now())
    throw new Error('process launch token exchange cookie Expires was not in the future')

  return {
    name,
    value,
    url: expected.href,
    expires: Math.floor(expires / 1000),
    httpOnly: true,
    secure,
    sameSite: 'Strict',
  }
}

export async function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const picked = typeof address === 'object' && address ? address.port : 0
      probe.close(() => {
        if (picked === 0)
          reject(new Error('failed to allocate a port'))
        else
          resolve(picked)
      })
    })
  })
}

export async function stop(process_: ChildProcess): Promise<void> {
  if (process_.exitCode !== null || process_.signalCode !== null || process_.pid === undefined)
    return
  const exited = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Owned DSH process did not stop within 10 seconds')), 10000)
    process_.once('close', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
  if (process.platform === 'win32') {
    await x('taskkill', ['/pid', String(process_.pid), '/T', '/F'], {
      nodeOptions: { stdio: 'ignore' },
      timeout: 30_000,
    })
  }
  else {
    process_.kill('SIGTERM')
  }
  await exited
}

export async function exchangeProcessLaunchToken(
  baseUrl: string,
  processLaunchUrl: string,
  fetch_: typeof fetch = fetch,
): Promise<{ cookie: BrowserSeedCookie } | null> {
  const launch = trustedProcessLaunchUrl(baseUrl, processLaunchUrl)
  const expected = cleanRootUrl(baseUrl)
  if (!launch)
    throw new Error('dsh printed an untrusted process launch URL')

  const token = launch.searchParams.get('token') ?? ''
  if (!token) {
    if (launch.href !== expected.href)
      throw new Error('legacy dsh startup URL was not the clean root')
    return null
  }

  const response = await fetch_(launch.href, {
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  })
  try {
    if (response.status !== 303)
      throw new Error(`process launch token exchange returned HTTP ${response.status}, expected 303`)

    const location = response.headers.get('location')
    if (!location || new URL(location, launch).href !== expected.href)
      throw new Error('process launch token exchange returned an invalid redirect')

    const withSetCookie = response.headers as Headers & { getSetCookie?: () => string[] }
    const setCookies = withSetCookie.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean) as string[]
    if (setCookies.length !== 1)
      throw new Error(`process launch token exchange returned ${setCookies.length} Set-Cookie headers`)

    return { cookie: parseSessionCookie(setCookies[0]!, expected) }
  }
  finally {
    if (!response.bodyUsed)
      await response.arrayBuffer()
  }
}
