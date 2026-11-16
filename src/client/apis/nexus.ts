import type { AnswerInput, PolicySnapshot, SettingsPatch } from '../../types/ledger'
import type { PanelModel, SourceContext, TicketDetailModel, WebServerOptions } from '../../types/web'

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/nexus/${path}`, { method, credentials: 'same-origin', headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) })

  const value = await response.json()

  if (!response.ok)
    throw new Error(value.data?.code ?? value.message ?? `HTTP ${response.status}`)

  return value as T
}
export const nexus = {
  read: () => request<PanelModel>('panel'),
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
