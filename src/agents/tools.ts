/**
 * 四个角色的工具。**一个工具只定义一次**，靠 `roles` 声明谁有它。
 *
 * 分四类：
 *   收件箱     —— 谁能被投递、能不能清空
 *   流转       —— 开票、派工、上报、求助
 *   Supervisor —— 跨项目协调
 *   渠道读写   —— 一对通用工具，细节由 `assets/skills/nexus-channel-<id>` 教
 */

import type { InboxTarget, ReportState, TicketStatus } from '../types'
import type { NexusTool, ToolContext } from './types'
import { arg } from './types'

// ── 收件箱 ──────────────────────────────────────────────────────────────

/** 收件箱。只有 main / project / supervisor 有 —— Worker 的话直接进会话。 */
const inboxList: NexusTool = {
  name: 'inbox_list',
  description: '看自己名下还有几条没处理的消息时用这个。kind=ask 的排最前，因为提问方那条工作线停着。',
  parameters: {
    type: 'object',
    properties: { detail: { type: 'boolean', description: 'true 给全文；默认只给摘要' } },
    additionalProperties: false,
  },
  roles: ['main', 'project', 'supervisor'],
  async run(input, ctx) {
    const page = await ctx.db.inbox.page()
    const mine = page.items.filter(item => item.type === ctx.role)
    const visible = ctx.role === 'project' && ctx.projectId
      ? mine.filter(item => item.projectId === ctx.projectId)
      : mine
    const full = arg.bool(input, 'detail') === true
    return {
      pending: visible.filter(item => item.status === 'pending').map(item => ({
        id: item.id,
        kind: item.kind,
        origin: item.origin,
        title: item.title,
        message: full ? item.message : item.message.slice(0, 300),
        createdAt: item.createdAt,
        escalations: item.escalations,
        ticketId: item.ticketId,
      })),
      stalled: visible.filter(item => item.status === 'stalled')
        .map(item => ({ id: item.id, error: item.deliveryError, attempts: item.deliveryAttempts })),
    }
  },
}

const inboxKill: NexusTool = {
  name: 'inbox_kill',
  description: '一条消息处理完之后标掉它。不需要先读，可以批量。',
  parameters: {
    type: 'object',
    properties: { ids: { type: 'array', items: { type: 'string' }, description: '要标掉的消息 id' } },
    required: ['ids'],
    additionalProperties: false,
  },
  roles: ['main', 'project', 'supervisor'],
  async run(input, ctx) {
    return { killed: await ctx.db.inbox.kill(arg.arr(input, 'ids')) }
  },
}

// ── 上报与求助 ──────────────────────────────────────────────────────────

/**
 * 汇报发到哪。
 *
 * 给了 `supervisorId` 就发给那个 Supervisor；否则按角色往上：
 * worker → project，project / supervisor → main。
 */
async function resolveTarget(ctx: ToolContext, supervisorId?: string): Promise<{
  type: InboxTarget
  projectId?: string
  supervisorId?: string
}> {
  if (supervisorId)
    return { type: 'supervisor', supervisorId }
  if (ctx.role === 'worker')
    return { type: 'project', projectId: ctx.projectId }
  return { type: 'main' }
}

