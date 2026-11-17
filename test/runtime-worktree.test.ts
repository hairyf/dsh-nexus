import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createWorkspace, planWorkspace, verifyWorkspace } from '../src/runtime/worktree'

const execute = promisify(execFile)
let directory: string
let root: string
beforeEach(async () => {
  directory = join(import.meta.dirname, '../.temp', `workspace-${randomUUID()}`)
  root = join(directory, 'repository')
  await mkdir(root, { recursive: true })
  await execute('git', ['init', '-b', 'main'], { cwd: root })
  await execute('git', ['config', 'user.name', 'Nexus Test'], { cwd: root })
  await execute('git', ['config', 'user.email', 'nexus@example.invalid'], { cwd: root })
  await execute('git', ['commit', '--allow-empty', '-m', 'fixture'], { cwd: root })
  await execute('git', ['remote', 'add', 'origin', 'https://github.com/org/repository.git'], { cwd: root })
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

async function plan(id: string) {
  return planWorkspace(root, 'https://github.com/org/repository.git', join(directory, 'worktrees'), { bindingId: id, ticketId: id, projectId: 'project', repository: 'github.com/org/repository' })
}

it('creates separate owned branches and refuses to reuse a preexisting dirty worktree', async () => {
  const first = await plan('execution-one')
  const second = await plan('execution-two')
  await createWorkspace(first)
  await createWorkspace(second)
  await writeFile(join(first.path, 'unfinished.txt'), 'preserve this work')
  expect(await verifyWorkspace(first)).toEqual({ dirty: true })
  expect(await verifyWorkspace(second)).toEqual({ dirty: false })
  await expect(createWorkspace(first)).rejects.toMatchObject({ code: 'workspace_conflict' })
  expect(await readFile(join(first.path, 'unfinished.txt'), 'utf8')).toBe('preserve this work')
  expect(first.branch).not.toBe(second.branch)
  expect(first.path).not.toBe(second.path)
})

it('rejects a tampered owner marker without resetting historical changes', async () => {
  const workspace = await plan('execution')
  await createWorkspace(workspace)
  await writeFile(join(workspace.path, 'unfinished.txt'), 'retained')
  const admin = (await execute('git', ['rev-parse', '--absolute-git-dir'], { cwd: workspace.path })).stdout.trim()
  await writeFile(join(admin, 'nexus-owner.json'), JSON.stringify({ ...workspace, ticketId: 'foreign-ticket' }))
  await expect(verifyWorkspace(workspace)).rejects.toMatchObject({ code: 'workspace_conflict' })
  expect(await readFile(join(workspace.path, 'unfinished.txt'), 'utf8')).toBe('retained')
})

it('refuses a locked worktree even when its branch and ownership marker match', async () => {
  const workspace = await plan('execution')
  await createWorkspace(workspace)
  await execute('git', ['worktree', 'lock', workspace.path], { cwd: root })
  await expect(verifyWorkspace(workspace)).rejects.toMatchObject({ code: 'workspace_conflict' })
})
