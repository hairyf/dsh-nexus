import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { WebServerOptions } from '../types/web'
import { defineWebServer } from 'dsh-h3'
import { request } from './request'
import { postAnswer } from './routes/asks.post'
import { getContext } from './routes/context.get'
import { getMailbox } from './routes/mailbox.get'
import { handleMail } from './routes/mailbox.post'
import { getPanel } from './routes/panel.get'
import { patchProject } from './routes/projects.patch'
import { refreshProjects } from './routes/projects.post'
import { patchSettings } from './routes/settings.patch'
import { getTicket } from './routes/tickets.get'
import { patchTicket } from './routes/tickets.patch'
import { postTicket } from './routes/tickets.post'
import { createDispatch } from './transport'

export function server(ctx: Context, options: WebServerOptions): () => Promise<void> {
  const trusted = new WeakSet<Request>()
  let dispatch: (request: Request) => Promise<Response>
  const service = defineWebServer<WebServerOptions>((app) => {
    dispatch = createDispatch(app, trusted)
    app.post('/api/nexus/dispatch', event => request(event, () => dispatch(event.req)))
    app.get('/api/nexus/panel', getPanel)
    app.get('/api/nexus/sessions/:id/mailbox', getMailbox)
    app.post('/api/nexus/sessions/:id/mailbox/:messageId/handled', handleMail)
    app.get('/api/nexus/tickets/:id', getTicket)
    app.patch('/api/nexus/tickets/:id', patchTicket)
    app.post('/api/nexus/tickets/:id/:action', postTicket)
    app.post('/api/nexus/asks/:id/answers', postAnswer)
    app.patch('/api/nexus/projects/:id', patchProject)
    app.post('/api/nexus/projects/refresh', refreshProjects)
    app.patch('/api/nexus/settings', patchSettings)
    app.get('/api/nexus/sessions/:id/context', getContext)
  })
  const dispose = service(ctx, { ...options, owner: event => trusted.has(event.req) ? { kind: 'web', authenticated: true, userId: 'owner' } : options.owner(event) })
  try {
    const detach = ctx.connection.fetch.register({ path: '/api/nexus/dispatch', methods: ['POST'], requestBody: 'buffered', fetch: request => dispatch(request) })
    let closed = false
    return async () => {
      if (closed)
        return
      closed = true
      dispose()
      await detach()
    }
  }
  catch (error) {
    dispose()
    throw error
  }
}
