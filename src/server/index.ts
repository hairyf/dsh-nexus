import type { WebServerOptions } from '../types/web'
import { defineWebServer } from 'dsh-h3'
import { postAnswer } from './routes/asks.post'
import { getContext } from './routes/context.get'
import { getPanel } from './routes/panel.get'
import { patchProject } from './routes/projects.patch'
import { refreshProjects } from './routes/projects.post'
import { patchSettings } from './routes/settings.patch'
import { getTicket } from './routes/tickets.get'
import { patchTicket } from './routes/tickets.patch'
import { postTicket } from './routes/tickets.post'

export const server = defineWebServer<WebServerOptions>((app) => {
  app.get('/api/nexus/panel', getPanel)
  app.get('/api/nexus/tickets/:id', getTicket)
  app.patch('/api/nexus/tickets/:id', patchTicket)
  app.post('/api/nexus/tickets/:id/:action', postTicket)
  app.post('/api/nexus/asks/:id/answers', postAnswer)
  app.patch('/api/nexus/projects/:id', patchProject)
  app.post('/api/nexus/projects/refresh', refreshProjects)
  app.patch('/api/nexus/settings', patchSettings)
  app.get('/api/nexus/sessions/:id/context', getContext)
})
