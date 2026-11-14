import type { ReactNode } from 'react'
import type { Filters as FilterValues } from '../model'
import { Button, IconChevronDownOutlineRegular, Input, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { useActions, useStore } from '../../../hooks/use-store'
import { useTranslation } from '../../../hooks/use-translation'
import { KINDS, STATUSES } from '../model'

export function Filters(): ReactNode {
  const { t } = useTranslation()
  const { filters, openFilter } = useStore(state => state.trigger)
  const { setTriggerFilters, resetTriggerFilters, setTriggerFilterMenu } = useActions()
  const active = filters.query.trim() || filters.channel !== 'all' || filters.status !== 'all' || filters.kind !== 'all' || filters.mentionedOnly
  const menus: { key: 'channel' | 'kind' | 'status', label: string, items: { id: string, label: string }[] }[] = [
    { key: 'channel', label: t('triggerChannelFilter'), items: [{ id: 'all', label: t('triggerAllChannels') }, { id: 'github', label: 'GitHub' }, { id: 'gitlab', label: 'GitLab' }, { id: 'feishu', label: t('triggerFeishu') }] },
    { key: 'kind', label: t('triggerKindFilter'), items: [{ id: 'all', label: t('triggerAllKinds') }, ...Object.entries(KINDS).map(([id, label]) => ({ id, label: t(label) }))] },
    { key: 'status', label: t('triggerStatusFilter'), items: [{ id: 'all', label: t('triggerAllStatuses') }, ...Object.entries(STATUSES).map(([id, status]) => ({ id, label: t(status.label) }))] },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="search" value={filters.query} onChange={event => setTriggerFilters({ query: event.currentTarget.value })} placeholder={t('triggerSearch')} aria-label={t('triggerSearch')} className="min-w-48 flex-1 !text-xs" />
      {active && <Button size="sm" variant="ghost" onClick={resetTriggerFilters}>{t('triggerReset')}</Button>}
      {menus.map(menu => (
        <Menu
          key={menu.key}
          open={openFilter === menu.key}
          items={menu.items}
          selectedId={filters[menu.key]}
          onClose={() => setTriggerFilterMenu(null)}
          onSelect={value => setTriggerFilters({ [menu.key]: value } as Partial<FilterValues>)}
          portal
          minWidthFromAnchor
          dense
          anchor={(
            <Button size="sm" variant="outline" aria-label={`${menu.label}: ${menu.items.find(item => item.id === filters[menu.key])?.label}`} aria-haspopup="menu" aria-expanded={openFilter === menu.key} onClick={() => setTriggerFilterMenu(openFilter === menu.key ? null : menu.key)}>
              {menu.items.find(item => item.id === filters[menu.key])?.label}
              <IconChevronDownOutlineRegular size={14} />
            </Button>
          )}
        />
      ))}
      <label className="flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-[var(--dsw-alias-label-secondary)]">
        <input type="checkbox" checked={filters.mentionedOnly} onChange={event => setTriggerFilters({ mentionedOnly: event.currentTarget.checked })} className="accent-[var(--dsw-alias-state-business-primary)]" />
        {t('triggerMentionedOnly')}
      </label>
    </div>
  )
}
