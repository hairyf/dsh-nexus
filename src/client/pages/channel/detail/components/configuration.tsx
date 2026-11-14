import type { ReactNode } from 'react'
import { Button, Input, SegmentedTabs } from '@deepseek-ai/dsh-client-ui-primitives'
import { useId, useState } from 'react'
import { OVERVIEW_CHANNEL_LABELS } from '../../../../constants'
import { useTranslation } from '../../../../hooks/use-translation'
import { Section } from './section'

export function Configuration({ kind }: { kind: 'github' | 'gitlab' }): ReactNode {
  const { t } = useTranslation()
  const id = useId()
  const [method, setMethod] = useState<'authorize' | 'token'>('authorize')
  const [host, setHost] = useState('https://gitlab.com')
  const [hostInvalid, setHostInvalid] = useState(false)
  const validateHost = (): void => {
    try {
      const url = new URL(host)
      setHostInvalid(url.protocol !== 'https:' || !url.hostname || Boolean(url.username || url.password || url.search || url.hash) || url.pathname !== '/')
    }
    catch {
      setHostInvalid(true)
    }
  }
  const name = OVERVIEW_CHANNEL_LABELS[kind]
  const tabs = [
    { value: 'authorize' as const, label: (
      <span className="inline-flex items-center gap-1.5">
        {t('channelAuthorize')}
      </span>
    ), id: `${id}-authorize`, panelId: `${id}-authorize-panel` },
    { value: 'token' as const, label: t('channelToken'), id: `${id}-token`, panelId: `${id}-token-panel` },
  ] as const
  return (
    <div className="grid min-w-0 items-start gap-4 @min-[780px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        {kind === 'gitlab' && (
          <Section title={t('channelSite')} description={t('channelSiteDescription')}>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-host`} className="text-xs font-medium">{t('channelHost')}</label>
              <Input
                id={`${id}-host`}
                type="url"
                value={host}
                onChange={(event) => {
                  setHost(event.target.value)
                  setHostInvalid(false)
                }}
                onBlur={validateHost}
                spellCheck={false}
                autoComplete="url"
                aria-invalid={hostInvalid}
                aria-describedby={`${id}-host-help${hostInvalid ? ` ${id}-host-error` : ''}`}
              />
              <p id={`${id}-host-help`} className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t('channelHostHelp')}</p>
              {hostInvalid && <p id={`${id}-host-error`} role="alert" className="m-0 text-xs text-[var(--dsw-alias-state-error-primary)]">{t('channelHostInvalid')}</p>}
            </div>
          </Section>
        )}
        <Section title={t('channelAccount')} description={t('channelAccountDescription')}>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-username`} className="text-xs font-medium">{t('channelLoginName')}</label>
            <Input id={`${id}-username`} placeholder="nexus-bot" autoComplete="off" spellCheck={false} aria-describedby={`${id}-username-help`} />
            <p id={`${id}-username-help`} className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t('channelLoginNameHelp')}</p>
          </div>
          <div className="grid gap-3 @min-[540px]:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-commit-name`} className="text-xs font-medium">{t('channelCommitName')}</label>
              <Input id={`${id}-commit-name`} placeholder="Nexus Bot" autoComplete="off" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-commit-email`} className="text-xs font-medium">{t('channelCommitEmail')}</label>
              <Input id={`${id}-commit-email`} type="email" placeholder="bot@example.com" autoComplete="off" spellCheck={false} />
            </div>
          </div>
          <p className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t('channelCommitHelp')}</p>
          <div className="flex flex-col gap-3 border-t border-[var(--dsw-alias-border-l3)] pt-4">
            <div className="max-w-full overflow-x-auto"><SegmentedTabs value={method} onChange={setMethod} items={tabs} label={t('channelLoginMethod')} size="sm" className="w-fit" /></div>
            <div key={method} id={`${id}-${method}-panel`} role="tabpanel" aria-labelledby={`${id}-${method}`} tabIndex={0} className="flex min-w-0 flex-col items-start gap-3 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)]">
              {method === 'authorize'
                ? (
                    <>
                      <p className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t('channelAuthorizeDescription')}</p>
                      <Button size="sm" variant="primary" disabled aria-describedby={`${id}-unavailable`}>{t('channelAuthorizeAction', { name })}</Button>
                    </>
                  )
                : (
                    <>
                      <label htmlFor={`${id}-token-value`} className="text-xs font-medium">{t('channelTokenLabel')}</label>
                      <Input id={`${id}-token-value`} className="w-full min-w-0" type="password" disabled autoComplete="new-password" placeholder={t('channelTokenPlaceholder')} aria-describedby={`${id}-token-help ${id}-unavailable`} />
                      <p id={`${id}-token-help`} className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t('channelTokenDescription')}</p>
                      <Button size="sm" variant="primary" disabled aria-describedby={`${id}-unavailable`}>{t('channelSave')}</Button>
                    </>
                  )}
              <p id={`${id}-unavailable`} className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-tertiary)]">{t(method === 'token' ? 'channelTokenDisabled' : 'channelUnavailable')}</p>
            </div>
          </div>
        </Section>
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        <Section title={t('channelIdentity')}>
          <dl className="m-0 flex flex-col gap-2">
            <dt className="text-xs text-[var(--dsw-alias-label-secondary)]">{t('channelCredentialLocation')}</dt>
            <dd className="m-0 break-all rounded-lg bg-[var(--dsw-alias-card-fill)] px-3 py-2 font-mono text-xs">{`~/.nexus/credentials/${kind}/`}</dd>
          </dl>
          <p className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t('channelCredentialProtection')}</p>
          <p className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t('channelWorkerIdentity')}</p>
        </Section>
        <p className="m-0 px-1 text-xs leading-5 text-[var(--dsw-alias-label-tertiary)]">{t('channelSecurityNotice')}</p>
      </aside>
    </div>
  )
}
