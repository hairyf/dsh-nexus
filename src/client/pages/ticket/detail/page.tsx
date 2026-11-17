import type { ReactNode } from 'react'
import type { PolicySnapshot } from '../../../../types/ledger'
import type { TicketDetailModel } from '../../../../types/web'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useAsyncState, useEventListener, useIntervalFn } from '@reause/core'
import { useState } from 'react'
import { nexus } from '../../../apis/nexus'
import { AskCard } from '../../../components/ask-card'
import { PolicyFields } from '../../../components/policy-fields'
import { SourceLink } from '../../../components/source-link'
import { SourceSession } from '../../../components/source-session'
import { useCommand, usePanel } from '../../../hooks/use-panel'
import { useActions, useStore } from '../../../hooks/use-store'

export function TicketDetail(): ReactNode {
  const id = useStore(state => state.navigation.ticketId)

  return id ? <Detail key={id} id={id} /> : <p>未选择工单，请返回工单列表。</p>
}
function Detail({ id }: {
  id: string
}): ReactNode {
  const { data } = usePanel()

  const { go, openThread, openTicket } = useActions()

  const returnTo = useStore(state => state.navigation.returnTo)

  const command = useCommand()

  const [reason, setReason] = useState('')

  const [result, setResult] = useState('')

  const [armed, setArmed] = useState(false)

  const current = data.tickets.find(item => item.ticket.id === id)?.ticket

  const [policy, setPolicy] = useState<PolicySnapshot | null>(() => current ? { questionLevel: current.questionLevel as PolicySnapshot['questionLevel'], mergePolicy: current.mergePolicy as PolicySnapshot['mergePolicy'] } : null)

  const resource = useAsyncState<TicketDetailModel | null>(() => nexus.ticket(id), null, { resetOnExecute: false })

  const reload = (): void => {
    void resource.executeImmediate()
  }

  useEventListener('focus', reload)

  useEventListener('online', reload)

  useIntervalFn(() => {
    if (document.visibilityState === 'visible' && !resource.isLoading)
      reload()
  }, 15000)

  const detail = resource.state

  if (!current) {
    return (
      <section>
        <p>工单不存在或已不可读取。</p>
        <Button size="sm" variant="outline" onClick={() => go('ticket')}>返回工单列表</Button>
      </section>
    )
  }

  const asks = [...data.inbox.pending, ...data.inbox.resolved].filter(ask => ask.ticketIds.includes(id))

  const target = current.deliveryTarget
    ? JSON.parse(current.deliveryTarget) as {
      base: string
      head: string
    }
    : null

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div><Button variant="ghost" size="sm" onClick={() => go(returnTo)}>返回</Button></div>
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-lg font-medium">{current.title}</h2>
        <span className="font-mono text-xs">{current.id}</span>
        <Tag tone={current.paused || current.failureReason ? 'warning' : 'quiet'}>{current.paused ? 'paused' : current.status}</Tag>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-4">
          <h3 className="m-0 text-sm font-medium">目标与授权范围</h3>
          <p className="whitespace-pre-wrap">{current.description ?? current.title}</p>
          <p className="mb-0 whitespace-pre-wrap text-xs">{current.authorization}</p>
        </article>
        <article className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-4">
          <h3 className="m-0 text-sm font-medium">验收要求</h3>
          <p className="mb-0 whitespace-pre-wrap">{current.acceptanceCriteria}</p>
        </article>
      </div>
      <p className="m-0 text-xs">
        实际快照：
        {current.questionLevel}
        {' '}
        ·
        {current.mergePolicy}
        {' '}
        · revision
        {current.policyRevision}
        。全局默认不追溯修改本票。
      </p>
      {(current.pauseReason || current.failureReason || current.executionAttention || current.prepareError) && (
        <p role="status" className="m-0 rounded-lg border border-[var(--dsw-alias-border-l3)] p-3">
          暂停/故障：
          {[current.pauseReason, current.failureReason, current.executionAttention, current.prepareError].filter(Boolean).join(' · ')}
        </p>
      )}
      <article className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-4">
        <h3 className="m-0 text-sm font-medium">当前 PR / CI 事实</h3>
        <p className="mb-0">
          <SourceLink href={current.prUrl}>{current.prUrl ?? '未关联 PR'}</SourceLink>
          {' '}
          · PR
          {' '}
          {current.prState ?? '尚未观测'}
          {' '}
          · CI
          {' '}
          {current.ciState ?? '尚未观测'}
        </p>
        {target && (
          <p className="mb-0 break-all font-mono text-xs">
            base
            {target.base}
            {' '}
            · head
            {target.head}
          </p>
        )}
        <p className="mb-0 text-xs text-[var(--dsw-alias-label-secondary)]">review、PR open、工具受理都不代表完成；成功交付、取消、未合并关闭分别展示。</p>
      </article>
      <details>
        <summary className="cursor-pointer">管理本工单与实际策略</summary>
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--dsw-alias-border-l3)] p-4">
          <p className="m-0 text-xs">
            作用范围：仅工单
            {id}
            。解除人工暂停不自动重试；重试须核实旧执行与外部副作用。
          </p>
          <label className="flex flex-col gap-1 text-xs">
            处置原因
            <input value={reason} onChange={event => setReason(event.target.value)} className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2" />
          </label>
          <div className="flex flex-wrap gap-2">
            {(['pause', 'resume', 'retry', 'dispatch'] as const).map(action => (
              <Button
                size="sm"
                variant="outline"
                key={action}
                disabled={command.busy || (!reason.trim() && action !== 'dispatch') || (action === 'resume' && !current.paused) || (action === 'pause' && !!current.paused)}
                onClick={() => void command.run(`工单 ${action}`, async () => {
                  const result = await nexus.command(id, action, reason)
                  setResult(JSON.stringify(result))
                  reload()
                }, action === 'dispatch' ? '派工已受理，尚不代表 Worker 已启动或工单完成。' : '管理决定已记录，请核对下方实际停止/运行结果。')}
              >
                {action}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={command.busy || !reason.trim()}
              onClick={() => {
                if (!armed) {
                  setArmed(true)

                  return
                }
                void command.run('取消工单', async () => {
                  const result = await nexus.command(id, 'cancel', reason)
                  setResult(JSON.stringify(result))
                  setArmed(false)
                  reload()
                }, '取消决定已记录，请核对旧执行停止结果。')
              }}
            >
              {armed ? '再次点击：取消本工单' : '取消工单'}
            </Button>
          </div>
          <fieldset disabled={command.busy} className="m-0 border-0 p-0"><PolicyFields value={policy!} onChange={setPolicy} /></fieldset>
          <Button
            size="sm"
            variant="outline"
            disabled={command.busy || !reason.trim()}
            onClick={() => void command.run('修改本票策略', async () => {
              await nexus.policy(id, policy!, reason)
              reload()
            })}
          >
            保存本票策略
          </Button>
          {command.feedback && <p role="status" className="m-0 text-xs">{command.feedback}</p>}
          {command.error && <p role="alert" className="m-0 text-xs text-[var(--dsw-alias-state-error-primary)]">{command.error}</p>}
          {result && <pre className="m-0 whitespace-pre-wrap break-all text-xs">{result}</pre>}
        </div>
      </details>
      {resource.error
        ? (
            <div role="alert">
              读取工单详情失败：
              {String(resource.error)}
              。
              <Button variant="outline" size="sm" onClick={reload}>重读详情</Button>
            </div>
          )
        : !detail && <p role="status">正在读取执行、依赖、产物与历史…</p>}
      {detail && (
        <>
          <section className="flex flex-col gap-3">
            <h3 className="m-0 text-sm font-medium">执行历史与来源会话</h3>
            {detail.executions.length
              ? detail.executions.map(binding => (
                  <article key={binding.id} className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-4">
                    <p className="mt-0 text-xs">
                      {binding.role}
                      {' '}
                      ·
                      {' '}
                      {binding.status}
                      {' '}
                      ·
                      {' '}
                      {binding.startedAt ?? '尚未核实启动'}
                      {' '}
                      ·
                      {' '}
                      {binding.closedAt ?? '未关闭'}
                    </p>
                    <p className="break-all font-mono text-xs">
                      {binding.repository}
                      {' '}
                      ·
                      {' '}
                      {binding.worktree}
                      {' '}
                      ·
                      {' '}
                      {binding.branch}
                    </p>
                    <SourceSession sessionId={binding.sessionId} key={binding.sessionId} />
                  </article>
                ))
              : <p className="m-0 text-xs">尚未创建执行；派工受理不产生虚构会话。</p>}
          </section>
          <section>
            <h3 className="text-sm font-medium">依赖与关联</h3>
            {detail.dependencies.length
              ? detail.dependencies.map(link => (
                  <p className="flex flex-wrap items-center gap-2 text-xs" key={link.ticketId + link.relatedId}>
                    <Button size="sm" variant="ghost" onClick={() => openTicket(link.ticketId)}>{link.ticketId}</Button>
                    {link.kind}
                    <Button size="sm" variant="ghost" onClick={() => openTicket(link.relatedId)}>{link.relatedId}</Button>
                    {link.satisfiedAt ? `成功依赖已满足 ${link.satisfiedAt}` : '尚无成功依赖事实'}
                  </p>
                ))
              : <p className="text-xs">没有关联依赖。</p>}
          </section>
          <section>
            <h3 className="text-sm font-medium">来源话题与订阅</h3>
            {detail.topics.length ? detail.topics.map(topic => <Button key={topic.id} size="sm" variant="ghost" onClick={() => openThread(topic.id)}>{topic.title}</Button>) : <p className="text-xs">未关联来源话题。</p>}
          </section>
          <section>
            <h3 className="text-sm font-medium">产物与验收证据</h3>
            {detail.evidence.map(item => (
              <article key={item.id} className="mb-2 rounded-lg border border-[var(--dsw-alias-border-l3)] p-3 text-xs">
                {item.verdict}
                {' '}
                ·
                {' '}
                {item.scope}
                {' '}
                ·
                {' '}
                {item.criteria}
                {' '}
                ·
                {' '}
                {item.basis}
                <p className="mb-0 whitespace-pre-wrap break-all">{item.evidence}</p>
                <p className="mb-0">
                  {item.executionBindingId}
                  {' '}
                  ·
                  {' '}
                  {item.createdAt}
                </p>
              </article>
            ))}
            {detail.messages.filter(message => message.facts).map(message => (
              <p className="break-all text-xs" key={message.id}>
                {message.facts}
                {' '}
                · 来源
                {' '}
                {message.sender}
                {' '}
                ·
                {' '}
                {message.acceptedAt}
              </p>
            ))}
            {!detail.evidence.length && !detail.messages.some(message => message.facts) && <p className="text-xs">尚无已记录产物或验收证据。</p>}
          </section>
          <details>
            <summary>事件与投递历史</summary>
            {detail.history.map(item => (
              <p className="break-all text-xs" key={item.id}>
                {item.at}
                {' '}
                ·
                {' '}
                {item.event}
                {' '}
                ·
                {' '}
                {item.fromStatus}
                {' '}
                →
                {' '}
                {item.toStatus}
                {' '}
                ·
                {' '}
                {item.reason}
              </p>
            ))}
            {detail.messages.map(message => (
              <p className="break-all text-xs" key={message.id}>
                {message.kind}
                {' '}
                ·
                {' '}
                {message.recipient}
                {' '}
                ·
                {' '}
                {message.error ? `投递失败：${message.error}` : message.handledAt ? '已处理' : message.readAt ? '已入上下文' : message.deliveredAt ? '已送达，待入上下文' : '待投递'}
              </p>
            ))}
          </details>
        </>
      )}
      <h3 className="m-0 text-sm font-medium">待决问题与生效答案</h3>
      {asks.map(ask => <AskCard key={ask.id} ask={ask} />)}
      {detail?.asks.filter(ask => !asks.some(item => item.id === ask.id)).map(ask => (
        <p key={ask.id} className="text-xs">
          {ask.content}
          {' '}
          ·
          {' '}
          {ask.status}
          {' '}
          · 当前责任
          {' '}
          {ask.handler}
          （非本人待办）
        </p>
      ))}
    </section>
  )
}
