import type { Workspace } from './types'
import { execFile } from 'node:child_process'
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { LedgerError } from '../database'
import { checkInterrupt } from './interrupt'

const execute = promisify(execFile)

async function git(cwd: string, args: string[], signal?: AbortSignal): Promise<string> {
  checkInterrupt(signal)
  try {
    return (await execute('git', args, { cwd, signal })).stdout.trim()
  }
  catch (cause) {
    if (signal?.aborted)
      throw new LedgerError('interrupted_tool', 'Git operation interrupted; workspace requires reconciliation', { cause })
    throw new LedgerError('workspace_conflict', 'Git workspace verification failed', { cause })
  }
}

export async function planWorkspace(root: string, remoteUrl: string, directory: string, identity: Pick<Workspace, 'bindingId' | 'projectId' | 'ticketId' | 'repository'>, signal?: AbortSignal): Promise<Workspace> {
  if (!isAbsolute(root) || !isAbsolute(directory))
    throw new LedgerError('workspace_conflict')
  const canonical = await realpath(root)
  if (await git(root, ['rev-parse', '--show-toplevel'], signal) !== canonical || await git(root, ['remote', 'get-url', 'origin'], signal) !== remoteUrl)
    throw new LedgerError('workspace_conflict')
  return { ...identity, root: canonical, remoteUrl, path: join(directory, identity.bindingId), branch: `nexus/${identity.bindingId}`, baseCommit: await git(root, ['rev-parse', 'HEAD'], signal) }
}

export async function createWorkspace(workspace: Workspace, signal?: AbortSignal): Promise<void> {
  try {
    await lstat(workspace.path)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
    const branches = await git(workspace.root, ['for-each-ref', '--format=%(refname:short)', `refs/heads/${workspace.branch}`], signal)
    if (branches)
      throw new LedgerError('workspace_conflict', 'Branch already exists')
    await mkdir(dirname(workspace.path), { recursive: true })
    await git(workspace.root, ['worktree', 'add', '-b', workspace.branch, workspace.path, workspace.baseCommit], signal)
    const admin = await git(workspace.path, ['rev-parse', '--absolute-git-dir'], signal)
    await writeFile(join(admin, 'nexus-owner.json'), JSON.stringify(workspace), { flag: 'wx' })
    return
  }
  throw new LedgerError('workspace_conflict', 'Workspace path already exists')
}

export async function verifyWorkspace(workspace: Workspace, signal?: AbortSignal): Promise<{ dirty: boolean }> {
  try {
    const root = await realpath(workspace.root)
    const actualPath = await realpath(workspace.path)
    if (await git(root, ['remote', 'get-url', 'origin'], signal) !== workspace.remoteUrl)
      throw new LedgerError('workspace_conflict')
    const registered = (await git(root, ['worktree', 'list', '--porcelain', '-z'], signal)).split('\0\0').find(entry => entry.split('\0').includes(`worktree ${workspace.path}`))
    if (!registered || registered.split('\0').some(field => field === 'locked' || field.startsWith('locked ')))
      throw new LedgerError('workspace_conflict', 'Workspace registration is absent or locked')
    const common = await git(workspace.path, ['rev-parse', '--git-common-dir'], signal)
    const rootCommon = await git(root, ['rev-parse', '--git-common-dir'], signal)
    if (actualPath !== workspace.path || resolve(workspace.path, common) !== resolve(root, rootCommon))
      throw new LedgerError('workspace_conflict')
    if (await git(workspace.path, ['branch', '--show-current'], signal) !== workspace.branch)
      throw new LedgerError('workspace_conflict')
    const admin = await git(workspace.path, ['rev-parse', '--absolute-git-dir'], signal)
    const owner = JSON.parse(await readFile(join(admin, 'nexus-owner.json'), 'utf8')) as Workspace
    for (const key of ['bindingId', 'projectId', 'ticketId', 'repository', 'root', 'remoteUrl', 'path', 'branch', 'baseCommit'] as const) {
      if (owner[key] !== workspace[key])
        throw new LedgerError('workspace_conflict', 'Workspace owner mismatch')
    }
    await git(workspace.path, ['merge-base', '--is-ancestor', workspace.baseCommit, 'HEAD'], signal)
    return { dirty: !!await git(workspace.path, ['status', '--porcelain'], signal) }
  }
  catch (cause) {
    if (cause instanceof LedgerError)
      throw cause
    throw new LedgerError('workspace_conflict', 'Workspace ownership unavailable', { cause })
  }
}
