import type { Page } from 'playwright'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { dshCommand, exchangeProcessLaunchToken, freePort, stop, trustedProcessLaunchUrl } from './shell.utils'

export const HAS_DSH = dshCommand()

/**
 * `dsh plugin --profile web` 固定写真实用户目录，**不认 `DSH_HOME`**。
 * 所以装插件之前要先备份 profile 的两个文件，收尾时还原 ——
 * 否则每次 E2E 都会在 profile 里留下一条指向已删除临时 tarball 的依赖，
 * 下次 `pnpm add` 直接失败，而且污染开发者自己的环境。
 */
const PROFILE_DIR = join(homedir(), '.dsh', 'profiles', 'web')
const PROFILE_FILES = ['package.json', 'cordis.patch.yml'] as const

interface ProfileSnapshot {
  dir: string
  files: Map<string, string | undefined>
}

function snapshotProfile(): ProfileSnapshot {
  const files = new Map<string, string | undefined>()
  for (const name of PROFILE_FILES) {
    const path = join(PROFILE_DIR, name)
    files.set(name, existsSync(path) ? readFileSync(path, 'utf8') : undefined)
  }
  return { dir: PROFILE_DIR, files }
}

/**
 * 清掉 profile 里指向上一次 E2E 的悬空依赖。
 *
 * 只在 `close()` 里还原不够：测试被中断（Ctrl-C、超时、崩溃）时 close 不执行，
 * 下次 `pnpm add` 会去装一个已经被删掉的临时 tarball，直接失败 —— 而且报的是
 * 找不到文件，很容易误判成插件本身的问题。所以启动时先自愈一次。
 *
 * 幂等：没有这类残留就什么都不做。
 */
