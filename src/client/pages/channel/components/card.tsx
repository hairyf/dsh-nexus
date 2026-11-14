import type { ReactNode } from 'react'
import type { OverviewChannelKind } from '../../../types'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { FeishuIcon, GitHubIcon, GitLabIcon } from '../../../components/icons'
import { OVERVIEW_CHANNEL_LABELS } from '../../../constants'
import { useActions } from '../../../hooks/use-store'
import { useTranslation } from '../../../hooks/use-translation'

export function Card({ kind }: { kind: OverviewChannelKind }): ReactNode {
  const { t } = useTranslation()
  const { openChannel } = useActions()
  const Icon = { github: GitHubIcon, gitlab: GitLabIcon, feishu: FeishuIcon }[kind]
  const description = { github: 'channelGithubDescription', gitlab: 'channelGitlabDescription', feishu: 'channelFeishuDescription' } as const
  return (
    <button type="button" onClick={() => openChannel(kind)} aria-label={`${OVERVIEW_CHANNEL_LABELS[kind]} · ${t('channelSettings')}`} className="group flex min-h-48 min-w-0 cursor-pointer flex-col gap-4 rounded-2xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-5 text-left font-[inherit] outline-none transition-colors hover:border-[var(--dsw-alias-border-l1)] hover:bg-[var(--dsw-alias-card-fill)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)]">
      <span className="flex w-full items-center justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--dsw-alias-card-fill)]"><Icon width={27} height={27} /></span>
        <Tag tone="quiet">{t(kind === 'feishu' ? 'channelUnsupported' : 'channelNotConfigured')}</Tag>
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium text-[var(--dsw-alias-label-primary)]">{OVERVIEW_CHANNEL_LABELS[kind]}</span>
        <span className="text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t(description[kind])}</span>
      </span>
      <span className="mt-auto text-xs text-[var(--dsw-alias-state-business-primary)] underline-offset-4 group-hover:underline">{t(kind === 'feishu' ? 'channelUnsupported' : 'channelConfigure')}</span>
    </button>
  )
}
