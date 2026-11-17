import type { NexusDatabase } from '../database'
import type { Row } from '../types/ledger'
import { LedgerError, requireDatabase } from '../database'
import { defineService } from '../utils/service'

export const mailbox = defineService({
  list(database: NexusDatabase, recipient: string, pendingOnly = true): Row<'inbox'>[] {
    return requireDatabase(database).prepare('SELECT * FROM inbox WHERE recipient = ? AND (? = 0 OR (handledAt IS NULL AND supersededAt IS NULL)) ORDER BY seq').all(recipient, Number(pendingOnly)) as unknown as Row<'inbox'>[]
  },
  load(database: NexusDatabase, id: string): Row<'inbox'> | null {
    return requireDatabase(database).prepare('SELECT * FROM inbox WHERE id = ?').get(id) as unknown as Row<'inbox'> ?? null
  },
  save(database: NexusDatabase, input: Pick<Row<'inbox'>, 'id' | 'recipient' | 'sender' | 'kind' | 'content'> & Partial<Pick<Row<'inbox'>, 'title' | 'askId'>>): Row<'inbox'> {
    if (!input.id.trim() || !input.recipient.trim() || !input.sender.trim() || !input.kind.trim() || !input.content.trim())
      throw new LedgerError('invalid_mail')
    const existing = mailbox.load(database, input.id)
    if (existing) {
      if (existing.recipient !== input.recipient || existing.sender !== input.sender || existing.kind !== input.kind || existing.content !== input.content || existing.title !== (input.title ?? null) || existing.askId !== (input.askId ?? null))
        throw new LedgerError('identity_conflict')
      return existing
    }
    requireDatabase(database).prepare('INSERT INTO inbox (id, seq, recipient, sender, kind, title, content, askId, acceptedAt) VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM inbox), ?, ?, ?, ?, ?, ?, ?)').run(input.id, input.recipient, input.sender, input.kind, input.title ?? null, input.content, input.askId ?? null, new Date().toISOString())
    return mailbox.load(database, input.id)!
  },
  read(database: NexusDatabase, recipient: string, id?: string): Row<'inbox'>[] {
    requireDatabase(database).prepare('UPDATE inbox SET readAt = COALESCE(readAt, ?) WHERE recipient = ? AND (? IS NULL OR id = ?) AND handledAt IS NULL AND supersededAt IS NULL').run(new Date().toISOString(), recipient, id ?? null, id ?? null)
    return mailbox.list(database, recipient)
  },
  handle(database: NexusDatabase, recipient: string, id: string): Row<'inbox'> {
    const message = mailbox.load(database, id)
    if (!message || message.recipient !== recipient || message.supersededAt)
      throw new LedgerError('scope_denied')
    if (!message.readAt)
      throw new LedgerError('not_read')
    requireDatabase(database).prepare('UPDATE inbox SET handledAt = COALESCE(handledAt, ?) WHERE id = ?').run(new Date().toISOString(), id)
    return mailbox.load(database, id)!
  },
  notify(database: NexusDatabase, recipient: string, through: number): void {
    requireDatabase(database).prepare('UPDATE inbox SET notifiedAt = COALESCE(notifiedAt, ?) WHERE recipient = ? AND seq <= ? AND handledAt IS NULL AND supersededAt IS NULL').run(new Date().toISOString(), recipient, through)
  },
})
