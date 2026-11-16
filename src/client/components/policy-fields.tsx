import type { ReactNode } from 'react'
import type { PolicySnapshot } from '../../types/ledger'

export function PolicyFields({ value, onChange }: {
  value: PolicySnapshot
  onChange: (value: PolicySnapshot) => void
}): ReactNode {
  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex flex-col gap-1 text-xs">
        提问档位
        <select className="rounded-lg border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2" value={value.questionLevel} onChange={event => onChange({ ...value, questionLevel: event.target.value as PolicySnapshot['questionLevel'] })}>
          <option value="detailed">详细 detailed</option>
          <option value="important">重要 important</option>
          <option value="automatic">自动 automatic</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        合并策略
        <select className="rounded-lg border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2" value={value.mergePolicy} onChange={event => onChange({ ...value, mergePolicy: event.target.value as PolicySnapshot['mergePolicy'] })}>
          <option value="follow_question_level">跟随提问档位</option>
          <option value="human_required">必须本人答复</option>
          <option value="automatic_allowed">允许授权代理决定</option>
        </select>
      </label>
    </div>
  )
}