const report: NexusTool = {
  name: 'report',
  description: '告诉上级「现在到哪一步」时用这个。发完继续干活，不等回复。要对方做决定请用 ask。',
  parameters: {
    type: 'object',
    properties: {
      state: {
        type: 'string',
        enum: ['progress', 'ready', 'failed', 'dropped'],
        description: 'progress 在跑 / ready 干完 / failed 失败 / dropped 不用做',
      },
      summary: { type: 'string', description: '一句话说清现在到哪，不要过程流水账' },
      supervisorId: { type: 'string', description: '这张票在某个 Supervisor 下时填它，上报就发到那边' },
      ticketId: { type: 'string', description: '只做溯源，不参与路由' },
    },
    required: ['state', 'summary'],
    additionalProperties: false,
  },
  roles: ['project', 'worker', 'supervisor'],
  async run(input, ctx) {
    const state = arg.req(input, 'state') as ReportState
    const summary = arg.req(input, 'summary')
    const ticketId = arg.str(input, 'ticketId') ?? ctx.ticketId
    const target = await resolveTarget(ctx, arg.str(input, 'supervisorId'))

    // Worker 的汇报同时更新自己那一行，面板才看得到
    if (ctx.role === 'worker' && ctx.workerId)
      await ctx.db.worker.report(ctx.workerId, state, summary)

    await ctx.db.inbox.push({
      type: target.type,
      origin: ctx.role,
      kind: 'ticket',
      message: summary,
      title: `${ctx.role} 汇报：${state}`,
      supervisorId: target.supervisorId,
      projectId: target.projectId,
      ticketId,
      workerId: ctx.workerId,
    })
    return { ok: true, to: target.type }
  },
}

const ask: NexusTool = {
  name: 'ask',
  description: '要上级给一句话才能继续时用这个。发完这条工作线停下，答案到了会被 prompt 回来。',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '要问的，写清背景和卡在哪' },
      supervisorId: { type: 'string', description: '这张票在某个 Supervisor 下时填它' },
      ticketId: { type: 'string', description: '只做溯源' },
    },
    required: ['question'],
    additionalProperties: false,
  },
  roles: ['project', 'worker', 'supervisor'],
  async run(input, ctx) {
    const target = await resolveTarget(ctx, arg.str(input, 'supervisorId'))
    const askId = await ctx.db.inbox.push({
      type: target.type,
      origin: ctx.role,
      kind: 'ask',
      message: arg.req(input, 'question'),
      title: `${ctx.role} 提问`,
      supervisorId: target.supervisorId,
      projectId: target.projectId,
      ticketId: arg.str(input, 'ticketId') ?? ctx.ticketId,
      workerId: ctx.workerId,
    })
    return { ok: true, askId, to: target.type }
  },
}

const escalate: NexusTool = {
  name: 'escalate',
  description: '下级问的那个问题我答不了，原样往上递时用这个。同一个问题换个人答，问题文本一个字都不改。',
  parameters: {
    type: 'object',
    properties: {
      askId: { type: 'string' },
      to: { type: 'string', enum: ['main', 'supervisor'], description: '默认 main' },
    },
    required: ['askId'],
    additionalProperties: false,
  },
  roles: ['project'],
  async run(input, ctx) {
    const askId = arg.req(input, 'askId')
    const to = (arg.str(input, 'to') ?? 'main') as InboxTarget
    await ctx.db.inbox.escalate(askId, to)
    return { ok: true, askId, to }
  },
}

const answer: NexusTool = {
  name: 'answer',
  description: '回答下级升上来的 ask 时用这个。填上答案就把那条置为已处理，并送回到发起方。',
  parameters: {
    type: 'object',
    properties: { askId: { type: 'string' }, text: { type: 'string', description: '回答本身，写清结论' } },
    required: ['askId', 'text'],
    additionalProperties: false,
  },
  roles: ['main', 'supervisor'],
  async run(input, ctx) {
    await ctx.db.inbox.answer(arg.req(input, 'askId'), arg.req(input, 'text'), ctx.role)
    return { ok: true }
  },
}

/** 只有主编排能问人 —— 它是唯一还有「人」这个上级的角色。 */
const askUser: NexusTool = {
  name: 'ask_user',
  description: '只有人能拍板时用这个。给 triggerId 就把问题发到那个渠道，不给就只在面板里问。',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      triggerId: { type: 'string', description: '决定发到哪个渠道；一条任务可以有多个来源，但一个问题只锚一条触发' },
    },
    required: ['question'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    const askId = await ctx.db.inbox.push({
      type: 'user',
      origin: 'main',
      kind: 'ask',
      message: arg.req(input, 'question'),
      title: '主编排提问',
      triggerId: arg.str(input, 'triggerId'),
    })
    return { ok: true, askId }
  },
}

