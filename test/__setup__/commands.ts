import type { Locator, Page } from 'playwright'
import type { BrowserCommand } from 'vitest/node'
import type { ShellScaffold } from './shell'
import { launchShell, logs } from './shell'
import { exchangeProcessLaunchToken } from './shell.utils'

interface BrowserDshSession {
  scaffold: ShellScaffold
  page?: Page
  errors: () => string[]
}

const sessions = new Map<string, BrowserDshSession>()

/** 断言步骤。spec 只传名字，真正的 DOM 操作在宿主侧做完。 */
export type DshProbe = 'sidebar' | 'tabs' | 'switch'

export const launchDsh: BrowserCommand<[], { baseUrl: string }> = async (context) => {
  if (context.provider.name !== 'playwright')
    throw new Error('DSH browser tests require the Playwright browser provider')

  const existing = sessions.get(context.sessionId)
  if (existing)
    return { baseUrl: existing.scaffold.baseUrl }

  const scaffold = await launchShell()
  sessions.set(context.sessionId, { scaffold, errors: () => [] })

  const exchange = await exchangeProcessLaunchToken(scaffold.baseUrl, scaffold.processLaunchUrl)
  if (exchange)
    await context.context.addCookies([exchange.cookie])

  return { baseUrl: scaffold.baseUrl }
}

/**
 * 在**新标签页**里打开 DSH。
 *
 * 不能导航 `context.page` —— 那是 vitest 运行器所在的页面，离开它就会切断
 * 与测试进程的连接（实测报 `Browser connection was closed`）。
 *
 * 由此带来一个必须知道的后果：spec 里 `import { page } from 'vitest/browser'`
 * 拿到的是**运行器页面**，不是这里开的这一页。所以 DOM 断言不能写在 spec 里，
 * 要走 `inDsh` 在这里执行。模板自带的 smoke 只用返回的 URL，因此没碰到这个问题。
 */
export const openDshPage: BrowserCommand<[], { url: string }> = async (context) => {
  const session = sessions.get(context.sessionId)
  if (!session)
    throw new Error('DSH shell must be launched before opening the page')

  const page = await context.context.newPage()
  const consoleTripwire = logs(page)

  await page.goto(session.scaffold.baseUrl, { waitUntil: 'load' })
  // 等首屏挂完；等到有 button 说明外壳真的渲染了，而不是停在鉴权页
  await page.locator('button').first().waitFor({ timeout: 90_000 }).catch(async (failure) => {
    const seen = await page.evaluate(() => ({
      size: document.body.innerHTML.length,
      text: document.body.textContent?.slice(0, 300) ?? '',
    }))
    throw new Error(
      `${String(failure)}\n页面 ${seen.size}B，正文：${JSON.stringify(seen.text)}\n`
      + `启动 URL：${session.scaffold.processLaunchUrl || '(空)'}`,
    )
  })
  // 「预览版说明」只在首次启动出现，没有就跳过
  await page.getByRole('button', { name: '继续' }).click({ timeout: 5000 }).catch(() => {})

  session.page = page
  session.errors = consoleTripwire.errors
  return { url: page.url() }
}

/**
 * 在 DSH 页面上执行断言。
 *
 * Playwright 的 locator 无法跨进程传给 spec，所以每条断言都在这里跑完，
 * 只把 `{ ok, detail }` 带回去；失败时 `detail` 直接显示在断言消息里。
 */
export const inDsh: BrowserCommand<[DshProbe], { ok: boolean, detail: string }> = async (context, probe) => {
  const session = sessions.get(context.sessionId)
  const page = session?.page
  if (!page)
    throw new Error('DSH shell must be opened before asserting on it')

  if (probe === 'sidebar') {
    const names = await page.getByRole('button').evaluateAll(buttons =>
      buttons.map(button => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''))
    const found = names.includes('Nexus')
    return {
      ok: found,
      detail: found ? 'Nexus' : `没有 Nexus 入口；现有按钮：${names.slice(0, 10).join(' | ') || '(一个都没有)'}`,
    }
  }

  // 进面板。
  //
  // **只在还没进去时点。** 多个 probe 会各自调用一次，第二次点击时面板已经
  // 铺开、把侧边栏那条遮住了 —— Playwright 的 click 会一直等「可点击」，
  // 直到 30s 超时。已经进来就直接用现有的 Tab。
  if (await page.getByRole('tab').count() === 0) {
    await page.getByRole('button', { name: 'Nexus', exact: true }).click()
    await page.getByRole('tab').first().waitFor({ timeout: 30_000 })
  }
  const tabs = await page.getByRole('tab').evaluateAll(items => items.map(item => item.textContent?.trim() ?? ''))

  if (probe === 'tabs') {
    return { ok: tabs.length >= 5, detail: tabs.slice(0, 5).join(',') }
  }

  // 逐个切换，每次都确认进入选中态
  const selected: string[] = []
  for (const name of tabs.slice(0, 5)) {
    const tab: Locator = page.getByRole('tab', { name, exact: true }).last()
    await tab.click()
    await page.waitForTimeout(150)
    if (await tab.getAttribute('aria-selected') === 'true')
      selected.push(name)
  }
  return { ok: selected.length === Math.min(tabs.length, 5) && selected.length > 0, detail: selected.join(',') }
}

export const getDshErrors: BrowserCommand<[], string[]> = async (context) => {
  const session = sessions.get(context.sessionId)
  if (!session?.page)
    return []
  return session.errors()
}

export const closeDsh: BrowserCommand<[], void> = async (context) => {
  const session = sessions.get(context.sessionId)
  if (!session)
    return

  sessions.delete(context.sessionId)
  await session.page?.close()
  await session.scaffold.close()
}
