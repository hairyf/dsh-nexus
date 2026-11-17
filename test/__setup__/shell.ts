import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import type { Page } from 'playwright'
import type { BrowserSeedCookie } from './shell.utils'
import { existsSync, readFileSync } from 'node:fs'
import { readFile, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { assertShellLandingPaths, createShellIsolation, dshCommand, exchangeProcessLaunchToken, freePort, processLaunchUrlFromLog, stop } from './shell.utils'

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const PACKAGE_NAME = (JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { name: string }).name

export interface ShellScaffold {
  baseUrl: string
  home: string
  cookie: BrowserSeedCookie | null
  api: (path: string, init?: RequestInit) => Promise<Response>
  close: () => Promise<void>
}

export async function openShellPage(page: Page, scaffold: Pick<ShellScaffold, 'baseUrl' | 'cookie'>): Promise<void> {
  if (scaffold.cookie)
    await page.context().addCookies([scaffold.cookie])
  await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
}

export function logs(page: Page): { errors: () => string[] } {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`)
  })
  page.on('pageerror', error => errors.push(String(error)))
  return { errors: () => [...errors] }
}

async function verifyProfile(home: string, profile: string, dataDirectory: string): Promise<void> {
  const directory = join(home, 'profiles', profile)
  await assertShellLandingPaths(home, [directory, join(home, 'agents'), join(home, 'sessions'), dataDirectory, join(dataDirectory, 'worktrees'), join(dataDirectory, 'data.db')])
  if (await realpath(join(directory, 'node_modules', PACKAGE_NAME)) !== await realpath(REPO_ROOT))
    throw new Error('E2E profile must link the current checkout, not an installed or developer copy')
}

async function scaffold(baseUrl: string, processLaunchUrl: string, home: string, close: () => Promise<void>): Promise<ShellScaffold> {
  const exchange = await exchangeProcessLaunchToken(baseUrl, processLaunchUrl)
  const cookie = exchange?.cookie ?? null
  return {
    baseUrl,
    home,
    cookie,
    close,
    api: (path, init = {}) => {
      const url = new URL(path, baseUrl)
      if (url.origin !== baseUrl)
        throw new Error('DSH API requests must stay on the test origin')
      const headers = new Headers(init.headers)
      if (cookie)
        headers.set('cookie', `${cookie.name}=${cookie.value}`)
      return fetch(url, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(30_000) })
    },
  }
}

export async function launchShell(): Promise<ShellScaffold> {
  if (process.env.DSH_E2E_ATTACH_URL) {
    const baseUrl = process.env.DSH_E2E_ATTACH_URL
    const home = process.env.DSH_E2E_ATTACH_HOME
    const profile = process.env.DSH_E2E_ATTACH_PROFILE
    const log = process.env.DSH_E2E_ATTACH_LOG
    if (baseUrl !== 'http://127.0.0.1:3091' || home !== '/tmp/dsh-nexus-test' || profile !== 'nexus-test' || !log)
      throw new Error('Attach requires the authorized 3091 nexus-test instance, explicit DSH_E2E_ATTACH_HOME, DSH_E2E_ATTACH_PROFILE and DSH_E2E_ATTACH_LOG')
    const dataDirectory = process.env.DSH_E2E_ATTACH_DATA_DIR ?? join(home, 'storages/nexus')
    await verifyProfile(home, profile, dataDirectory)
    const launchUrl = processLaunchUrlFromLog(baseUrl, await readFile(log, 'utf8'))
    if (!launchUrl)
      throw new Error('The attach log has no trusted launch URL; restart the isolated instance before E2E')
    const shell = await scaffold(baseUrl, launchUrl, home, async () => {})
    const response = await shell.api('/api/nexus/panel')
    if (!response.ok)
      throw new Error(`Attached Nexus panel is unavailable: HTTP ${response.status}`)
    await response.arrayBuffer()
    return shell
  }

  const command = dshCommand()
  if (!command)
    throw new Error('No dsh CLI available; set DSH_E2E_DSH or put dsh on PATH')
  if (!existsSync(join(REPO_ROOT, 'dist/index.js')) || !existsSync(join(REPO_ROOT, 'dist/client.cjs')))
    throw new Error('Build the Nexus host and client before running E2E')
  if (!process.env.DSH_E2E_MAGPIE_BASE_URL || (!process.env.DSH_E2E_CREDENTIALS_FILE && !process.env.MAGPIE_API_KEY))
    throw new Error('E2E requires DSH_E2E_MAGPIE_BASE_URL and either DSH_E2E_CREDENTIALS_FILE or inherited MAGPIE_API_KEY')

  const isolation = await createShellIsolation()
  let child: ChildProcess | undefined
  try {
    for (const args of [
      [isolation.profile, '--from-default-profile', 'web', '--dump-config'],
      ['plugin', '--profile', isolation.profile, 'add', '--ignore-scripts', `link:${REPO_ROOT.replace(/\\/gu, '/')}`],
      ['plugin', '--profile', isolation.profile, 'add', '--ignore-scripts', 'dsh-better-sidebar@0.32.0'],
    ]) {
      const result = await x(command, args, { timeout: 300_000, throwOnError: false, nodeOptions: { cwd: join(isolation.home, 'artifacts'), env: isolation.env, windowsHide: true } })
      if (result.exitCode !== 0)
        throw new Error('Failed to prepare isolated E2E profile; no fallback to a user profile is allowed')
    }
    await assertShellLandingPaths(isolation.home, [isolation.profileDirectory, join(isolation.profileDirectory, 'package.json')])
    const port = await freePort()
    const baseUrl = `http://127.0.0.1:${port}`
    child = x(command, ['--profile', isolation.profile, '--patch', isolation.patch, '--port', String(port), '--no-open'], {
      nodeOptions: { cwd: join(isolation.home, 'artifacts'), env: isolation.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    }).process
    if (!child)
      throw new Error('Failed to start the isolated DSH process')
    let output = ''
    let launchUrl = ''
    let spawnError: Error | undefined
    child.on('error', error => spawnError = error)
    for (const stream of [child.stdout, child.stderr]) {
      stream?.on('data', (chunk: Buffer) => {
        output = (output + chunk.toString()).slice(-65536)
        launchUrl = processLaunchUrlFromLog(baseUrl, output)
      })
    }
    const deadline = Date.now() + 120_000
    while (!processLaunchUrlFromLog(baseUrl, output)) {
      if (spawnError)
        throw spawnError
      if (child.exitCode !== null)
        throw new Error(`DSH exited ${child.exitCode} during isolated startup`)
      if (Date.now() > deadline)
        throw new Error('DSH boot timed out before a trusted launch URL was printed')
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    const shell = await scaffold(baseUrl, launchUrl, isolation.home, async () => {
      await stop(child!)
      await isolation.close()
    })
    const response = await shell.api('/api/nexus/panel')
    if (!response.ok)
      throw new Error(`Nexus panel prerequisite failed with HTTP ${response.status}`)
    await response.arrayBuffer()
    await verifyProfile(isolation.home, isolation.profile, join(isolation.home, 'storages/nexus'))
    return shell
  }
  catch (error) {
    if (child)
      await stop(child)
    await isolation.close()
    throw error
  }
}