// ── 任务与派工 ──────────────────────────────────────────────────────────

const listTasks: NexusTool = {
  name: 'list_tasks',
  description: '判重、看全局进度时用这个。attentionOnly 只列有 pending ask 的票。',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['waiting', 'queued', 'running', 'review', 'done', 'cancelled'] },
      attentionOnly: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  roles: ['main', 'project'],
  async run(input, ctx) {
    const board = await ctx.db.ticket.board()
    let tickets = board.tickets
    // 项目编排只看自己项目下的票
    if (ctx.role === 'project' && ctx.projectId) {
      const names = await ctx.db.project.nameMap()
      const own = names.get(ctx.projectId)
      if (own)
        tickets = tickets.filter(ticket => ticket.project === own)
    }
    const status = arg.str(input, 'status')
    if (status)
      tickets = tickets.filter(ticket => ticket.status === status)
    if (arg.bool(input, 'attentionOnly') === true)
      tickets = tickets.filter(ticket => ticket.attention)
    return { tickets, total: tickets.length }
  },
}

const triageThread: NexusTool = {
  name: 'triage_thread',
  description: '判一条话题归哪个项目（或者不用管）时用这个。只判一次，之后这个话题的触发直接进项目编排，不再打扰你。',
  parameters: {
    type: 'object',
    properties: {
      threadId: { type: 'string' },
      action: { type: 'string', enum: ['claim', 'ignore'] },
      projectId: { type: 'string', description: 'action=claim 时必填' },
    },
    required: ['threadId', 'action'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    const action = arg.req(input, 'action')
    await ctx.db.thread.triageTo(arg.req(input, 'threadId'), action === 'claim' ? 'claimed' : 'ignored', arg.str(input, 'projectId'))
    return { ok: true, action }
  },
}

const createTicket: NexusTool = {
  name: 'create_ticket',
  description: '确认要做这件事、要开一张票时用这个。初始状态 waiting，等派工。',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      projectId: { type: 'string' },
      threadIds: { type: 'array', items: { type: 'string' }, description: '触发它的话题' },
      description: { type: 'string' },
    },
    required: ['title', 'projectId', 'threadIds'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    const now = new Date().toISOString()
    const id = await ctx.db.ticket.nextId()
    const channel = await ctx.db.selectFrom('channel').select('id').executeTakeFirst()
    await ctx.db.ticket.create({
      id,
      projectId: arg.req(input, 'projectId'),
      channelId: channel?.id ?? 'github',
      title: arg.req(input, 'title'),
      description: arg.str(input, 'description') ?? null,
      status: 'waiting',
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endedAt: null,
      prUrl: null,
      prState: null,
      ciState: null,
      prepareError: null,
    })
    for (const threadId of arg.arr(input, 'threadIds')) {
      await ctx.db.ticketThread.create({ ticketId: id, threadId, createdAt: now })
    }
    return { ok: true, ticketId: id }
  },
}

