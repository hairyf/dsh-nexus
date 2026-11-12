/**
 * Nexus 面板的 HTTP 服务。
 *
 * 路由只做三件事：取参数、调 model、返回。**不写 SQL** —— 查询都在
 * `src/database/models/` 里，按表归属。
 *
 * 挂在宿主既有的 `ctx.webServer` 上，不额外起服务、不占端口。
 *
 * GenAPI 要求：`setup` 里只能有一句一句的 `app.method(...)`，不能有条件、循环、
 * 嵌套函数。所以每个 handler 都拆到 `routes/` 下的独立文件。
 */

import { defineWebServer } from 'dsh-h3'
import { channelEnabledHandler } from './routes/channel-enabled.post'
import { channelsHandler } from './routes/channels.get'
import { inboxKillHandler } from './routes/inbox-kill.post'
import { inboxHandler } from './routes/inbox.get'
import { overviewHandler } from './routes/overview.get'
import { projectsHandler } from './routes/projects.get'
import { settingsHandler } from './routes/settings.get'
import { settingsSaveHandler } from './routes/settings.post'
import { tasksHandler } from './routes/tasks.get'
import { ticketPauseHandler } from './routes/ticket-pause.post'
import { ticketHandler } from './routes/ticket.get'
import { triggersHandler } from './routes/triggers.get'

/** 路由与服务共用的依赖。 */
export interface NexusOptions {
  /** 插件实例的稳定标识，出现在错误信息里。 */
  entry: string
}

export const server = defineWebServer<NexusOptions>((app) => {
  app.get('/api/nexus/overview', overviewHandler)
  app.get('/api/nexus/tasks', tasksHandler)
  app.get('/api/nexus/tickets/:id', ticketHandler)
  app.post('/api/nexus/tickets/:id/pause', ticketPauseHandler)
  app.get('/api/nexus/triggers', triggersHandler)
  app.get('/api/nexus/channels', channelsHandler)
  app.post('/api/nexus/channels/:id/enabled', channelEnabledHandler)
  app.get('/api/nexus/inbox', inboxHandler)
  app.post('/api/nexus/inbox/kill', inboxKillHandler)
  app.get('/api/nexus/settings', settingsHandler)
  app.post('/api/nexus/settings', settingsSaveHandler)
  app.get('/api/nexus/projects', projectsHandler)
})
