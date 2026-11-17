import type { ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import { usePanel } from '../../hooks/use-panel'
import { useActions } from '../../hooks/use-store'

export function Trigger(): ReactNode {
  const { data } = usePanel()

  const { openThread } = useActions()

  const [query, setQuery] = useState('')

  const [kind, setKind] = useState('')

  const [triage, setTriage] = useState('')

  const topics = data.topics.threads.filter(thread => (!kind || thread.kind === kind) && (!triage || thread.triage === triage) && [thread.title, thread.repository, thread.refId].join(' ').toLowerCase().includes(query.toLowerCase()))

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="m-0 text-base font-medium">来源话题与触发</h2>
      <p className="m-0 text-xs text-[var(--dsw-alias-label-secondary)]">
        已登记
        {data.topics.threads.length}
        {' '}
        个话题 ·
        {data.topics.triggers.length}
        {' '}
        条触发 ·
        {data.topics.subscriptions.length}
        {' '}
        个工单订阅。收到事件不等于已派工。
      </p>
      <div className="flex flex-wrap gap-3">
        <label>
          搜索
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1" />
        </label>
        <label>
          话题类型
          <select value={kind} onChange={event => setKind(event.target.value)} className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1">
            <option value="">全部</option>
            {['issue', 'pull', 'ci', 'chat'].map(kind => <option value={kind} key={kind}>{kind}</option>)}
          </select>
        </label>
        <label>
          分诊
          <select value={triage} onChange={event => setTriage(event.target.value)} className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1">
            <option value="">全部</option>
            {['pending', 'claimed', 'ignored'].map(value => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      {topics.map(thread => (
        <article key={thread.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--dsw-alias-border-l3)] px-4 py-3">
          <Button size="sm" variant="ghost" onClick={() => openThread(thread.id)}>{thread.title}</Button>
          <Tag tone="quiet">
            {thread.kind}
            {' '}
            ·
            {' '}
            {thread.triage}
          </Tag>
          <span className="break-all text-xs text-[var(--dsw-alias-label-secondary)]">
            {thread.repository ?? thread.attentionReason ?? '仓库尚未核验'}
            {' '}
            ·
            {' '}
            {data.topics.triggers.filter(trigger => trigger.threadId === thread.id).length}
            {' '}
            条事件 ·
            {' '}
            {data.topics.subscriptions.filter(link => link.threadId === thread.id).length}
            {' '}
            个订阅
          </span>
        </article>
      ))}
      {!data.topics.threads.length
        ? <p>尚未登记来源话题。请检查已启用项目的 GitHub 环境与采集状态。</p>
        : !topics.length && (
            <div>
              <p>没有匹配话题，来源记录仍保留。</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setKind('')
                  setTriage('')
                }}
              >
                清除筛选
              </Button>
            </div>
          )}
    </section>
  )
}