const dispatchTicket: NexusTool = {
  name: 'dispatch_ticket',
  description: '把票派给项目编排时用这个。',
  parameters: {
    type: 'object',
    properties: { ticketId: { type: 'string' }, message: { type: 'string' } },
    required: ['ticketId'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    const ticketId = arg.req(input, 'ticketId')
    const ticket = await ctx.db.ticket.detail(ticketId)
    if (!ticket)
      throw new Error(`任务 ${ticketId} 不存在`)
    const projects = await ctx.db.project.nameMap()
    const projectId = [...projects.entries()].find(([, name]) => name === ticket.project)?.[0]
    const inboxId = await ctx.db.inbox.push({
      type: 'project',
      origin: 'main',
      kind: 'ticket',
      message: arg.str(input, 'message') ?? `${ticket.id} ${ticket.title}`,
      title: '主编排派工',
      ticketId,
      projectId,
    })
    await ctx.db.ticket.setStatus(ticketId, 'queued')
    return { ok: true, inboxId }
  },
}

const linkThread: NexusTool = {
  name: 'link_thread',
  description: '新触发属于一张已有票时用这个。挂上去之后那条话题的未来触发就自动归这张票 —— 这是去重的唯一手段。',
  parameters: {
    type: 'object',
    properties: { ticketId: { type: 'string' }, threadId: { type: 'string' } },
    required: ['ticketId', 'threadId'],
    additionalProperties: false,
  },
  roles: ['project', 'worker'],
  async run(input, ctx) {
    const ticketId = arg.str(input, 'ticketId') ?? ctx.ticketId
    if (!ticketId)
      throw new Error('缺少 ticketId')
    await ctx.db.ticketThread.create({ ticketId, threadId: arg.req(input, 'threadId'), createdAt: new Date().toISOString() })
    return { ok: true }
  },
}

const updateTicket: NexusTool = {
  name: 'update_ticket',
  description: '票的状态、PR、CI 变了时用这个。',
  parameters: {
    type: 'object',
    properties: {
      ticketId: { type: 'string' },
      status: { type: 'string', enum: ['waiting', 'queued', 'running', 'review', 'done', 'cancelled'] },
      prUrl: { type: 'string' },
      prState: { type: 'string', enum: ['open', 'merged', 'closed'] },
      ciState: { type: 'string', enum: ['pending', 'running', 'passing', 'failing'] },
    },
    required: ['ticketId'],
    additionalProperties: false,
  },
  roles: ['project'],
  async run(input, ctx) {
    const ticketId = arg.req(input, 'ticketId')
    const status = arg.str(input, 'status')
    if (status)
      await ctx.db.ticket.setStatus(ticketId, status as TicketStatus)

    const patch: Record<string, string> = {}
    for (const key of ['prUrl', 'prState', 'ciState'] as const) {
      const value = arg.str(input, key)
      if (value)
        patch[key] = value
    }
    if (Object.keys(patch).length) {
      await ctx.db.updateTable('ticket')
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where('id', '=', ticketId)
        .execute()
    }
    return { ok: true }
  },
}

// ── 指挥 Worker ─────────────────────────────────────────────────────────

const createWorker: NexusTool = {
  name: 'create_worker',
  description: '一张票该开跑时用这个。建 worktree + 分支 + 会话，写 Worker 一行。槽位满了就留在 queued。',
  parameters: {
    type: 'object',
    properties: {
      ticketId: { type: 'string' },
      branch: { type: 'string', description: '末段必须是任务号，例如 nexus/T-105' },
    },
    required: ['ticketId'],
    additionalProperties: false,
  },
  roles: ['project'],
  async run(input, ctx) {
    const ticketId = arg.req(input, 'ticketId')
    const ticket = await ctx.db.ticket.detail(ticketId)
    if (!ticket)
      throw new Error(`任务 ${ticketId} 不存在`)

    const [holding, max] = await Promise.all([ctx.db.worker.holdingSlots(), ctx.db.setting.maxWorkers()])
    if (holding >= max)
      return { ok: false, reason: `槽位已满（${holding}/${max}），票留在 queued` }

    const branch = arg.str(input, 'branch') ?? `nexus/${ticketId}`
    const sessionId = ctx.sessions
      ? await ctx.sessions.create({ cwd: ticket.project, preset: 'worker', title: `${ticketId} ${ticket.title}` })
      : `worker-${ticketId}`
    const now = new Date().toISOString()
    await ctx.db.worker.create({
      id: sessionId,
      ticketId,
      status: 'running',
      createdAt: now,
      startedAt: now,
      endedAt: null,
      title: `${ticketId} ${ticket.title}`,
      endedReason: null,
      branch,
      worktree: null,
      reportState: null,
      report: null,
      reportAt: null,
      backgroundUntil: null,
      recoveryNote: null,
    })
    await ctx.db.ticket.setStatus(ticketId, 'running')
    return { ok: true, workerId: sessionId, branch }
  },
}

const send: NexusTool = {
  name: 'send',
  description: '要跟某个 Worker 说话时用这个。默认 queue；只有确定它正把事情做错、需要立刻止损才用 interrupt。',
  parameters: {
    type: 'object',
    properties: {
      workerId: { type: 'string' },
      text: { type: 'string' },
      mode: { type: 'string', enum: ['queue', 'interrupt', 'reply'] },
    },
    required: ['workerId', 'text'],
    additionalProperties: false,
  },
  roles: ['project'],
  async run(input, ctx) {
    if (!ctx.sessions)
      throw new Error('当前环境没有会话能力，无法给 Worker 发消息')
    const mode = arg.str(input, 'mode') ?? 'queue'
    await ctx.sessions.prompt(arg.req(input, 'workerId'), arg.req(input, 'text'), mode === 'interrupt' ? 'steer' : 'queue')
    return { ok: true, mode }
  },
}

const viewWorker: NexusTool = {
  name: 'view',
  description: '想知道 Worker 最后说了什么时用这个。它不是 report —— report 是结构化状态，view 是正文。',
  parameters: {
    type: 'object',
    properties: { workerId: { type: 'string' }, offset: { type: 'number' } },
    required: ['workerId'],
    additionalProperties: false,
  },
  roles: ['project'],
  async run(input, ctx) {
    if (!ctx.sessions)
      throw new Error('当前环境没有会话能力，无法读 Worker 正文')
    return { text: await ctx.sessions.view(arg.req(input, 'workerId'), arg.num(input, 'offset')) }
  },
}

const cancel: NexusTool = {
  name: 'cancel',
  description: '一个 Worker 跑飞了或者需求废了时用这个。keepInbox=false 连它排队中的消息一起丢。',
  parameters: {
    type: 'object',
    properties: { workerId: { type: 'string' }, keepInbox: { type: 'boolean' } },
    required: ['workerId'],
    additionalProperties: false,
  },
  roles: ['project'],
  async run(input, ctx) {
    if (!ctx.sessions)
      throw new Error('当前环境没有会话能力，无法中止 Worker')
    const workerId = arg.req(input, 'workerId')
    await ctx.sessions.stop(workerId)
    await ctx.db.worker.end(workerId, 'stopped')
    return { ok: true }
  },
}

const rename: NexusTool = {
  name: 'rename',
  description: '想让面板上一眼看懂这个会话在干嘛时用这个。',
  parameters: {
    type: 'object',
    properties: { workerId: { type: 'string' }, title: { type: 'string' } },
    required: ['workerId', 'title'],
    additionalProperties: false,
  },
  roles: ['project'],
  async run(input, ctx) {
    const workerId = arg.req(input, 'workerId')
    const title = arg.req(input, 'title')
    await ctx.db.worker.rename(workerId, title)
    if (ctx.sessions)
      await ctx.sessions.rename(workerId, title)
    return { ok: true }
  },
}

// ── Supervisor ──────────────────────────────────────────────────────────

const supervisorList: NexusTool = {
  name: 'supervisor_list',
  description: '想知道跨项目的事归谁协调时用这个。',
  parameters: {
    type: 'object',
    properties: { status: { type: 'string', enum: ['active', 'closed'] } },
    additionalProperties: false,
  },
  roles: ['main', 'project'],
  async run(_input, ctx) {
    const rows = await ctx.db.supervisor.active()
    return {
      supervisors: rows.map(row => ({
        id: row.id,
        title: row.title,
        reason: row.reason,
        status: row.status,
        createdAt: row.createdAt,
      })),
    }
  },
}

const createSupervisor: NexusTool = {
  name: 'create_supervisor',
  description: '一件工作跨两个以上项目、必须有人协调时才用这个。它是临时工，用完就消失，不是「更大的项目编排」。',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      reason: { type: 'string', description: '写清卡在哪' },
      ticketIds: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'reason', 'ticketIds'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    const now = new Date().toISOString()
    const id = `S-${Date.now().toString(36)}`
    const sessionId = ctx.sessions
      ? await ctx.sessions.create({ cwd: '.', preset: 'supervisor', title: arg.req(input, 'title') })
      : null
    await ctx.db.supervisor.create({
      id,
      sessionId,
      title: arg.req(input, 'title'),
      reason: arg.req(input, 'reason'),
      status: 'active',
      createdAt: now,
      closedAt: null,
    })
    for (const ticketId of arg.arr(input, 'ticketIds')) {
      await ctx.db.supervisorTicket.attach(id, ticketId)
    }
    return { ok: true, supervisorId: id }
  },
}

