import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'

export const dicts = {
  zh: {
    panel: 'Nexus',
    title: 'Nexus',
    desc: '项目、工单与本人待决事项',
    tabsLabel: '面板分区',
    tabInbox: '信箱',
    tabOverview: '概览',
    tabTickets: '工单',
    tabTriggers: '来源',
    tabChannels: '渠道',
    tabSettings: '设置',
    graphTitle: '编排关系',
    graphSupervisor: '临时协调',
    graphWaiting: '等待',
    graphZoomOut: '缩小',
    graphZoomIn: '放大',
    graphFit: '适应视图',
    graphHint: '方向键平移，+ / - 缩放，Home 复位；Tab 进入节点',
    graphFlow: '责任流',
    graphAssociation: '关联',
    graphDependency: '依赖',
    overviewOpenDetails: '查看工单',
  },
  en: {
    panel: 'Nexus',
    title: 'Nexus',
    desc: 'Projects, tickets and decisions waiting for you',
    tabsLabel: 'Panel sections',
    tabInbox: 'Inbox',
    tabOverview: 'Overview',
    tabTickets: 'Tickets',
    tabTriggers: 'Sources',
    tabChannels: 'Channels',
    tabSettings: 'Settings',
    graphTitle: 'Orchestration',
    graphSupervisor: 'Temporary supervisor',
    graphWaiting: 'Waiting',
    graphZoomOut: 'Zoom out',
    graphZoomIn: 'Zoom in',
    graphFit: 'Fit view',
    graphHint: 'Arrow keys pan, + / - zoom, Home resets; Tab enters nodes',
    graphFlow: 'Responsibility',
    graphAssociation: 'Association',
    graphDependency: 'Dependency',
    overviewOpenDetails: 'Open ticket',
  },
} as const
export type DshNexusKey = keyof typeof dicts.zh
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    dshNexus: DshNexusKey
  }
}
export type T = Translate<DshNexusKey>
