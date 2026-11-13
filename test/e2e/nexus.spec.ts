import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'

declare module 'vitest/browser' {
  interface BrowserCommands {
    launchDsh: () => Promise<{ baseUrl: string }>
    openDshPage: () => Promise<{ url: string }>
    /**
     * 在 DSH 页面上执行一段断言。
     *
     * DSH 开在另一个标签页里（vitest 运行器所在页面不能导航，否则会切断连接），
     * 而 `import { page } from 'vitest/browser'` 拿到的是运行器页面 —— 所以
     * DOM 断言必须由命令在宿主侧执行，spec 只对返回的结论做断言。
     */
    inDsh: (probe: 'sidebar' | 'tabs' | 'switch') => Promise<{ ok: boolean, detail: string }>
    getDshErrors: () => Promise<string[]>
    closeDsh: () => Promise<void>
  }
}

/**
 * 真实外壳的端到端测试。
 *
 * **所有用例放在同一个 `describe` 里**：外壳启动包含 build → pack → 装插件
 * （十几秒），而 `launchShell` 每次都会重写同一个 `~/.dsh/profiles/web`。
 * 拆成多个文件时 vitest 各跑一份，第二个文件会和第一个留下的进程争端口、
 * 并覆盖同一个 profile，表现是「单独跑绿、一起跑红」。
 *
 * 一个文件、一次启动、共用同一个会话。
 */
describe('nexus panel', () => {
  let url = ''

  beforeAll(async () => {
    await commands.launchDsh()
    url = (await commands.openDshPage()).url
  })

  afterAll(async () => {
    await commands.closeDsh()
  })

  it('opens the authenticated shell', async () => {
    const parsed = new URL(url)
    expect(parsed.protocol).toMatch(/^https?:$/u)
    expect(parsed.pathname).toBe('/')
    expect(await commands.getDshErrors()).toEqual([])
  })

  it('mounts the Nexus entry in the sidebar', async () => {
    const result = await commands.inDsh('sidebar')
    expect(result.ok, result.detail).toBe(true)
  })

  it('renders all five tabs', async () => {
    const result = await commands.inDsh('tabs')
    expect(result.ok, `实际 Tab：${result.detail}`).toBe(true)
    expect(result.detail.split(',')).toEqual(['概览', '任务', '触发', '渠道', '设置'])
  })

  it('switches every tab without errors', async () => {
    const result = await commands.inDsh('switch')
    expect(result.ok, `选中失败的 Tab：${result.detail}`).toBe(true)
    expect(await commands.getDshErrors()).toEqual([])
  })
})
