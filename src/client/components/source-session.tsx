import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { useAsyncState } from '@reause/core'
import { useState } from 'react'
import { nexus } from '../apis/nexus'
import { useDshContext } from '../hooks/use-dsh-context'
import { openSidechat } from '../service/sidechat'

export function SourceSession({ sessionId }: {
  sessionId: string
}): ReactNode {
  const ctx = useDshContext()

  const resource = useAsyncState(() => nexus.context(sessionId), null)

  const [error, setError] = useState('')

  const [opened, setOpened] = useState(false)

  const [expanded, setExpanded] = useState(false)

  const context = resource.state

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-[var(--dsw-alias-border-l3)] p-3">
      <p className="m-0 break-all font-mono text-xs">
        原会话
        {sessionId}
      </p>
      {resource.isLoading && <p role="status" className="m-0 text-xs">正在读取最近来源上下文…</p>}
      {!!resource.error && (
        <p role="alert" className="m-0 text-xs">
          读取来源上下文失败：
          {String(resource.error)}
          。已记录问题仍保留，可重试或打开原会话。
        </p>
      )}
      {context && !context.available && (
        <p className="m-0 text-xs">
          来源会话不可用：
          {context.reason}
          。已记录的问题仍可正式回答。
        </p>
      )}
      {context?.entries.slice(expanded ? 0 : -3).map((entry, index) => (
        <blockquote key={entry.at + index} className="m-0 border-l border-[var(--dsw-alias-border-l2)] pl-3 text-xs">
          <p className="m-0 text-[var(--dsw-alias-label-tertiary)]">
            {entry.origin}
            {' '}
            ·
            {' '}
            {entry.at}
          </p>
          <p className="mb-0 mt-1 whitespace-pre-wrap break-words">{entry.text}</p>
        </blockquote>
      ))}
      {context?.available && !context.entries.length && <p className="m-0 text-xs">来源会话尚无可展示的近期有效内容。</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={resource.isLoading || !context?.available}
          onClick={() => {
            setError('')

            try {
              openSidechat(ctx, sessionId)

              setOpened(true)
            }
            catch (error) {
              setError(error instanceof Error ? error.message : String(error))
            }
          }}
        >
          打开来源侧聊
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            try {
              ctx.uiWorkspace.openSession(sessionId as SessionId)
            }
            catch (error) {
              setError(error instanceof Error ? error.message : String(error))
            }
          }}
        >
          返回原会话
        </Button>
        <Button size="sm" variant="ghost" disabled={resource.isLoading} onClick={() => void resource.executeImmediate()}>重读来源</Button>
        {context && context.entries.length > 3 && <Button size="sm" variant="ghost" onClick={() => setExpanded(value => !value)}>{expanded ? '收起背景' : '更多近期背景'}</Button>}
      </div>
      {opened && <p role="status" className="m-0 text-xs">已请求原会话的既有侧聊入口；侧聊不会结清 Nexus 问题。创建/运行结果由原侧栏显示；从 Nexus 入口返回正式答复。</p>}
      {error && (
        <p role="alert" className="m-0 text-xs text-[var(--dsw-alias-state-error-primary)]">
          来源入口失败：
          {error}
          。请使用“返回原会话”。
        </p>
      )}
    </section>
  )
}
