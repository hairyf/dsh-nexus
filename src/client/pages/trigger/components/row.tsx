import type { ReactNode } from 'react'
import type { Topic } from '../model'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { FeishuIcon, GitHubIcon, GitLabIcon } from '../../../components/icons'
import { useActions } from '../../../hooks/use-store'
import { useTranslation } from '../../../hooks/use-translation'
import { deliveryStatus, KINDS, STATUSES } from '../model'

export function Row({ topic }: { topic: Topic }): ReactNode {
  const { t } = useTranslation()
  const { openThread } = useActions()
  const record = topic.latest
  const Icon = { github: GitHubIcon, gitlab: GitLabIcon, feishu: FeishuIcon }[record.channel]
  const status = STATUSES[deliveryStatus({ ...record, deliveries: topic.events.flatMap(event => [...event.deliveries]) })]
  const channel = record.channel === 'feishu' ? t('triggerFeishu') : record.channel === 'github' ? 'GitHub' : 'GitLab'
  return (
    <li className="border-t border-[var(--dsw-alias-border-l3)] first:border-t-0">
      <button type="button" onClick={() => openThread(record.thread.id)} aria-label={`${t('triggerOpenTopic')} ${t(record.thread.title)}`} className="group/topic flex w-full cursor-pointer items-start gap-3 rounded-xl border-0 bg-transparent p-4 text-left font-[inherit] outline-none transition-colors hover:bg-[var(--dsw-alias-card-fill)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dsw-alias-state-business-primary)]">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--dsw-alias-card-fill)]" title={channel}><Icon width={18} height={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5">
            <span className="min-w-0 font-medium text-[var(--dsw-alias-label-primary)] underline-offset-4 group-hover/topic:underline">{t(record.thread.title)}</span>
            <span className="text-xs text-[var(--dsw-alias-label-tertiary)]">{record.thread.ref}</span>
            <Tag tone="neutral">{t(KINDS[record.kind])}</Tag>
            {record.mentioned && <Tag tone="info">{t('triggerMentioned')}</Tag>}
          </span>
          <span className="mt-1 block truncate text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t(record.text)}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-[var(--dsw-alias-label-tertiary)]">
            <span>{channel}</span>
            <span aria-hidden="true">·</span>
            <span>{record.actor}</span>
            {!record.human && <span>{t('triggerAutomated')}</span>}
            <span aria-hidden="true">·</span>
            <span>{t('triggerEventCount', { count: topic.events.length })}</span>
            {record.thread.project && (
              <>
                <span aria-hidden="true">·</span>
                <span className="[overflow-wrap:anywhere]">{record.thread.project}</span>
              </>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <Tag tone={status.tone}>{t(status.label)}</Tag>
          <time dateTime={record.at} title={record.at} className="text-[11px] text-[var(--dsw-alias-label-tertiary)] tabular-nums">{record.at.slice(11, 16)}</time>
          <span className="text-[11px] text-[var(--dsw-alias-label-tertiary)]">{t('triggerOpenTopic')}</span>
        </span>
      </button>
    </li>
  )
}
