/**
 * 表单弹窗，复刻官方 `FeedbackDialog`。
 *
 * 用官方 `Modal` + `Button`：遮罩、焦点圈、Esc 关闭、层叠顺序都由 `Modal` 管，
 * 自己写 aside/dialog 会在宿主已经有一层弹窗时叠错。
 *
 * 相对官方做的改动只有一处：`className` 里那条 `.dialog.dialog` 的圆角与宽度
 * 依赖官方 CSS 的加载顺序，我们拿不到那个顺序，所以宽度由自己的类给。
 */

import type { ReactNode } from 'react'
import { Button, Modal } from '../official'

export interface FormDialogOption {
  id: string
  label: string
}

export function FormDialog({ open, onOpenChange, title, children, options, optionValue, onOptionChange, optionsLabel, submitLabel, cancelLabel, submitting = false, submitDisabled = false, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children?: ReactNode
  /** 可选的单排 chip；选了会回传 id，再点一次取消 */
  options?: readonly FormDialogOption[]
  optionValue?: string | null
  onOptionChange?: (value: string | null) => void
  optionsLabel?: string
  submitLabel: string
  cancelLabel?: string
  submitting?: boolean
  submitDisabled?: boolean
  onSubmit: () => void
}): ReactNode {
  const close = (): void => onOpenChange(false)

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      closeLabel={cancelLabel ?? '关闭'}
      className="w-[min(488px,100%)]"
      footer={(
        <>
          {cancelLabel !== undefined && (
            <Button disabled={submitting} onClick={close}>{cancelLabel}</Button>
          )}
          <Button
            variant="primary"
            aria-busy={submitting}
            disabled={submitting || submitDisabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </>
      )}
    >
      {options !== undefined && options.length > 0 && (
        <div className="nx-chips" role="group" aria-label={optionsLabel ?? title}>
          {options.map((option) => {
            const active = option.id === optionValue
            return (
              <button
                key={option.id}
                type="button"
                className={`nx-chip ${active ? 'nx-chip-active' : ''}`.trim()}
                aria-pressed={active}
                disabled={submitting}
                onClick={() => onOptionChange?.(active ? null : option.id)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
      {children}
    </Modal>
  )
}
