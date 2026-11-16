import type { H3Event } from 'h3'
import type { WebServerOptions } from '../../types/web'
import { getRouterParam, HTTPError } from 'h3'
import { input, request, text } from '../request'

export function postTicket(event: H3Event): Promise<Awaited<ReturnType<WebServerOptions['panel']['command']>>> {
  return request(event, async (panel, actor) => {
    const action = getRouterParam(event, 'action')
    if (action !== 'pause' && action !== 'resume' && action !== 'cancel' && action !== 'retry' && action !== 'dispatch')
      throw new HTTPError({ status: 404, message: 'unknown_command' })
    const body = await input(event, ['reason'])
    return panel.command(text(getRouterParam(event, 'id', { decode: true })), action, text(body.reason), actor)
  })
}