const closeSupervisor: NexusTool = {
  name: 'close_supervisor',
  description: 'Supervisor 做完了或者多余时用这个。关联工单退回各自项目编排。',
  parameters: {
    type: 'object',
    properties: { supervisorId: { type: 'string' } },
    required: ['supervisorId'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    await ctx.db.supervisor.close(arg.req(input, 'supervisorId'))
    return { ok: true }
  },
}

const attachTicket: NexusTool = {
  name: 'attach_ticket_to_supervisor',
  description: 'Supervisor 要扩大范围时用它加票。会自动通知该项目编排。',
  parameters: {
    type: 'object',
    properties: { supervisorId: { type: 'string' }, ticketId: { type: 'string' } },
    required: ['supervisorId', 'ticketId'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    const supervisorId = arg.req(input, 'supervisorId')
    const ticketId = arg.req(input, 'ticketId')
    await ctx.db.supervisorTicket.attach(supervisorId, ticketId)
    const ticket = await ctx.db.ticket.detail(ticketId)
    const projects = await ctx.db.project.nameMap()
    const projectId = [...projects.entries()].find(([, name]) => name === ticket?.project)?.[0]
    await ctx.db.inbox.push({
      type: 'project',
      origin: 'system',
      kind: 'notice',
      message: `${ticketId} 已加入 Supervisor ${supervisorId} 的协调范围`,
      title: '范围调整',
      ticketId,
      projectId,
    })
    return { ok: true }
  },
}

const detachTicket: NexusTool = {
  name: 'detach_ticket_from_supervisor',
  description: 'Supervisor 要缩小范围时用它移出票。票退回原项目编排，不取消 —— 取消是人的决定。',
  parameters: {
    type: 'object',
    properties: { supervisorId: { type: 'string' }, ticketId: { type: 'string' } },
    required: ['supervisorId', 'ticketId'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    await ctx.db.supervisorTicket.detach(arg.req(input, 'supervisorId'), arg.req(input, 'ticketId'))
    return { ok: true }
  },
}

/** Supervisor 自己的工具。 */
const listTickets: NexusTool = {
  name: 'list_tickets',
  description: '每次醒来第一件事就调它 —— 不能只信收件箱里那一条消息。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  roles: ['supervisor'],
  async run(_input, ctx) {
    if (!ctx.supervisorId)
      throw new Error('缺少 supervisorId')
    return { tickets: await ctx.db.supervisor.ticketsOf(ctx.supervisorId) }
  },
}

const dispatchToProject: NexusTool = {
  name: 'dispatch_to_project',
  description: '要给某个项目派活或推进时用这个。',
  parameters: {
    type: 'object',
    properties: { projectId: { type: 'string' }, ticketId: { type: 'string' }, message: { type: 'string' } },
    required: ['projectId', 'message'],
    additionalProperties: false,
  },
  roles: ['supervisor'],
  async run(input, ctx) {
    const inboxId = await ctx.db.inbox.push({
      type: 'project',
      origin: 'supervisor',
      kind: 'ticket',
      message: arg.req(input, 'message'),
      title: 'Supervisor 派工',
      projectId: arg.req(input, 'projectId'),
      ticketId: arg.str(input, 'ticketId'),
    })
    return { ok: true, inboxId }
  },
}

const linkDependency: NexusTool = {
  name: 'link_dependency',
  description: '发现「谁等谁」时用这个。方向永远是后来的指向先要做的。写进库里，不要只记在脑子里 —— 你随时可能被重启。',
  parameters: {
    type: 'object',
    properties: {
      ticketId: { type: 'string', description: '要等的票' },
      dependsOn: { type: 'string', description: '先要完成的票' },
    },
    required: ['ticketId', 'dependsOn'],
    additionalProperties: false,
  },
  roles: ['supervisor'],
  async run(input, ctx) {
    await ctx.db.ticketLink.create({
      ticketId: arg.req(input, 'ticketId'),
      relatedId: arg.req(input, 'dependsOn'),
      kind: 'depends',
      createdAt: new Date().toISOString(),
    })
    return { ok: true }
  },
}

const closeSelf: NexusTool = {
  name: 'close_self',
  description: '关联的票全部到终态时用这个。有票没到终态就不许收工。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  roles: ['supervisor'],
  async run(_input, ctx) {
    if (!ctx.supervisorId)
      throw new Error('缺少 supervisorId')
    if (!await ctx.db.supervisor.settled(ctx.supervisorId)) {
      return { ok: false, reason: '还有票没到终态，不能收工' }
    }
    await ctx.db.supervisor.close(ctx.supervisorId)
    return { ok: true }
  },
}

// ── 项目与工作区 ────────────────────────────────────────────────────────

const listUnboundWorkspaces: NexusTool = {
  name: 'list_unbound_workspaces',
  description: '想知道哪些工作区还没绑项目时用这个。绑之前先用它看一眼，别猜工作区 id。',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  roles: ['main'],
  async run(_input, ctx) {
    if (!ctx.workspaces)
      throw new Error('当前环境没有工作区能力')
    const [all, bound] = await Promise.all([ctx.workspaces.list(), ctx.db.project.boundWorkspaceIds()])
    return { workspaces: all.filter(workspace => !bound.has(workspace.workspaceId)) }
  },
}

const createProject: NexusTool = {
  name: 'create_project',
  description: '要给一个还没进系统的新仓库建立项目时用这个。会新建目录并注册成工作区。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '仓库全名，例如 owner/repo' },
      channelId: { type: 'string', description: '挂在哪条 git 渠道下' },
      directory: { type: 'string', description: '本地克隆目录的绝对路径' },
    },
    required: ['name', 'channelId', 'directory'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    if (!ctx.workspaces)
      throw new Error('当前环境没有工作区能力，无法注册工作区')
    const created = await ctx.db.project.createStandalone({
      name: arg.req(input, 'name'),
      channelId: arg.req(input, 'channelId'),
      directory: arg.req(input, 'directory'),
    })
    return { ok: true, projectId: created.id, workspaceId: created.workspaceId }
  },
}

const createInWorkspaceProject: NexusTool = {
  name: 'create_in_workspace_project',
  description: '已经有工作区、要把它绑成项目时用这个。先 list_unbound_workspaces 拿到 id，不要猜。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '仓库全名，例如 owner/repo' },
      channelId: { type: 'string' },
      workspaceId: { type: 'string', description: '已有的工作区 id' },
    },
    required: ['name', 'channelId', 'workspaceId'],
    additionalProperties: false,
  },
  roles: ['main'],
  async run(input, ctx) {
    if (!ctx.workspaces)
      throw new Error('当前环境没有工作区能力')
    const workspaceId = arg.req(input, 'workspaceId')
    const all = await ctx.workspaces.list()
    const target = all.find(workspace => workspace.workspaceId === workspaceId)
    if (!target)
      throw new Error(`工作区 ${workspaceId} 不存在`)
    const created = await ctx.db.project.createBound({
      name: arg.req(input, 'name'),
      channelId: arg.req(input, 'channelId'),
      workspaceId,
      directory: target.path,
    })
    return { ok: true, projectId: created.id, directory: target.path }
  },
}

