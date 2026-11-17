import type { Page } from 'playwright'
import type { BrowserCommand } from 'vitest/node'
import type { PanelModel, SourceContext } from '../../src/types/web'
import type { ShellScaffold } from './shell'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from 'playwright/test'
import { launchShell, logs, openShellPage } from './shell'

interface BrowserDshSession {
  scaffold: ShellScaffold
  page?: Page
  errors: () => string[]
}

const sessions = new Map<string, BrowserDshSession>()
export type DshProbe = 'sidebar' | 'tabs' | 'switch' | 'inbox' | 'empty' | 'keyboard' | 'theme' | 'answer' | 'sidechat' | 'hot-reload' | 'read-error'

export const launchDsh: BrowserCommand<[], { baseUrl: string }> = async (context) => {
  if (context.provider.name !== 'playwright')
    throw new Error('DSH browser tests require the Playwright browser provider')
  const existing = sessions.get(context.sessionId)
  if (existing)
    return { baseUrl: existing.scaffold.baseUrl }
  const scaffold = await launchShell()
  sessions.set(context.sessionId, { scaffold, errors: () => [] })
  return { baseUrl: scaffold.baseUrl }
}

export const openDshPage: BrowserCommand<[], { url: string }> = async (context) => {
  const session = sessions.get(context.sessionId)
  if (!session)
    throw new Error('DSH shell must be launched before opening the page')
  const page = await context.context.newPage()
  session.page = page
  session.errors = logs(page).errors
  page.setDefaultTimeout(30_000)
  await openShellPage(page, session.scaffold)
  const welcome = page.getByRole('button', { name: /^(?:继续|Continue)$/u })
  try {
    await expect(page.getByRole('button', { name: 'Nexus', exact: true }).or(welcome).first()).toBeVisible({ timeout: 90_000 })
  }
  catch (cause) {
    const body = await page.locator('body').textContent()
    throw new Error(`DSH shell did not expose Nexus: ${session.errors().join(' | ')}; body=${body?.slice(0, 1000) ?? ''}`, { cause })
  }
  for (const name of [/^(?:继续|Continue)$/u, /^(?:稍后配置|Configure later)$/u]) {
    const button = page.getByRole('button', { name })
    const visible = await button.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, (error: unknown) => {
      if (error instanceof Error && error.name === 'TimeoutError')
        return false
      throw error
    })
    if (visible) {
      await button.click()
      await expect(button).not.toBeVisible()
    }
  }
  await expect(page.getByRole('button', { name: 'Nexus', exact: true })).toBeVisible()
  return { url: page.url() }
}

