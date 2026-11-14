import type { ReactNode } from 'react'
import { useTranslation } from '../../hooks/use-translation'
import { Card } from './components/card'

export function Channel(): ReactNode {
  const { t } = useTranslation()
  return (
    <section className="@container flex flex-col gap-5 pb-10">
      <header className="flex flex-col gap-1.5">
        <h2 className="m-0 text-base font-medium">{t('tabChannels')}</h2>
        <p className="m-0 text-[13px] leading-5 text-[var(--dsw-alias-label-secondary)]">{t('channelDescription')}</p>
      </header>
      <div className="grid gap-4 @min-[500px]:grid-cols-2 @min-[840px]:grid-cols-3">
        <Card kind="github" />
        <Card kind="gitlab" />
        <Card kind="feishu" />
      </div>
      <p className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-tertiary)]">{t('channelSingleAccount')}</p>
    </section>
  )
}