// ── 渠道读写 ────────────────────────────────────────────────────────────

const readChannel: NexusTool = {
  name: 'read_channel',
  description: '要读渠道原文（issue、PR、消息、CI）时用这个。路径写法见对应的 nexus-channel-<id> skill。',
  parameters: {
    type: 'object',
    properties: {
      resource: { type: 'string', description: '例如 github/pulls/81/thread/123、github/issues/42/thread、trigger/<id>' },
      offset: { type: 'number', description: '本地翻页位置；0 重新读，之后的 offset 读同一份快照' },
      limit: { type: 'number', description: '一页条数，默认 20，上限 50' },
    },
    required: ['resource'],
    additionalProperties: false,
  },
  roles: ['main', 'project', 'worker', 'supervisor'],
  async run(input, ctx) {
    const resource = arg.req(input, 'resource')
    const limit = Math.min(arg.num(input, 'limit') ?? 20, 50)
    const [prefix, ...rest] = resource.split('/')

    if (prefix === 'trigger') {
      const row = await ctx.db.trigger.findUnique(rest.join('/')).catch(() => undefined)
      if (!row)
        throw new Error(`触发 ${resource} 不存在`)
      return { items: [row], next_offset: null, next_resource: null }
    }
    if (prefix === 'thread') {
      const page = await ctx.db.thread.page(rest.join('/'))
      return { items: page.triggers.slice(0, limit), next_offset: null, next_resource: null }
    }
    if (prefix === 'ticket') {
      const detail = await ctx.db.ticket.detail(rest.join('/'))
      if (!detail)
        throw new Error(`任务 ${resource} 不存在`)
      return { items: [detail], next_offset: null, next_resource: null }
    }
    // 渠道原文要走各渠道自己的 provider。这里明确报错，不静默返回空数组。
    throw new Error(`渠道原文 ${resource} 需要 nexus-channel-${prefix} 的 provider 实现`)
  },
}

