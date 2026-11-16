import type { H3Event } from 'h3'
import type { WebServerOptions } from '../../types/web'
import { getRouterParam } from 'h3'
import { request, text } from '../request'

export function getContext(event: H3Event): Promise<Awaited<ReturnType<WebServerOptions['panel']['context']>>> {
  return request(event, panel => panel.context(text(getRouterParam(event, 'id', { decode: true }))))
}
