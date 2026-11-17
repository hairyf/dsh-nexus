import type { H3Event } from 'h3'
import type { Row } from '../../types/ledger'
import { getRouterParam } from 'h3'
import { request, text } from '../request'

export function handleMail(event: H3Event): Promise<Row<'inbox'>> {
  return request(event, panel => panel.handleMail(text(getRouterParam(event, 'id', { decode: true })), text(getRouterParam(event, 'messageId', { decode: true }))))
}