export const inDsh: BrowserCommand<[DshProbe], { ok: boolean, detail: string }> = async (context, probe) => {
  const session = sessions.get(context.sessionId)
  if (!session?.page)
    throw new Error('DSH shell must be opened before asserting on it')
  const page = session.page
  const entry = page.getByRole('button', { name: 'Nexus', exact: true })
  if (probe === 'sidebar') {
    await expect(entry).toBeVisible()
    return { ok: true, detail: 'Nexus entry is visible in the real shell' }
  }
  const tabs = page.getByRole('tablist', { name: /^(?:面板分区|Panel sections)$/u })
  if (!await tabs.isVisible())
    await entry.click()
  await expect(tabs).toBeVisible({ timeout: 60_000 })
  const names = ['信箱', '概览', '工单', '来源', '渠道', '设置']
  const english = ['Inbox', 'Overview', 'Tickets', 'Sources', 'Channels', 'Settings']
  const labels = await tabs.getByRole('tab').allTextContents()
  const expected = labels[0]?.trim() === 'Inbox' ? english : names
  await expect(tabs.getByRole('tab')).toHaveText(expected)
  const inbox = tabs.getByRole('tab', { name: expected[0], exact: true })
  if (probe === 'tabs')
    return { ok: true, detail: expected.join(', ') }
  if (probe === 'switch') {
    for (const label of expected) {
      const tab = tabs.getByRole('tab', { name: label, exact: true })
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByRole('tabpanel', { name: label, exact: true })).toBeVisible()
    }
    return { ok: true, detail: 'All six Nexus sections select their associated panel' }
  }
  if (probe === 'keyboard') {
    await inbox.click()
    await inbox.focus()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: expected[1], exact: true })).toBeFocused()
    await page.keyboard.press('End')
    await expect(tabs.getByRole('tab', { name: expected[5], exact: true })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(inbox).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(inbox).toHaveAttribute('aria-selected', 'true')
    return { ok: true, detail: 'Arrow, End, Home and Enter keep keyboard navigation usable' }
  }
  await inbox.click()
  const panel = page.getByRole('tabpanel', { name: expected[0], exact: true })
  await expect(panel.getByRole('heading', { name: /本人信箱/u })).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByText('只显示需要本人处理的决定。打开侧聊不会回答问题，也不会解除人工暂停。', { exact: true })).toBeVisible()
  await expect(panel.getByRole('alert')).toHaveCount(0)
  if (probe === 'inbox')
    return { ok: true, detail: 'Inbox read real ledger data without an error state' }
  if (probe === 'read-error') {
    expect(session.scaffold.cookie).not.toBeNull()
    await context.context.clearCookies()
    try {
      await page.getByRole('button', { name: '刷新服务端状态', exact: true }).click()
      const error = panel.getByRole('alert').filter({ hasText: '读取 Nexus 账本失败' })
      await expect(error).toContainText('owner_required')
      await expect(error).toContainText('下方为上次读取结果，答复控件已锁定。')
      await page.screenshot({ path: join(session.scaffold.home, 'artifacts/nexus-read-error.png'), fullPage: true })
    }
    finally {
      await context.context.addCookies([session.scaffold.cookie!])
    }
    await panel.getByRole('button', { name: '重新读取', exact: true }).click()
    await expect(panel.getByRole('alert').filter({ hasText: '读取 Nexus 账本失败' })).toHaveCount(0)
    return { ok: true, detail: 'Actual owner-cookie removal produced a visible 401 read error; restoring it recovered the real ledger view' }
  }
  if (probe === 'answer' || probe === 'sidechat' || probe === 'hot-reload') {
    const read = async (): Promise<PanelModel> => {
      const response = await session.scaffold.api('/api/nexus/panel')
      expect(response.status).toBe(200)
      return response.json() as Promise<PanelModel>
    }
    let snapshot = await read()
    await expect.poll(async () => {
      snapshot = await read()
      return snapshot.run.state
    }, { timeout: 30_000 }).not.toBe('initializing')
    expect(snapshot.run.state, snapshot.run.reason ?? 'Nexus initialization failed').not.toBe('initialization_failed')
    const main = snapshot.graph.nodes.find(node => node.kind === 'main')
    expect(main?.status, snapshot.run.reason ?? 'Main responsibility unavailable').not.toBe('unavailable')
    expect(main).toMatchObject({ kind: 'main', sessionId: expect.any(String) })
    let question = snapshot.inbox.pending.find(ask => ask.source.startsWith('communication:spec06-web-ask-') && ask.initiatorRole === 'main' && ask.presentation.title === 'Spec06真实问答')
    if (!question) {
      const requestId = `spec06-web-ask-${Date.now()}`
      const response = await session.scaffold.api('/api/session/prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: requestId, method: 'session/prompt', payload: { args: { request: { requestId, sessionId: main!.sessionId, mode: 'queue', content: [{ type: 'text', text: `这是隔离真实模型验收。只调用 Nexus ask，requestId=${requestId}，title=Spec06真实问答，question=是否继续这次隔离验收？，options=[继续,停止]，decisionType=ordinary，不关联工单或话题。pending 后停止工作线，不创建工单、代码、分支或外部评论。收到正式答案后只确认，不执行其他动作。实际调用工具，不用文字模拟。` }] } } } }),
      })
      expect(await response.json()).toMatchObject({ result: { ok: true, value: { accepted: true } } })
      try {
        await expect.poll(async () => {
          snapshot = await read()
          question = snapshot.inbox.pending.find(ask => ask.source === `communication:${requestId}`)
          return question?.presentation.title
        }, { timeout: 120_000 }).toBe('Spec06真实问答')
      }
      catch (cause) {
        const response = await session.scaffold.api(`/api/nexus/sessions/${main!.sessionId}/context`)
        const source = await response.json() as SourceContext
        throw new Error(`Real model did not create its ask: ${JSON.stringify({ run: snapshot.run, main: snapshot.graph.nodes.find(node => node.kind === 'main'), source })}`, { cause })
      }
    }
    expect(question).toMatchObject({ handler: 'human', status: 'pending', content: '是否继续这次隔离验收？', options: ['继续', '停止'] })
    await page.getByRole('button', { name: '刷新服务端状态', exact: true }).click()
    const card = panel.getByRole('article', { name: 'Spec06真实问答', exact: true })
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: '打开来源侧聊', exact: true })).toBeEnabled()
    if (probe === 'sidechat' || probe === 'hot-reload') {
      await card.getByRole('button', { name: '打开来源侧聊', exact: true }).click()
      expect(await card.getByRole('alert').allTextContents()).toEqual([])
      const source = page.locator(`[data-sidebar-right-session="${main!.sessionId}"][data-sidebar-right-panel]`)
      await expect(source).toHaveAttribute('data-sidebar-right-open', 'true')
      await expect(source.locator('[data-dsh-native-tab-host] [data-genui-surface="dsh-better-sidebar/sidechat"]')).toBeVisible()
      expect((await read()).inbox.pending.find(ask => ask.id === question!.id)?.status).toBe('pending')
      await mkdir(join(session.scaffold.home, 'artifacts'), { recursive: true })
      await page.screenshot({ path: join(session.scaffold.home, 'artifacts/nexus-sidechat.png'), fullPage: true })
      await entry.click()
      await expect(tabs).toBeVisible()
      if (probe === 'sidechat')
        return { ok: true, detail: `Existing sidechat opened the source session ${main!.sessionId}; ask ${question!.id} stayed pending` }
      const rpc = async <T>(method: string, args: Record<string, unknown>): Promise<T> => {
        const response = await session.scaffold.api(`/api/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: `spec06-reload-${Date.now()}`, method, payload: { args } }) })
        expect(response.status).toBe(200)
        const reply = await response.json() as { result: { ok: boolean, value?: T, error?: unknown } }
        expect(reply.result.ok, JSON.stringify(reply.result.error)).toBe(true)
        return reply.result.value!
      }
      const plugins = await rpc<{ entryId: string, moduleName: string, enabled: boolean, readOnlyReason?: string }[]>('pluginManager/listPlugins', {})
      const plugin = plugins.find(row => row.moduleName === 'dsh-nexus')!
      expect(plugin).toMatchObject({ enabled: true })
      expect(plugin.readOnlyReason).toBeUndefined()
      const disabled = await rpc<{ application: string }>('pluginManager/setPluginEnabled', { id: plugin.entryId, enabled: false })
      expect(disabled.application).toBe('applied')
      expect((await session.scaffold.api('/api/nexus/panel')).status).toBe(404)
      const enabled = await rpc<{ application: string }>('pluginManager/setPluginEnabled', { id: plugin.entryId, enabled: true })
      expect(enabled.application).toBe('applied')
      await expect.poll(async () => {
        snapshot = await read()
        return snapshot.run.state
      }, { timeout: 30_000 }).not.toBe('initializing')
      expect(snapshot.graph.nodes.filter(node => node.kind === 'main')).toHaveLength(1)
      expect(snapshot.graph.nodes.find(node => node.kind === 'main')).toMatchObject({ sessionId: main!.sessionId })
      expect(snapshot.inbox.pending.filter(ask => ask.id === question!.id)).toHaveLength(1)
      expect((await rpc<{ active: boolean }>('session/state', { request: { sessionId: main!.sessionId } })).active).toBe(true)
      await expect(source).toHaveAttribute('data-sidebar-right-open', 'true')
      await expect(source.locator('[data-dsh-native-tab-host] [data-genui-surface="dsh-better-sidebar/sidechat"]')).toBeVisible()
      await entry.click()
      await expect(tabs).toBeVisible()
      await page.getByRole('button', { name: '刷新服务端状态', exact: true }).click()
      await expect(card).toBeVisible()
      await writeFile(join(session.scaffold.home, 'artifacts/nexus-reload.json'), JSON.stringify({ askId: question!.id, sessionId: main!.sessionId, entryId: plugin.entryId, disabled: disabled.application, enabled: enabled.application }))
    }
    await card.getByRole('radio', { name: '继续', exact: true }).check()
    await card.getByRole('button', { name: '提交正式答复', exact: true }).click()
    await expect.poll(async () => (await read()).inbox.resolved.find(ask => ask.id === question!.id)?.answerSource).toBe('web')
    const settled = (await read()).inbox.resolved.find(ask => ask.id === question!.id)!
    expect(settled).toMatchObject({ id: question!.id, status: 'answered', answer: '继续', answerSource: 'web' })
    expect((await read()).inbox.pending.some(ask => ask.id === question!.id)).toBe(false)
    await mkdir(join(session.scaffold.home, 'artifacts'), { recursive: true })
    await writeFile(join(session.scaffold.home, 'artifacts/nexus-ask.json'), JSON.stringify({ askId: settled.id, sessionId: main!.sessionId, source: settled.source, answer: settled.answer, answerSource: settled.answerSource }))
    return { ok: true, detail: `Real model ask ${settled.id} was answered through the real inbox form` }
  }
  if (probe === 'empty') {
    await expect(panel.getByRole('heading', { name: /^本人信箱\s*·\s*0\s*个待答问题$/u })).toBeVisible()
    await expect(panel.getByText('目前没有需要本人回答或处置的事项。', { exact: true })).toBeVisible()
    await panel.getByRole('button', { name: '查看目标与进展', exact: true }).click()
    await expect(tabs.getByRole('tab', { name: expected[1], exact: true })).toHaveAttribute('aria-selected', 'true')
    return { ok: true, detail: 'Empty real inbox offers an actionable overview entry' }
  }
  if (probe === 'theme') {
    const artifacts = join(session.scaffold.home, 'artifacts')
    await mkdir(artifacts, { recursive: true })
    const backgrounds: string[] = []
    try {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme })
        await expect.poll(() => page.locator('body').evaluate(body => body.hasAttribute('data-ds-dark-theme'))).toBe(colorScheme === 'dark')
        backgrounds.push(await panel.evaluate(element => getComputedStyle(element).getPropertyValue('--dsw-alias-bg-layer-1').trim()))
        await expect(panel.getByRole('heading', { name: /本人信箱/u })).toBeVisible()
        await page.screenshot({ path: join(artifacts, `nexus-${colorScheme}.png`), fullPage: true })
      }
      expect(backgrounds[0]).not.toBe('')
      expect(backgrounds[1]).not.toBe(backgrounds[0])
    }
    finally {
      await page.emulateMedia({ colorScheme: null })
    }
    return { ok: true, detail: 'Real system-theme changes resolve distinct Nexus colors in both schemes' }
  }
  throw new Error('Unknown DSH browser probe')
}

export const getDshErrors: BrowserCommand<[], string[]> = async (context) => {
  const session = sessions.get(context.sessionId)
  if (!session?.page)
    throw new Error('Cannot check browser errors before opening the DSH shell')
  return session.errors()
}

export const closeDsh: BrowserCommand<[], void> = async (context) => {
  const session = sessions.get(context.sessionId)
  if (!session)
    return
  sessions.delete(context.sessionId)
  try {
    await session.page?.close()
  }
  finally {
    await session.scaffold.close()
  }
}
