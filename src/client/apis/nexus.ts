import type { AnswerInput, PolicySnapshot, SettingsPatch } from '../../types/ledger'
import type { MailboxModel, PanelModel, SourceContext, TicketDetailModel, WebServerOptions } from '../../types/web'

export async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch('api/nexus/dispatch', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, method, body }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) })

  const text = await response.text()
  let value: { data?: { code?: string }, message?: string } | null = null

  try {
    value = JSON.parse(text)
  }
  catch {
    if (response.ok)
      throw new Error('Nexus 服务返回了无效数据，请重试并检查宿主插件状态。')
  }

  if (!response.ok) {
    if (response.status === 404 && !value?.data?.code && !value?.message)
      throw new Error('Nexus 服务接口未就绪（HTTP 404），请确认宿主插件已启用并完成初始化。')
    throw new Error(value?.data?.code ?? value?.message ?? `HTTP ${response.status}`)
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Nexus 服务返回了无效数据，请重试并检查宿主插件状态。')

  return value as T
}
export const nexus = {
  read: () => request<PanelModel>('panel'),
  mailbox: (id: string, signal?: AbortSignal) => request<MailboxModel>(`sessions/${encodeURIComponent(id)}/mailbox`, 'GET', undefined, signal),
  ticket: (id: string) => request<TicketDetailModel>(`tickets/${encodeURIComponent(id)}`),
  context: (id: string) => request<SourceContext>(`sessions/${encodeURIComponent(id)}/context`),
  answer: (input: AnswerInput) => {
    const { askId, ...body } = input

    return request<{
      result: {
        accepted: boolean
        reason?: string
      }
      ask: PanelModel['inbox']['pending'][number]
    }>(`asks/${encodeURIComponent(askId)}/answers`, 'POST', body)
  },
  command: (id: string, action: string, reason: string) => request<Awaited<ReturnType<WebServerOptions['panel']['command']>>>(`tickets/${encodeURIComponent(id)}/${action}`, 'POST', { reason }),
  policy: (id: string, policy: PolicySnapshot, reason: string) => request(`tickets/${encodeURIComponent(id)}`, 'PATCH', { ...policy, reason }),
  settings: (patch: SettingsPatch) => request('settings', 'PATCH', patch),
  project: (id: string, enabled: boolean) => request<Awaited<ReturnType<WebServerOptions['panel']['setProject']>>>(`projects/${encodeURIComponent(id)}`, 'PATCH', { enabled }),
  refreshProjects: () => request('projects/refresh', 'POST', {}),
}
