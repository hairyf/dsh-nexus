/**
 * 渠道读取与回复的执行层。
 *
 * 走 `gh` / `glab` 命令行，**不自己实现 REST 客户端**。理由是身份：
 * 这两个工具的登录态、企业实例地址、代理设置都已经在账号配置里，
 * 自己拼 HTTP 就得把这些再实现一遍，而且 `PATH` 里的 shim 也白设了。
 *
 * 进程调用只出现在 host 半边，符合「Git、文件、进程 API 仅限 Host half」。
 */

import { x } from 'tinyexec'

/** 命令失败。带 stderr 原文，代理能据此判断是权限、网络还是参数问题。 */
export class CliError extends Error {
  constructor(
    readonly command: string,
    readonly detail: string,
    readonly exitCode: number,
  ) {
    super(`${command} 失败（exit ${exitCode}）：${detail.trim().slice(0, 600)}`)
  }
}

interface RunOptions {
  /** 通过 stdin 传 JSON 体，避免把内容塞进 argv（引号、换行、长度都不可控） */
  input?: string
  /** 工作目录；渠道读取不需要，留给将来的仓库内操作 */
  cwd?: string
}

/** 跑一个命令，返回 stdout。非零退出统一抛 `CliError`。 */
async function run(command: string, args: string[], options: RunOptions = {}): Promise<string> {
  const result = await x(command, args, {
    throwOnError: false,
    nodeOptions: {
      cwd: options.cwd,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    },
    // 命令自己会读 stdin，这里把内容交出去
    ...options.input === undefined ? {} : { stdin: options.input },
  })

  const exitCode = result.exitCode ?? 1
  if (exitCode !== 0)
    throw new CliError(`${command} ${args[0] ?? ''}`.trim(), result.stderr, exitCode)
  return result.stdout
}

/** 调 `gh api` 并解析 JSON。 */
export async function ghApi<T = unknown>(resource: string, options: RunOptions = {}): Promise<T> {
  const args = ['api', resource]
  // 有请求体时 gh 需要显式方法
  if (options.input !== undefined)
    args.push('--method', 'POST', '--input', '-')
  const text = await run('gh', args, options)
  return parse<T>(text, `gh api ${resource}`)
}

/** 调 `glab api` 并解析 JSON。 */
export async function glabApi<T = unknown>(resource: string, options: RunOptions = {}): Promise<T> {
  const args = ['api', resource]
  if (options.input !== undefined)
    args.push('--method', 'POST', '--input', '-')
  const text = await run('glab', args, options)
  return parse<T>(text, `glab api ${resource}`)
}

function parse<T>(text: string, what: string): T {
  const trimmed = text.trim()
  if (!trimmed)
    throw new Error(`${what} 返回了空内容`)
  try {
    return JSON.parse(trimmed) as T
  }
  catch {
    throw new Error(`${what} 返回的不是 JSON：${trimmed.slice(0, 200)}`)
  }
}

/** 命令是否存在。`read_channel` 报错前先确认，给出的提示才有意义。 */
export async function hasCommand(command: string): Promise<boolean> {
  try {
    await run(command, ['--version'])
    return true
  }
  catch {
    return false
  }
}
