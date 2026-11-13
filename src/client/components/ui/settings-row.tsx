/**
 * 设置行与设置组，复刻官方 `FontSizeRow` / `FontSettingsGroup`。
 *
 * 关键量：标题 14px / 22px 行高，说明 12px / 18px，行内边距 16px 0，
 * 分隔线是 **0.5px**（不是 1px）—— 1px 在高分屏上会显得脏。
 */

import type { ReactNode } from 'react'

/**
 * 一行设置：左边标题与说明，右边控件。
 *
 * 行本身不持有值 —— 控件由调用方给，它自己管受控状态。
 */
export function SettingsRow({ title, description, children, stacked = false, disabled = false, className = '' }: {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** 把控件放到文字下方并撑满整行，窄屏时用 */
  stacked?: boolean
  /** 标记为不可用，同时让控件 inert */
  disabled?: boolean
  className?: string
}): ReactNode {
  return (
    <div className={`nx-set-row ${stacked ? 'nx-set-row-stacked' : ''} ${className}`.trim()} aria-disabled={disabled || undefined}>
      <div className="nx-set-row-text">
        <div className="nx-set-title">{title}</div>
        {description !== undefined && <div className="nx-set-desc">{description}</div>}
      </div>
      {children !== undefined && (
        <div className="nx-set-control" inert={disabled}>{children}</div>
      )}
    </div>
  )
}

/**
 * 一组设置：可选标题 + 若干行。
 *
 * 组只提供外框和标题，行由调用方作为 children 传入 —— 它不知道自己在配什么。
 */
export function SettingsGroup({ title, description, children }: {
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
}): ReactNode {
  const headed = title !== undefined || description !== undefined
  return (
    <div className="nx-set-group">
      {headed && (
        <div className="nx-set-row">
          <div className="nx-set-row-text">
            {title !== undefined && <div className="nx-set-title">{title}</div>}
            {description !== undefined && <div className="nx-set-desc">{description}</div>}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
