import type { ReactNode } from 'react'
import type { InboxAsk } from '../../../types/web'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useRef, useState } from 'react'
import { nexus } from '../../apis/nexus'
import { SourceLink } from '../../components/source-link'
import { SourceSession } from '../../components/source-session'
import { usePanel } from '../../hooks/use-panel'
import { useActions, useStore } from '../../hooks/use-store'

export function AskCard({ ask: initial, onSettled }: {
  ask: InboxAsk
  onSettled?: () => void
}): ReactNode {
  const { refresh } = usePanel()

  const { openTicket } = useActions()

  const read = useStore(state => state.read.state)

  const [receipt, setReceipt] = useState<InboxAsk | null>(null)

  const ask = receipt ?? initial

  const [answer, setAnswer] = useState('')

  const [selections, setSelections] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')

  const lock = useRef(false)

  const form = useRef<HTMLFormElement>(null)

  async function submit(): Promise<void> {
    if (lock.current)
      return

    lock.current = true

    setSubmitting(true)

    setError('')

    try {
      const result = await nexus.answer({ askId: ask.id, policyBasis: ask.policyBasis, target: ask.target ?? undefined, answer: answer.trim() || selections.join(', '), selections: ask.presentation.multiSelect ? selections : undefined })

      setReceipt(result.ask)

      await refresh()

      onSettled?.()
    }
    catch (error) {
      setError(`未能确认正式答复结果：${error instanceof Error ? error.message : String(error)}。输入已保留，请刷新核对当前问题后重试。`)

      await refresh()

      form.current?.querySelector<HTMLElement>('input, textarea, button')?.focus()
    }
    finally {
      lock.current = false

      setSubmitting(false)
    }
  }

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-4" aria-label={ask.presentation.title ?? ask.content}>
      <header className="flex flex-wrap items-center gap-2">
        <Tag tone={ask.status === 'pending' ? 'warning' : ask.status === 'answered' ? 'success' : 'quiet'}>{ask.status === 'pending' ? ask.actionable ? '等本人答复' : '提醒本人处置' : ask.status === 'answered' ? '已正式回答' : '已撤销'}</Tag>
        {ask.humanRequired && <Tag tone="warning">必须本人决定</Tag>}
        <span className="text-xs text-[var(--dsw-alias-label-secondary)]">
          {ask.waiting?.role ?? ask.initiatorRole}
          {' '}
          等待 ·
          {' '}
          {Math.floor(ask.waitingMilliseconds / 60000)}
          {' '}
          分钟 ·
          {' '}
          {ask.decisionType}
        </span>
      </header>
      <h3 className="m-0 break-words text-sm font-medium">{ask.presentation.title ?? ask.content}</h3>
      {ask.presentation.title && <p className="m-0 whitespace-pre-wrap break-words">{ask.content}</p>}
      {ask.presentation.detail && <p className="m-0 whitespace-pre-wrap text-xs text-[var(--dsw-alias-label-secondary)]">{ask.presentation.detail}</p>}
      <div className="flex flex-wrap gap-2">
        {ask.ticketIds.map(id => <Button size="sm" variant="ghost" key={id} onClick={() => openTicket(id)}>{id}</Button>)}
        <span className="break-all text-xs text-[var(--dsw-alias-label-tertiary)]">
          来源：
          {ask.source}
          {' '}
          ·
          {ask.createdAt}
        </span>
      </div>
      {ask.target && (
        <div className="rounded-lg border border-[var(--dsw-alias-border-l3)] p-3 text-xs">
          <SourceLink href={ask.target.pullRequest}>{ask.target.pullRequest}</SourceLink>
          <p className="mb-0 break-all font-mono">
            {ask.target.repository}
            {' '}
            · base
            {' '}
            {ask.target.base}
            {' '}
            · head
            {' '}
            {ask.target.head}
          </p>
          {ask.evidence.map(evidence => (
            <p className="mb-0" key={evidence.id}>
              验收
              {evidence.verdict}
              {' '}
              ·
              {evidence.scope}
              {' '}
              ·
              {evidence.basis}
              {' '}
              ·
              {evidence.evidence}
              {' '}
              ·
              {evidence.createdAt}
            </p>
          ))}
        </div>
      )}
      {ask.reminders.map(reminder => (
        <p key={reminder.id} className="m-0 text-xs text-[var(--dsw-alias-state-warn-primary)]">
          {reminder.due ? '提醒已到期' : `等待截止 ${reminder.dueAt}`}
          {' '}
          ·
          {' '}
          {reminder.remindedAt ? `已提醒 ${reminder.remindedAt}` : '尚未提醒'}
          {' '}
          ·
          {' '}
          {reminder.deliveryState}
          {reminder.deliveryError && `：${reminder.deliveryError}`}
        </p>
      ))}
      {ask.waiting ? <SourceSession key={ask.waiting.sessionId} sessionId={ask.waiting.sessionId} /> : <p className="m-0 text-xs">来源会话尚未恢复；已记录问题仍可正式回答。请按来源记录查找原会话。</p>}
      {ask.status === 'pending' && ask.actionable
        ? (
            <form
              ref={form}
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
              className="flex flex-col gap-3"
            >
              <fieldset disabled={submitting || read !== 'ready'} className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 text-xs">
                  请选择选项或填写正式答复
                  {ask.presentation.multiSelect ? '（可多选）' : ''}
                </legend>
                {ask.options.map(option => (
                  <label className="flex cursor-pointer items-center gap-2 py-1" key={option}>
                    <input type={ask.presentation.multiSelect ? 'checkbox' : 'radio'} name={ask.id} value={option} checked={ask.presentation.multiSelect ? selections.includes(option) : answer === option} onChange={event => ask.presentation.multiSelect ? setSelections(previous => event.target.checked ? [...previous, option] : previous.filter(value => value !== option)) : setAnswer(option)} />
                    {option}
                  </label>
                ))}
                {!['merge', 'delivery'].includes(ask.decisionType) && (
                  <label className="flex flex-col gap-1">
                    正式答复
                    <textarea value={answer} onChange={event => setAnswer(event.target.value)} rows={2} className="w-full rounded-lg border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2 text-[var(--dsw-alias-label-primary)]" />
                  </label>
                )}
                <Button type="submit" size="sm" variant="outline" disabled={(!answer.trim() && !selections.length) || (!!ask.presentation.multiSelect && !selections.length)}>{submitting ? '正在提交正式答复…' : '提交正式答复'}</Button>
              </fieldset>
              {read !== 'ready' && <p role="status" className="m-0 text-xs">正在核对或读取失败，暂不接受新的答复；请刷新后重试。</p>}
              {error && <p role="alert" className="m-0 text-xs text-[var(--dsw-alias-state-error-primary)]">{error}</p>}
            </form>
          )
        : <p role="status" className="m-0 whitespace-pre-wrap break-words">{ask.status === 'answered' ? `生效答案：${ask.answer} · 实际来源：${ask.answerSource} · ${ask.answeredAt}` : ask.status === 'pending' ? `当前处理责任：${ask.handler}，提醒需要协调，不重复创建答复卡。` : `不可再答复：${ask.cancelReason}`}</p>}
      {ask.deliveries.map(message => (
        <p className="m-0 text-xs text-[var(--dsw-alias-label-secondary)]" key={message.id}>
          {message.kind === 'answer' ? '正式答案回送' : '问题投递'}
          ：
          {message.state}
          {' '}
          ·
          {' '}
          {message.recipient}
          {message.error && ` · ${message.error}`}
        </p>
      ))}
      {ask.publications.map(publication => (
        <p className="m-0 text-xs" key={publication.id}>
          {publication.syncProblem || publication.state === 'failed' || publication.state === 'unknown' ? 'GitHub 同步问题（无需重答）' : 'GitHub 投递'}
          ：
          {publication.state}
          {' '}
          ·
          {' '}
          {publication.syncProblem ?? publication.error}
          {publication.syncAt}
          <SourceLink href={publication.remoteUrl}>{publication.remoteId}</SourceLink>
        </p>
      ))}
    </article>
  )
}
export function Inbox(): ReactNode {
  const { data } = usePanel()

  const { openTicket, go } = useActions()

  const heading = useRef<HTMLHeadingElement>(null)

  const inbox = data.inbox
  const [showResolved, setShowResolved] = useState(false)
  const syncProblems = inbox.resolved.filter(ask => ask.publications.some(item => item.syncProblem || item.state === 'failed' || item.state === 'unknown'))

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 ref={heading} tabIndex={-1} className="m-0 text-base font-medium">
        本人信箱 ·
        {inbox.pending.length}
        {' '}
        个待答问题
      </h2>
      <p className="m-0 text-xs text-[var(--dsw-alias-label-secondary)]">只显示需要本人处理的决定。打开侧聊不会回答问题，也不会解除人工暂停。</p>
      {!inbox.pending.length && !inbox.blocked.length && !inbox.reminders.length && (
        <div className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-5">
          <p className="mt-0">目前没有需要本人回答或处置的事项。</p>
          <Button size="sm" variant="outline" onClick={() => go('overview')}>查看目标与进展</Button>
        </div>
      )}
      {inbox.pending.map(ask => <AskCard key={ask.id} ask={ask} onSettled={() => heading.current?.focus()} />)}
      {inbox.blocked.map(item => (
        <article key={item.ticket.id} className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-4">
          <h3 className="m-0 text-sm">
            人工暂停 ·
            {item.ticket.title}
          </h3>
          <p className="text-xs">
            {item.reason}
            {' '}
            ·
            {' '}
            {item.since}
            {' '}
            · 等待本人明确处置，普通留言不恢复执行。
          </p>
          <Button size="sm" variant="outline" onClick={() => openTicket(item.ticket.id)}>查看工单并管理</Button>
        </article>
      ))}
      {inbox.reminders.map(item => (
        <article key={item.id} className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-4">
          <h3 className="m-0 text-sm">
            待本人处置 ·
            {item.reason}
          </h3>
          <p className="text-xs">
            等待
            {item.waitingFor}
            {' '}
            · 自
            {item.progressAt}
            {' '}
            · 提醒
            {item.remindedAt ?? item.dueAt}
            {' '}
            ·
            {item.deliveryError ?? item.deliveryState}
          </p>
          {item.ticketId && <Button size="sm" variant="outline" onClick={() => openTicket(item.ticketId!)}>查看工单</Button>}
        </article>
      ))}
      {!!syncProblems.length && (
        <p role="status" className="m-0 text-xs text-[var(--dsw-alias-state-warn-primary)]">
          {syncProblems.length}
          {' '}
          个已答问题有 GitHub 同步问题，无需重答。
          <Button size="sm" variant="ghost" onClick={() => setShowResolved(true)}>查看同步结果</Button>
        </p>
      )}
      {!!inbox.resolved.length && (
        <details open={showResolved} onToggle={event => setShowResolved(event.currentTarget.open)}>
          <summary className="cursor-pointer">最近生效答案、目标撤销与同步结果（最多 50 条）</summary>
          <div className="mt-3 flex flex-col gap-3">{showResolved && inbox.resolved.map(ask => <AskCard key={ask.id} ask={ask} />)}</div>
        </details>
      )}
    </section>
  )
}
