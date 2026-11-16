import type { H3Event } from 'h3'
import type { WebServerOptions } from '../../types/web'
import { getRouterParam, HTTPError } from 'h3'
import { input, request, text } from '../request'

export function patchProject(event: H3Event): Promise<Awaited<ReturnType<WebServerOptions['panel']['setProject']>>> {
  return request(event, async (panel, actor) => {
    const body = await input(event, ['enabled'])
    if (typeof body.enabled !== 'boolean')
      throw new HTTPError({ status: 400, message: 'invalid_enabled' })
    return panel.setProject(text(getRouterParam(event, 'id', { decode: true })), body.enabled, actor)
  })
}
