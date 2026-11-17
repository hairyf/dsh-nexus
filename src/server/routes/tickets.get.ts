import type { H3Event } from 'h3'
import type { WebServerOptions } from '../../types/web'
import { getRouterParam } from 'h3'
import { request, text } from '../request'

export function getTicket(event: H3Event): Promise<Awaited<ReturnType<WebServerOptions['panel']['ticket']>>> {
  return request(event, panel => panel.ticket(text(getRouterParam(event, 'id', { decode: true }))))
}
