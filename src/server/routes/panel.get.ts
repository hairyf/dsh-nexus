import type { H3Event } from 'h3'
import type { WebServerOptions } from '../../types/web'
import { request } from '../request'

export function getPanel(event: H3Event): Promise<Awaited<ReturnType<WebServerOptions['panel']['resolve']>>> {
  return request(event, panel => panel.resolve())
}
