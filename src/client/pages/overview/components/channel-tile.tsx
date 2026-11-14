import type { ReactNode } from 'react'
import type { OverviewChannel } from '../../../types'
import { CheckIcon, FeishuIcon, GitHubIcon, GitLabIcon } from '../../../components/icons'
import { useTranslation } from '../../../hooks/use-translation'

export function ChannelTile({ channel }: { channel: OverviewChannel }): ReactNode {
  const { t } = useTranslation()
  const Icon = { github: GitHubIcon, feishu: FeishuIcon, gitlab: GitLabIcon }[channel.kind]
  return (
    <div className={`relative flex min-w-0 flex-col items-center justify-center gap-3 rounded-xl py-3.5 ${channel.connected ? 'bg-[var(--dsw-alias-card-fill)]' : 'text-[var(--dsw-alias-label-tertiary)]'}`}>
      <Icon width={27} height={27} className={channel.connected ? '' : 'opacity-50'} />
      <span className="max-w-full truncate text-xs leading-4">{channel.name}</span>
      <span className="sr-only">{t(channel.connected ? 'overviewConnected' : 'overviewDisconnected')}</span>
      {channel.connected && <span className="absolute top-1.5 right-1.5 flex size-3.5 items-center justify-center rounded-full"><CheckIcon width={10} height={10} /></span>}
    </div>
  )
}
