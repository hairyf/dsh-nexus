/** 客户端常量。协议字符串只在这一处定义，组件只消费。 */

import type { Tab } from '../constants'
import type { TabItem } from './types'
import { TABS } from '../constants'

/** Tab 的展示名。顺序与 `TABS` 一致。 */
export const TAB_LABELS: Record<Tab, string> = {
  overview: '概览',
  tasks: '任务',
  triggers: '触发',
  channels: '渠道',
  settings: '设置',
}

/** `SegmentedTabs` 要的形状。 */
export const TAB_ITEMS: [TabItem, ...TabItem[]] = TABS.map(tab => ({
  value: tab,
  label: TAB_LABELS[tab],
  id: `nexus-tab-${tab}`,
  panelId: `nexus-panel-${tab}`,
})) as [TabItem, ...TabItem[]]

/** 任务详情页里几个分区的标题。 */
export const DETAIL_SECTIONS = {
  threads: '触发来源',
  workers: '执行记录',
  links: '关联任务',
  inbox: '消息',
} as const

/** 概览页的两个视图。 */
export const OVERVIEW_VIEWS = ['summary', 'hierarchy'] as const
export type OverviewView = (typeof OVERVIEW_VIEWS)[number]
export const OVERVIEW_VIEW_LABELS: Record<OverviewView, string> = {
  summary: '概览',
  hierarchy: '层级关系',
}

/** 收件箱面板按收件人分组时的标题。 */
export const INBOX_GROUP_LABELS = {
  user: '待你回答',
  main: '主编排',
  project: '项目编排',
  supervisor: 'Supervisor',
} as const

/** 设置页的分组。每一项是若干 `SettingKey`。 */
export const SETTING_GROUPS = [
  { key: 'concurrency', label: '并发', fields: ['maxWorkers', 'backgroundLimitMinutes'] },
  { key: 'merge', label: '合并', fields: ['autoMerge', 'autoMergeMaxLines'] },
  { key: 'delivery', label: '投递', fields: ['deliveryMaxAttempts', 'deliveryRetryCeilingSeconds'] },
] as const

/** 每个设置项的说明与取值范围。 */
export const SETTING_META = {
  maxWorkers: { label: '并发 Worker 数', hint: '1–16，另留 1 个槽位给人和状态查询', min: 1, max: 16 },
  backgroundLimitMinutes: { label: '后台任务上限（分钟）', hint: '到点杀掉后台并把票报成 waiting', min: 1, max: 240 },
  autoMerge: { label: '自动合并', hint: '默认关；开着也只对本票的 PR 生效', min: 0, max: 0 },
  autoMergeMaxLines: { label: '自动合并行数上限', hint: '增 + 删合计超过它就不自动合', min: 0, max: 5000 },
  deliveryMaxAttempts: { label: '投递重试次数', hint: '连续失败这么多次后转 stalled', min: 1, max: 10 },
  deliveryRetryCeilingSeconds: { label: '重试封顶（秒）', hint: '退避 2s → 4s → … → 这个值', min: 5, max: 600 },
} as const

/** 渠道展示名的兜底，渠道行还没建时用。 */
export const CHANNEL_LABELS: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  feishu: '飞书',
  qq: 'QQ',
  wechat: '微信 Claw',
}

/** 空状态文案。 */
export const EMPTY = {
  tickets: '还没有任务',
  threads: '还没有话题',
  triggers: '这个选题还没定',
  channels: '还没有配置渠道',
  inbox: '没有待处理的消息',
  workers: '还没有跑过',
  links: '没有关联任务',
} as const
