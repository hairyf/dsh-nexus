/** 客户端共享类型。只放面板自己的东西，API 载荷类型由 GenAPI 生成。 */

import type { Tab } from '../constants'

/** 当前页面。详情页是 Tab 上加一个 id，不另开路由文件。 */
export interface Location {
  tab: Tab
  /** 任务详情 */
  ticketId?: string
  /** 触发页选中了哪个话题 */
  threadKey?: string
  /** 收件箱展开的收件人 */
  inboxType?: string
}

/** 一个 Tab 的元数据。 */
export interface TabItem {
  value: Tab
  label: string
  panelId: string
  id: string
}
