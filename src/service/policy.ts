import type { Actor, DecisionType, PolicySnapshot, Role } from '../types/ledger'
import { defineService } from '../utils/service'

export const policy = defineService({
  resolve(snapshot: PolicySnapshot, initiator: Role, decision: DecisionType, withinAuthorization: boolean, hasSupervisor = false): 'human' | 'main' | 'project' | 'supervisor' {
    if (initiator === 'main' || initiator === 'supervisor' || !withinAuthorization)
      return 'human'
    let human: boolean
    if (decision === 'merge') {
      human = snapshot.mergePolicy === 'human_required'
        || (snapshot.mergePolicy === 'follow_question_level' && snapshot.questionLevel !== 'automatic')
    }
    else {
      human = snapshot.questionLevel === 'detailed'
        || (snapshot.questionLevel === 'important' && decision !== 'ordinary')
    }
    if (human)
      return 'human'
    return initiator === 'worker' ? 'project' : hasSupervisor ? 'supervisor' : 'main'
  },
  peek(actor: Actor, whitelist: readonly string[]): boolean {
    if (actor.kind === 'web')
      return actor.authenticated && actor.userId.trim().length > 0
    if (actor.kind !== 'github')
      return false
    return actor.verified && !!actor.providerId && !!actor.login && !actor.bot && !actor.outbound
      && !actor.login.toLowerCase().endsWith('[bot]')
      && whitelist.some(login => login.trim().toLowerCase() === actor.login.toLowerCase())
  },
})
