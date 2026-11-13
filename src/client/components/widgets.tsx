/** 面板里反复出现的小块：卡片、分区标题、状态标签、相对时间。组件只从这里取。 */

import type { ReactNode } from 'react'
import type { StateDotState, TagTone } from './official'
import { STATUS_TONE } from '../../constants'
import { AlertIcon } from './icons'
import { Button, Input, StateDot, Switch, Tag } from './official'

/** 一块内容区。面板里所有分区都是它，不做第二种卡片。 */
export function Card({ title, extra, children, className = '' }: {
  title?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
}): ReactNode {
  return (
    <section className={`nx-card flex min-h-0 flex-col ${className}`}>
      {(title || extra) && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-nx-border-1 px-4 py-2.5">
          <h3 className="text-[13px] font-medium text-nx-text">{title}</h3>
          {extra}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-auto nx-scroll">{children}</div>
    </section>
  )
}

/** 统计数字。概览页的三张卡都用它。 */
export function Metric({ value, unit, hint }: { value: ReactNode, unit?: string, hint?: string }): ReactNode {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[26px] font-semibold leading-none text-nx-text tabular-nums">{value}</span>
      {unit && <span className="text-[12px] text-nx-text-3">{unit}</span>}
      {hint && <span className="ml-1 text-[11px] text-nx-caption">{hint}</span>}
    </div>
  )
}

/** 状态的中文名。 */
export const STATUS_LABELS = {
  waiting: '等待中',
  queued: '排队中',
  running: '进行中',
  review: '待审',
  done: '已完成',
  cancelled: '已取消',
} as const

/** 任务状态标签。状态文字与配色都从常量表取，不在这里硬编码。 */
export function StatusTag({ status }: { status: keyof typeof STATUS_TONE }): ReactNode {
  return <Tag tone={STATUS_TONE[status] as TagTone}>{STATUS_LABELS[status]}</Tag>
}

export function StatusLine({ state, text }: { state: StateDotState, text: string }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-nx-text-2">
      <StateDot state={state} />
      {text}
    </span>
  )
}

/** 需介入标记。由 pending ask 派生，不是独立状态。 */
export function AttentionMark({ text = '需介入' }: { text?: string }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-nx-warn">
      <AlertIcon size={12} />
      {text}
    </span>
  )
}

export { Button, Input, Switch, Tag }

/** 空状态。列表为空时统一用它，不留空白区域。 */
export function Empty({ text }: { text: string }): ReactNode {
  return <p className="px-4 py-8 text-center text-[12px] text-nx-text-3">{text}</p>
}

/** 相对时间。超过一天就给日期，不再算「几小时前」。 */
export function relative(iso: string | undefined): string {
  if (!iso)
    return '—'
  const at = new Date(iso).getTime()
  if (Number.isNaN(at))
    return '—'
  const diff = Date.now() - at
  if (diff < 60_000)
    return '刚刚'
  if (diff < 3600_000)
    return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000)
    return `${Math.floor(diff / 3600_000)} 小时前`
  return new Date(at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

/** 「还剩多久」。用于 ask 截止时间与后台占槽。 */
export function remaining(iso: string | undefined): string | undefined {
  if (!iso)
    return undefined
  const at = new Date(iso).getTime()
  if (Number.isNaN(at))
    return undefined
  const left = at - Date.now()
  if (left <= 0)
    return '已超时'
  if (left < 3600_000)
    return `剩 ${Math.ceil(left / 60_000)} 分钟`
  return `剩 ${Math.ceil(left / 3600_000)} 小时`
}

/** 键值对一行。详情页全是它。 */
export function Field({ label, children }: { label: string, children: ReactNode }): ReactNode {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-20 shrink-0 text-[12px] text-nx-text-3">{label}</dt>
      <dd className="min-w-0 flex-1 text-[12px] text-nx-text">{children}</dd>
    </div>
  )
}

/** 截断的单行文本。 */
export function OneLine({ text, className = '' }: { text: string, className?: string }): ReactNode {
  return <span className={`block truncate ${className}`}>{text}</span>
}