const replyChannel: NexusTool = {
  name: 'reply_channel',
  description: '要以 bot 身份在渠道里发言时用这个。锚点是 triggerId —— 不用猜该发到哪个会话。',
  parameters: {
    type: 'object',
    properties: {
      triggerId: { type: 'string' },
      text: { type: 'string', description: '100 词以内，像人话，不重复对方说过的' },
    },
    required: ['triggerId', 'text'],
    additionalProperties: false,
  },
  roles: ['main', 'project', 'worker'],
  async run(input) {
    // 真正的发送要各渠道 provider 去做；这里只校验参数，避免静默成功。
    throw new Error(`发往触发 ${arg.req(input, 'triggerId')} 需要该渠道的 provider 实现`)
  },
}

/** 全部工具。注册与查询都从这里取，不各自维护清单。 */
export const TOOLS: readonly NexusTool[] = [
  inboxList,
  inboxKill,
  report,
  ask,
  escalate,
  answer,
  askUser,
  listTasks,
  triageThread,
  createTicket,
  dispatchTicket,
  linkThread,
  updateTicket,
  createWorker,
  send,
  viewWorker,
  cancel,
  rename,
  supervisorList,
  createSupervisor,
  closeSupervisor,
  attachTicket,
  detachTicket,
  listTickets,
  dispatchToProject,
  linkDependency,
  closeSelf,
  listUnboundWorkspaces,
  createProject,
  createInWorkspaceProject,
  readChannel,
  replyChannel,
]

/** 某个角色能用的工具。 */
export function toolsFor(role: string): NexusTool[] {
  return TOOLS.filter(tool => (tool.roles as readonly string[]).includes(role))
}
