/**
 * 复刻自官方的布局件。样式在 `main.css`，这里只管结构。
 *
 * 为什么复刻而不是自己画：这些组件的圆角、0.5px 分隔线、16px 行内边距、
 * 14/12 两级字号都是官方量出来的值。自己写一套 flex + border，看起来「差不多」，
 * 放在宿主界面里就是不一样。
 */

import type { ReactNode } from 'react'

/**
 * 面板容器。
 *
 * 用官方的 elevation token 而不是自己写 `border` + `bg`：面板浮在宿主内容之上，
 * 阴影方向、描边强度、半透明背景都要和宿主一致，否则一明一暗能看出是外来的。
 */
export function Surface({ children, padding = 'none', elevated = false, className = '' }: {
  children?: ReactNode
  padding?: 'none' | 'sm' | 'md'
  elevated?: boolean
  className?: string
}): ReactNode {
  const inset = padding === 'sm' ? 'nx-surface-sm' : padding === 'md' ? 'nx-surface-md' : ''
  return (
    <div className={`nx-surface ${elevated ? 'nx-surface-elevated' : ''} ${className}`.trim()}>
      {inset ? <div className={inset}>{children}</div> : children}
    </div>
  )
}

/** 一行列表：左侧标题、可选摘要、尾部槽位。 */
export function ListRow({ leading, title, summary, trailing, badge, tone = 'default', onClick, children }: {
  leading?: ReactNode
  title: ReactNode
  summary?: ReactNode
  trailing?: ReactNode
  badge?: ReactNode
  tone?: 'default' | 'error' | 'muted'
  onClick?: () => void
  children?: ReactNode
}): ReactNode {
  const toneClass = tone === 'error' ? 'nx-row-error' : ''
  const clickable = onClick !== undefined
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ')
      return
    event.preventDefault()
    onClick?.()
  }

  return (
    <div className="nx-row">
      <div className="nx-row-header" data-has-accessory={trailing === undefined ? undefined : true}>
        <div
          className="nx-row-line"
          data-clickable={clickable || undefined}
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          onClick={onClick}
          onKeyDown={clickable ? onKeyDown : undefined}
        >
          {leading !== undefined && <span className="nx-row-leading">{leading}</span>}
          <span className="nx-row-title">{title}</span>
          {badge !== undefined && <span className="nx-row-badge">{badge}</span>}
          {summary !== undefined && <span className={`nx-row-summary ${toneClass}`.trim()}>{summary}</span>}
        </div>
        {trailing !== undefined && <span className="nx-row-suffix">{trailing}</span>}
      </div>
      {children}
    </div>
  )
}
