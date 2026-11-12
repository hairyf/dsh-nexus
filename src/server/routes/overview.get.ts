/** 概览：三段统计 + 最近任务 + 层级关系图。 */
import type { GraphEdge, GraphNode, OverviewView } from '../../types'
import { defineEventHandler } from 'h3'
import { db } from '../../database/index'

export const overviewHandler = defineEventHandler(async (): Promise<OverviewView> => {
  const [channels, tickets, received24h, recent, projects, supervisors] = await Promise.all([
    db.channel.summary(),
    db.ticket.statusCounts(),
    db.trigger.receivedSince(new Date(Date.now() - 24 * 3600_000).toISOString()),
    db.ticket.recent(8),
    db.project.findMany() as Promise<Array<{ id: string, name: string }>>,
    db.supervisor.active(),
  ])

  const nodes: GraphNode[] = [{ id: 'main', kind: 'main', label: '主编排' }]
  const edges: GraphEdge[] = []

  for (const channel of channels) {
    nodes.push({
      id: `channel:${channel.id}`,
      kind: 'channel',
      label: channel.name,
      detail: channel.enabled ? `监听中 · ${channel.threads} 个话题` : '已关闭',
    })
    if (channel.enabled)
      edges.push({ from: `channel:${channel.id}`, to: 'main', kind: 'trigger', label: 'trigger' })
  }

  for (const project of projects) {
    nodes.push({ id: `project:${project.id}`, kind: 'project', label: project.name })
    edges.push({ from: 'main', to: `project:${project.id}`, kind: 'dispatch', label: 'dispatch' })
  }

  for (const supervisor of supervisors) {
    nodes.push({
      id: `supervisor:${supervisor.id}`,
      kind: 'supervisor',
      label: supervisor.title,
      detail: '临时协调者',
    })
    edges.push({ from: 'main', to: `supervisor:${supervisor.id}`, kind: 'supervise', label: 'supervise' })
  }

  for (const ticket of recent) {
    nodes.push({
      id: `ticket:${ticket.id}`,
      kind: 'ticket',
      label: `${ticket.id} ${ticket.title}`,
      detail: ticket.status,
      ...ticket.attention ? { attention: true } : {},
    })
    edges.push({ from: `project:${ticket.project}`, to: `ticket:${ticket.id}`, kind: 'delegate' })
  }

  return {
    stats: { channels, received24h, filtered24h: 0, tickets },
    recent,
    graph: { nodes, edges },
  }
})
