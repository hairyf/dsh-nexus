import type { H3Event } from 'h3'
import type { WebServerOptions } from '../../types/web'
import { input, request } from '../request'

export function refreshProjects(event: H3Event): Promise<Awaited<ReturnType<WebServerOptions['panel']['refreshProjects']>>> {
  return request(event, async (panel) => {
    await input(event, [])
    return panel.refreshProjects()
  })
}
