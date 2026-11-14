import { describe, expect, it } from 'vitest'
import { store, tabOf } from '../src/client/store'

describe('task detail navigation', () => {
  it('opens the selected task from overview and highlights the tasks tab', () => {
    const instance = store.create()
    instance.actions.openTicket('T-105')
    const navigation = instance.getSnapshot().navigation
    expect(navigation).toEqual({ page: 'ticket/detail', ticketId: 'T-105', returnTo: 'overview' })
    expect(tabOf(navigation.page)).toBe('ticket')
  })

  it('returns to the task list when a task was opened there and clears stale selection', () => {
    const instance = store.create()
    instance.actions.go('ticket')
    instance.actions.openTicket('T-104')
    expect(instance.getSnapshot().navigation.returnTo).toBe('ticket')
    instance.actions.go(instance.getSnapshot().navigation.returnTo)
    expect(instance.getSnapshot().navigation).toEqual({ page: 'ticket', ticketId: null, returnTo: 'ticket' })
  })

  it('preserves the overview graph selection when leaving and returning from task details', () => {
    const instance = store.create()
    instance.actions.setOverviewView('hierarchy')
    instance.actions.selectAgent('task-106')
    instance.actions.openTicket('T-106')
    instance.actions.go(instance.getSnapshot().navigation.returnTo)
    expect(instance.getSnapshot().navigation.page).toBe('overview')
    expect(instance.getSnapshot().overview.view).toBe('hierarchy')
    expect(instance.getSnapshot().graph.selectedId).toBe('task-106')
  })

  it('keeps the original return page while following related tasks in details', () => {
    const instance = store.create()
    instance.actions.openTicket('T-106')
    instance.actions.openTicket('T-105')
    expect(instance.getSnapshot().navigation).toEqual({ page: 'ticket/detail', ticketId: 'T-105', returnTo: 'overview' })
    instance.actions.go(instance.getSnapshot().navigation.returnTo)
    expect(instance.getSnapshot().navigation.page).toBe('overview')
  })

  it('keeps routing and graph state isolated between mounted stores', () => {
    const first = store.create()
    const second = store.create()
    first.actions.openTicket('T-107')
    first.actions.panGraph(20, -10)
    expect(second.getSnapshot().navigation).toEqual({ page: 'overview', ticketId: null, returnTo: 'overview' })
    expect(second.getSnapshot().graph).toEqual({ zoom: 1, x: 0, y: 0, selectedId: null })
  })
})

describe('graph viewport', () => {
  it('clamps repeated zoom changes and resets pan with fit-to-view', () => {
    const instance = store.create()
    for (let i = 0; i < 20; i++)
      instance.actions.zoomGraph(0.2)
    expect(instance.getSnapshot().graph.zoom).toBe(2)
    for (let i = 0; i < 20; i++)
      instance.actions.zoomGraph(-0.2)
    expect(instance.getSnapshot().graph.zoom).toBe(0.5)
    instance.actions.panGraph(120, -40)
    instance.actions.panGraph(-20, 15)
    expect(instance.getSnapshot().graph).toMatchObject({ x: 100, y: -25 })
    instance.actions.resetGraph()
    expect(instance.getSnapshot().graph).toEqual({ zoom: 1, x: 0, y: 0, selectedId: null })
  })
})
