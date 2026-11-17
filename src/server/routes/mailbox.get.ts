import type { H3Event } from 'h3'
import type { MailboxModel } from '../../types/web'
import { getRouterParam } from 'h3'
import { request, text } from '../request'

export function getMailbox(event: H3Event): Promise<MailboxModel> {
  return request(event, panel => panel.mailbox(text(getRouterParam(event, 'id', { decode: true }))))
}
