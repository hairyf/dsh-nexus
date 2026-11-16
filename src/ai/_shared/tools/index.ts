import * as channel from './channel'
import * as inbox from './inbox'
import * as ticket from './ticket'

/**
 * 只放**对任何角色都完全相同**的工具。
 *
 * 判定标准：schema 一样、返回内容一样，差异只在「当前会话能看到什么」——
 * 那是运行时按身份收窄，不是两个工具。
 *
 * 一旦某个角色的参数或返回和别人不同（例如 `list_ticket` 主编排能按 projectId 查、
 * 项目编排只能看自己），就**不要放这里**，在各自 `tools/` 下各写一份。
 */
export { channel, inbox, ticket }
