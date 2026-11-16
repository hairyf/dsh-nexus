import type { ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { SourceLink } from '../../../components/source-link'
import { usePanel } from '../../../hooks/use-panel'
import { useActions, useStore } from '../../../hooks/use-store'

export function TriggerDetail(): ReactNode {
  const { data } = usePanel()

  const { go, openTicket } = useActions()

  const id = useStore(state => state.trigger.selectedId)

  const thread = data.topics.threads.find(thread => thread.id === id)

  const events = data.topics.triggers.filter(trigger => trigger.threadId === id).sort((a, b) => b.at.localeCompare(a.at))

  const subscriptions = data.topics.subscriptions.filter(link => link.threadId === id)

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div><Button size="sm" variant="ghost" onClick={() => go('trigger')}>返回来源话题</Button></div>
      {thread
        ? (
            <>
              <header>
                <h2 className="m-0 text-lg font-medium">{thread.title}</h2>
                <p className="text-xs">
                  <SourceLink href={thread.url}>{thread.refId}</SourceLink>
                  {' '}
                  ·
                  {' '}
                  {thread.repository}
                  {' '}
                  ·
                  {' '}
                  <Tag tone="quiet">{thread.triage}</Tag>
                </p>
              </header>
              <div className="flex flex-wrap gap-2">
                {subscriptions.map(link => <Button key={link.ticketId} size="sm" variant="outline" onClick={() => openTicket(link.ticketId)}>{link.ticketId}</Button>)}
                {!subscriptions.length && <p className="text-xs">尚无订阅工单。</p>}
              </div>
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {events.map(event => (
                  <li key={event.id} className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-4">
                    <header className="flex flex-wrap gap-2 text-xs text-[var(--dsw-alias-label-secondary)]">
                      <span>{event.actorLogin ?? event.actorName ?? '未知作者'}</span>
                      <span>
                        {event.kind}
                        {' '}
                        ·
                        {' '}
                        {event.at}
                      </span>
                      <span>
                        {event.human ? '已核验人类来源' : '非人工授权来源'}
                        {' '}
                        ·
                        {' '}
                        {event.mentioned ? '提及 Nexus' : '未提及'}
                      </span>
                    </header>
                    <p className="whitespace-pre-wrap break-words">{event.text}</p>
                    <SourceLink href={event.url}>打开原始事件</SourceLink>
                  </li>
                ))}
              </ol>
              {!events.length && <p>话题已登记，但尚无触发事件。</p>}
            </>
          )
        : <p>来源话题不存在，请返回列表刷新。</p>}
    </section>
  )
}
