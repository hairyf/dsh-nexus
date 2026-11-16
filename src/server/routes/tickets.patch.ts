import type { H3Event } from 'h3'
import type { PolicySnapshot } from '../../types/ledger'
import type { WebServerOptions } from '../../types/web'
import { getRouterParam } from 'h3'
import { input, request, text } from '../request'

export function patchTicket(event: H3Event): Promise<Awaited<ReturnType<WebServerOptions['panel']['setPolicy']>>> {
  return request(event, async (panel, actor) => {
    const body = await input(event, ['questionLevel', 'mergePolicy', 'reason'])
    const snapshot = { questionLevel: text(body.questionLevel), mergePolicy: text(body.mergePolicy) } as PolicySnapshot
    return panel.setPolicy(text(getRouterParam(event, 'id', { decode: true })), snapshot, text(body.reason), actor)
  })
}