async function dropStaleE2EDependency(): Promise<void> {
  const path = join(PROFILE_DIR, 'package.json')
  if (!existsSync(path))
    return

  const raw = readFileSync(path, 'utf8')
  let parsed: { dependencies?: Record<string, string>, dsh?: { profile?: { bundles?: string[] } } }
  try {
    parsed = JSON.parse(raw) as typeof parsed
  }
  catch {
    return
  }

  const stale = Object.entries(parsed.dependencies ?? {})
    .filter(([name, spec]) => name === 'pkg-placeholder' || /dsh-e2e-home-/.test(spec))
    .map(([name, spec]) => ({ name, spec, missing: !existsSync(spec.replace(/^file:/, '')) }))

  if (!stale.length)
    return

  for (const entry of stale) delete parsed.dependencies?.[entry.name]
  const bundles = parsed.dsh?.profile?.bundles
  if (bundles)
    parsed.dsh!.profile!.bundles = bundles.filter(name => !stale.some(entry => entry.name === name))

  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`)
  await x('pnpm', ['install', '--ignore-scripts'], {
    timeout: 300_000,
    throwOnError: false,
    nodeOptions: { cwd: PROFILE_DIR, stdio: 'ignore' },
  })
}

async function restoreProfile(snapshot: ProfileSnapshot): Promise<void> {
  let touched = false
  for (const [name, content] of snapshot.files) {
    const path = join(snapshot.dir, name)
    if (content === undefined) {
      if (existsSync(path)) {
        rmSync(path, { force: true })
        touched = true
      }
      continue
    }
    if (existsSync(path) && readFileSync(path, 'utf8') === content)
      continue
    writeFileSync(path, content)
    touched = true
  }
  if (!touched)
    return
  // 依赖树也要跟着剪掉，否则 lockfile 仍指着旧 tarball
  await x('pnpm', ['install', '--ignore-scripts'], {
    timeout: 300_000,
    throwOnError: false,
    nodeOptions: { cwd: snapshot.dir, stdio: 'ignore' },
  })
}

export interface ShellScaffold {
  baseUrl: string
  processLaunchUrl: string
  home: string
  api: (path: string, init?: RequestInit) => Promise<Response>
  close: () => Promise<void>
}

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

export async function openShellPage(page: Page, scaffold: Pick<ShellScaffold, 'baseUrl' | 'processLaunchUrl'>): Promise<void> {
  const exchange = await exchangeProcessLaunchToken(scaffold.baseUrl, scaffold.processLaunchUrl)
  if (exchange) {
    await page.context().addCookies([exchange.cookie])
  }
  await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
}

export function logs(page: Page): { errors: () => string[] } {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const location = msg.location().url
      if (!msg.text().includes('401') && !msg.text().includes('Unauthorized'))
        errors.push(location ? `${msg.text()} (${location})` : msg.text())
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && response.status() !== 401)
      errors.push(`${response.status()} ${response.url()}`)
  })
  page.on('pageerror', err => errors.push(String(err)))
  return { errors: () => [...errors] }
}

export async function launchShell(): Promise<ShellScaffold> {
  const command = dshCommand()
  if (!command)
    throw new Error('no dsh available — set DSH_E2E_DSH or put dsh on PATH')

  const home = mkdtempSync(join(tmpdir(), 'dsh-e2e-home-'))
  /**
   * **不要设 `DSH_HOME`。**
   *
   * 它对这个版本的 dsh 不生效（`plugin` 与启动都固定走 `~/.dsh`），
   * 副作用却是致命的：设了之后 dsh 不再往 stdout 打印
   * `dsh web: http://127.0.0.1:<port>/?token=...`，于是拿不到启动 token，
   * 换不到 `SameSite=Strict` 的 Cookie，浏览器只能停在鉴权页
   * （"dsh web authentication required"）。
   *
   * 表现为「页面空白、零 console 错误」—— 因为鉴权页本身是正常渲染的。
   * 隔离靠下面的 profile 快照+还原，不靠这个环境变量。
   */
  const env = { ...process.env, CI: 'true' }
  await x('pnpm', ['run', 'build'], {
    timeout: 300_000,
    throwOnError: true,
    nodeOptions: { cwd: REPO_ROOT, env, stdio: 'inherit' },
  })
  await x('pnpm', ['pack', '--pack-destination', home], {
    timeout: 300_000,
    throwOnError: true,
    nodeOptions: { cwd: REPO_ROOT, env, stdio: 'inherit' },
  })
  const tarball = join(home, readdirSync(home).find(name => name.endsWith('.tgz'))!)
  await dropStaleE2EDependency()
  const profile = snapshotProfile()
  await x(command, ['plugin', '--profile', 'web', 'add', '--ignore-scripts', tarball], {
    timeout: 300_000,
    throwOnError: true,
    nodeOptions: { cwd: REPO_ROOT, env, stdio: 'inherit' },
  })

  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const cwd = process.env.DSH_E2E_DSH_CWD ?? REPO_ROOT
  const processResult = x(command, ['--profile', 'web', '--port', String(port), '--no-open'], {
    nodeOptions: {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    },
    persist: true,
  })
  const child = processResult.process
  if (!child)
    throw new Error('failed to start dsh web process')

  let processLaunchUrl = ''
  let startupOutput = ''
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on('data', (chunk: Uint8Array) => {
      startupOutput = (startupOutput + chunk.toString()).slice(-8192)
      for (const line of startupOutput.split(/\r?\n/u)) {
        const match = /^dsh web:\s+(https?:\/\/\S+)\s*$/u.exec(line)
        if (match && trustedProcessLaunchUrl(baseUrl, match[1]!) !== null) {
          processLaunchUrl = match[1]!
        }
      }
    })
  }

  const deadline = Date.now() + 120_000
  let statusReady = false
  let readyAt = 0
  for (; ;) {
    /**
     * 端口通了就算就绪，但**再给启动 URL 一点时间**。
     *
     * 这台机器上的 dsh 会打印 `dsh web: http://.../?token=...`；CI 上的版本
     * 不打印（走的是不需要 token 的旧路径，`exchangeProcessLaunchToken` 里
     * 有对应分支）。所以不能死等 —— 等不到就按无 token 处理，本地仍是
     * 「等到 URL 才走」，避免上一版那个「拿到 baseUrl 却没 token」的静默失败。
     */
    if (statusReady) {
      if (processLaunchUrl)
        break
      if (Date.now() - readyAt > 15_000)
        break
    }
    if (child.exitCode !== null)
      throw new Error(`dsh exited ${child.exitCode}:\n${startupOutput.slice(-2000)}`)
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) })
      if (!statusReady && (response.ok || response.status === 401))
        readyAt = Date.now()
      statusReady = response.ok || response.status === 401
    }
    catch {
      statusReady = false
    }
    if (Date.now() > deadline)
      throw new Error(`dsh boot timeout (status=${statusReady}, startup URL=${!processLaunchUrl ? 'missing' : 'ready'})`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  const session = await exchangeProcessLaunchToken(baseUrl, processLaunchUrl)
  const cookieHeader = session ? `${session.cookie.name}=${session.cookie.value}` : undefined
  let closed = false

  return {
    baseUrl,
    processLaunchUrl,
    home,
    api: async (path: string, init: RequestInit = {}) => fetch(
      new URL(path, baseUrl).href,
      {
        ...init,
        headers: {
          ...init.headers,
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        signal: init.signal ?? AbortSignal.timeout(30_000),
      },
    ),
    close: async () => {
      if (closed)
        return
      closed = true
      await stop(child)
      rmSync(home, { recursive: true, force: true })
      await restoreProfile(profile)
    },
  }
}
