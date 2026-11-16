import type { H3Event } from 'h3'
import type { MergeTarget } from '../../types/ledger'
import type { WebServerOptions } from '../../types/web'
import { getRouterParam, HTTPError } from 'h3'
import { input, request, text } from '../request'

export function postAnswer(event: H3Event): Promise<Awaited<ReturnType<WebServerOptions['panel']['answer']>>> {
  return request(event, async (panel, actor) => {
    const body = await input(event, ['answer', 'policyBasis', 'selections', 'target'])
    if (body.selections !== undefined && (!Array.isArray(body.selections) || body.selections.some(value => typeof value !== 'string')))
      throw new HTTPError({ status: 400, message: 'invalid_selections' })
    let target: MergeTarget | undefined
    if (body.target !== undefined) {
      if (!body.target || typeof body.target !== 'object' || Array.isArray(body.target))
        throw new HTTPError({ status: 400, message: 'invalid_target' })
      const value = body.target as Record<string, unknown>
      target = { repository: text(value.repository), pullRequest: text(value.pullRequest), head: text(value.head), base: text(value.base) }
    }
    return panel.answer({ askId: text(getRouterParam(event, 'id', { decode: true })), answer: text(body.answer), policyBasis: text(body.policyBasis), selections: body.selections as string[] | undefined, target }, actor)
  })
}
