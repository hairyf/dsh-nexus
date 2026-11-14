import type { ReactNode } from 'react'
import type { OverviewTask } from '../../../types'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { TasksIcon } from '../../../components/icons'
import { OVERVIEW_CHANNEL_LABELS, OVERVIEW_STATUS } from '../../../constants'
import { useActions } from '../../../hooks/use-store'
import { useTranslation } from '../../../hooks/use-translation'

export function Row({ task }: { task: OverviewTask }): ReactNode {
  const { t } = useTranslation()
  const { openTicket } = useActions()
  const status = OVERVIEW_STATUS[task.status]
  return (
    <li className="flex flex-col gap-3 border-b border-[var(--dsw-alias-border-l3)] py-5 last:border-b-0 @min-[640px]:flex-row @min-[640px]:items-center @min-[640px]:justify-between @min-[640px]:gap-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-[var(--dsw-alias-label-tertiary)]"><TasksIcon width={17} height={17} /></span>
        <div className="min-w-0">
          <h3 className="text-[13px] leading-5 font-medium [overflow-wrap:anywhere] m-0">
            <span className="mr-2 text-xs font-normal text-[var(--dsw-alias-label-tertiary)]">{task.id}</span>
            {t(task.title)}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">
            <Tag tone={status.tone}>{t(status.label)}</Tag>
            {task.status === 'intervention'
              ? <span>{t('overviewInterventionReason')}</span>
              : (
                  <>
                    <span>{`${t('overviewSource')}: ${OVERVIEW_CHANNEL_LABELS[task.channel]}`}</span>
                    {task.event && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{task.event}</span>
                      </>
                    )}
                    {task.status === 'waiting' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{t('overviewTriggerRunning')}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{`${t(task.status === 'waiting' ? 'overviewSleepDuration' : 'overviewDuration')}: ${task.duration}`}</span>
                  </>
                )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[29px] @min-[640px]:pl-0">
        {task.action && <Button size="sm" variant="outline" disabled title={t('overviewUnavailable')}>{t(task.action === 'pr' ? 'overviewOpenPr' : 'overviewOpenSession')}</Button>}
        <Button size="sm" variant="primary" aria-label={`${t('overviewOpenDetails')} ${task.id}`} onClick={() => openTicket(task.id)}>{t('overviewOpenDetails')}</Button>
      </div>
    </li>
  )
}
