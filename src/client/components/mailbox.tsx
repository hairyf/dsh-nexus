import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ReactNode } from 'react'
import type { MailboxModel } from '../../types/web'
import { Button, IconChecklistOutlineRegular, IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, Modal, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { useAsync, useEventListener, useIntervalFn } from '@reause/core'
import { useId, useRef, useState } from 'react'
import { nexus } from '../apis/nexus'

type MailboxProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'dshNexus'>

export function Mailbox(props: MailboxProps): ReactNode {
  return <SessionMailbox key={props.sessionId} {...props} />
}

function SessionMailbox({ sessionId, useSession, t }: MailboxProps): ReactNode {
  const running = useSession(session => session.running)
  const [revision, setRevision] = useState(0)
  const [collapsed, setCollapsed] = useState(true)
  const [selected, setSelected] = useState<MailboxModel['messages'][number] | null>(null)
  const lastModel = useRef<MailboxModel | null>(null)
  const pending = useRef<AbortController | null>(null)
  const listId = useId()
  const refresh = (): void => setRevision(value => value + 1)
  const result = useAsync(async (onCancel) => {
    const abort = new AbortController()
    pending.current = abort
    onCancel(() => abort.abort())
    try {
      const model = await nexus.mailbox(sessionId, abort.signal)
      if (!abort.signal.aborted)
        lastModel.current = model
      return { model, error: '' }
    }
    catch (error) {
      return { model: lastModel.current, error: error instanceof Error ? error.message : String(error) }
    }
    finally {
      if (pending.current === abort)
        pending.current = null
    }
  }, { model: null, error: '' } as { model: MailboxModel | null, error: string }, { deps: [sessionId, running, revision] })

  useEventListener('online', refresh)
  useEventListener('focus', refresh)
  useIntervalFn(() => {
    if (document.visibilityState === 'visible' && !pending.current && (result.model?.active || result.error))
      refresh()
  }, 5000)

  if (!result.model?.active || (!result.error && result.model.pendingCount === 0 && !selected))
    return null

  return (
    <section className="nexus-mailbox-root" data-testid="agent-mailbox" aria-label={t('mailboxTitle')}>
      <div className="nexus-mailbox-body">
        <button type="button" className="nexus-mailbox-header" aria-expanded={!collapsed} aria-controls={listId} onClick={() => setCollapsed(value => !value)}>
          <span className="nexus-mailbox-lead" aria-hidden="true"><IconChecklistOutlineRegular /></span>
          <span className="nexus-mailbox-title">{t('mailboxTitle')}</span>
          <span className="nexus-mailbox-progress">{result.error ? t('mailboxReadFailed') : t('mailboxPending', { count: result.model!.pendingCount })}</span>
          <span className="nexus-mailbox-chevron" aria-hidden="true">{collapsed ? <IconChevronUpOutlineRegular /> : <IconChevronDownOutlineRegular />}</span>
        </button>
        {result.error && (
          <div role="alert" className="nexus-mailbox-letter">
            {result.error}
            <Button type="button" size="sm" variant="ghost" onClick={refresh}>{t('mailboxRetry')}</Button>
          </div>
        )}
        {!collapsed && result.model?.active && (
          <ul id={listId} className="nexus-mailbox-list">
            {result.model.messages.map(message => (
              <li key={message.id} className="nexus-mailbox-item">
                <button type="button" className="nexus-mailbox-message" onClick={() => setSelected(message)} aria-label={t('mailboxOpen', { sender: message.sender, content: (message.title || message.content).slice(0, 80) })}>
                  <span className="nexus-mailbox-glyph" role="img" aria-label={t('mailboxUnhandled')}><StateDot state="idle" /></span>
                  <span className="nexus-mailbox-content">
                    {message.sender}
                    {' '}
                    ·
                    {' '}
                    {message.content}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal open={selected !== null} title={t('mailboxTitle')} description={selected ? `${selected.sender} · ${new Date(selected.acceptedAt).toLocaleString()}` : undefined} closeLabel={t('mailboxClose')} onClose={() => setSelected(null)}>
        <div className="nexus-mailbox-letter">{selected?.content}</div>
        {selected && !result.model.messages.some(message => message.id === selected.id) && <p role="status" className="nexus-mailbox-letter">{t('mailboxNoLongerPending')}</p>}
        <p className="nexus-mailbox-letter">{t('mailboxReadOnly')}</p>
      </Modal>
    </section>
  )
}
