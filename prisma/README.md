# Nexus 账本与策略

Spec 01 的领域写入口是 `src/service/ledger.ts`，纯策略入口是 `src/service/policy.ts`。它们均使用单一 `defineService` 导出；下游不得直接改工单状态、复制路由策略或把模型正文当作身份。领域类型在 `src/types/ledger.ts`，生成的 Kysely 读类型在 `src/database/types.ts`。

## 初始化与隔离

只在宿主显式激活时调用 `await openDatabase(resolveDataDirectory(options, dshHome, profileDirectory))`，退出时调用返回句柄的 `close()`。导入数据库模块不打开文件、不迁移。`options.dataDir` 必须是绝对路径，显式配置优先；无显式配置时，可由宿主传入 `profileContext.dir`，默认存于其 `storages/nexus` 子目录；无 profile 上下文则以 `DSH_HOME`（缺省用户 DSH home）为根。这个模块不读取真实用户目录，也不自行查找 profile；Spec 06 负责传入可信宿主值。

初始化失败抛 `LedgerError`，错误码区分 `invalid_config`、`unavailable` 和 `migration_failed`。关闭/缺失句柄抛 `not_initialized`。迁移与版本记录、外键核验在同一 SQLite 事务中完成，任一失败关闭句柄并回滚；调用方不得启动派工或外部写操作。已知旧 Kysely 版本记录直接延续；没有版本记录的原始旧库只有在所有基线表的实际列结构吻合后才被接纳。不会删除或重建用户库。

## 权威迁移与生成链

- `prisma/migrations/20261113135519/migration.sql` 是不可修改的旧基线。
- `prisma/migrations/20261116000100_ledger_policy/migration.sql` 是本次前向迁移。
- `pnpm run prisma:migrate` 只把已有 SQL 链搬运成 `src/database/migrations.ts`，不再删除开发数据库，也不隐式创建迁移。
- `pnpm run prisma:generate` 从 `prisma/schema/` 生成 `src/database/types.ts`。
- 新增结构时先用 Prisma migrate diff 产生 SQL，再补数据迁移规则；提交 schema、SQL 和两个生成物。Prisma CLI 的开发 datasource 仅用于开发核验，不是运行时状态目录。

旧项目不按显示名或 channel 猜仓库，全部保留原 ID、工作区、会话与历史引用，记录原 channel 身份证据，禁用并标记 `repository_identity_unverified`；人工确认仓库后才能启用。旧工单固定补 `important + human_required`；旧全局设置无论 autoMerge 原值为何都转 `human_required`。新安装默认 `important + follow_question_level`、4 个 Worker、10 分钟提醒。已结束工单不补验收或批准。

旧 Inbox 被迁成同 ID 的 Message；其中问题另迁成同 ID 的唯一 Ask，保留来源、问题、历史答案、回答角色快照及升级次数/时间。所有消息种类均保留 triggerId、threadId、title 外键/字段和不可变来源 JSON，不只为 Ask 留来源。历史 `user` 不转成已核验的人，无法核实的旧收件地址显式标记待恢复；旧 Inbox 表删除，不保留第二份答案。历史顺序按旧 seq、时间、ID 稳定归一，不让旧的重复 seq 导致丢消息。只有新流程的显式决定、当前验收证据与真实 merged 事实能完成新的交付。

## 信任边界与下游须知

`Actor` 只能由认证后的 Web 入口、已验证的提供方事件或已登记 DSH 会话构造，不能从工具参数、模型正文或 preset 名称构造。GitHub 身份保存 provider ID 与 login 快照；白名单每次重新检查，机器人、出站回流和代理均不能冒充人。非白名单正文仍可入上下文，但 `recordTrigger` 的 `authorized=false`；重复来源事件返回 `accepted=false`，不能重新处理成新授权。

`bindRole`、`recordPullRequest`、`updateMessage`、`updateOutbox`、提醒写入是可信宿主/适配器事实入口，不是可直接暴露给模型的工具。main/project 的初始责任绑定可由宿主启动建立；worker 必须传入本项目 project 的可信 Actor（或已认证人工），supervisor 必须传 main/人工。同票主 Worker、main 和项目责任由数据库唯一键约束，未核实关闭的旧执行仍占责任。新 worker 还受全局并发、人的暂停、项目可用性、既有授权和成功依赖约束；这里不启动任何会话。

`recordPullRequest` 只记录适配器核实的远端事实，不执行合并，也不产生批准。外部 merged 缺决定会保留 merged 并显示待核验。执行外部合并前调用 `resolveMerge`，第四参必须是本次核实的仓库要求结果；旧的 answered 状态、任意肯定文字、过期 head 或后来收紧的策略都不是许可。完成工单必须显式调用 `advanceTicket(..., 'complete', ...)`，ready/会话结束只转 review。

Thread 的 repository 是持久事实；分诊、订阅和发布均按同一仓库身份核验。历史未知身份保持 `repository_identity_unverified`，不能根据显示名或项目归属字段猜仓库。

执行入口统一使用 `dispatchTicket` 受理 queued、`startTicket` 原子记录 Ticket.running/首次 startedAt 与 Worker 运行事实、`retryTicket` 在确认旧 Worker 关闭后重新排队；均校验 project/人工授权、项目可用、暂停、依赖与待答问题，不改变既有工单授权。`ticket_transition` 保留操作者、原因、前后状态与执行绑定。`updateBinding` 不能把 idle Worker 直接改成 running 来绕过实际启动入口。

正式答案必须回传当前 `policyBasis`，一次事务内结清 Ask 并写入回送消息。升级沿用原 askId；实质目标变化会取消旧 pending Ask，已答旧决定保留但不能用于新目标。已读和处理完通知均不回答 Ask。Ask.initiatorBinding 保留原发起者审计，responseRecipient 保存已核验的当前回送责任；transferMessages 必须核验 previousBindingId、同角色/范围和旧会话关闭，并在同一事务迁移该回送地址。发起方尚未恢复时，答案仍一次性落账，回送消息显式失败为 initiator_requires_recovery，恢复后移交原消息，不要求重答。

Message 的 acceptedAt、deliveredAt、readAt、handledAt 是不同事实。同票同收件责任按 seq 保序，不同票互不阻塞。失败保留次数、原因、重试时间；角色替换只能显式移交相同责任的未读消息和 pending Ask。策略变更或升级改变 handler 时，在同一事务将旧待办标为 superseded 并向新责任人落一条 pending 投递；消费方必须排除 supersededAt 非空的消息，原 readAt/handledAt 不伪造为已处理。handler 不变的策略编辑不额外造通知。不可用的处理者会在创建/升级/策略重路由前被拒绝，整次写入回滚。Outbox 的 unknown 必须由适配器先核对远端关联，不能盲目重发；sent 需要远端 ID，已知成功不能再次发送。

只在成功新交付时写 dependency satisfaction 与 durable wakeup，历史 done、failed、cancelled 不冒充成功。Attention 保存等待依据、有效进展时间、提醒目标/时间、失败、升级与处置；它不负责定时器，不改变 Ask、暂停或授权。

## 导出的共享判断与账本签名

以下方法均为同步账本操作，数据库打开为异步。`Row<T>` 是生成的 Kysely Selectable 类型；输入类型取自 `src/types/ledger.ts`。load 仅接收确有 id 主键的 IdTable；复合主键事实通过 list 或其专用领域方法访问，不能假装存在 id 列。

```text
openDatabase(stateDirectory: string): Promise<NexusDatabase>
resolveDataDirectory(options?: { dataDir?: string }, dshHome?: string, profileDirectory?: string): string
policy.resolve(snapshot: PolicySnapshot, initiator: Role, decision: DecisionType, withinAuthorization: boolean, hasSupervisor?: boolean): 'human' | 'main' | 'project' | 'supervisor'
policy.peek(actor: Actor, whitelist: readonly string[]): boolean
load<T extends IdTable>(database: NexusDatabase, table: T, id: string): Row<T> | null
list<T extends keyof DB>(database: NexusDatabase, table: T): Row<T>[]
getSettings(database: NexusDatabase): Row<'setting'>
updateSettings(database: NexusDatabase, patch: SettingsPatch, actor: Actor): Row<'setting'>
createProject(database: NexusDatabase, input: ProjectInput): Row<'project'>
updateProject(database: NexusDatabase, id: string, enabled: boolean, actor: Actor): Row<'project'>
createTicket(database: NexusDatabase, input: TicketInput, actor: Actor): Row<'ticket'>
authorizeTicket(database: NexusDatabase, ticketId: string, authorization: string, acceptanceCriteria: string, reason: string, actor: Actor): Row<'ticket'>
setPolicy(database: NexusDatabase, ticketId: string, snapshot: PolicySnapshot, reason: string, actor: Actor): Row<'ticket'>
bindRole(database: NexusDatabase, input: BindingInput, actor?: Actor): Row<'role_binding'>
updateBinding(database: NexusDatabase, id: string, status: 'idle' | 'running' | 'unavailable' | 'closed', reason: string): Row<'role_binding'>
createAsk(database: NexusDatabase, input: AskInput, actor: Actor): Row<'ask'>
escalateAsk(database: NexusDatabase, askId: string, actor: Actor): Row<'ask'>
answerAsk(database: NexusDatabase, input: AnswerInput, actor: Actor): Row<'ask'>
cancelAsk(database: NexusDatabase, askId: string, reason: string, actor: Actor): Row<'ask'>
setDeliveryTarget(database: NexusDatabase, ticketId: string, target: MergeTarget, actor: Actor): Row<'ticket'>
recordPullRequest(database: NexusDatabase, ticketId: string, target: MergeTarget, state: 'open' | 'merged' | 'closed', ciState?: Row<'ticket'>['ciState']): Row<'ticket'>
recordAcceptance(database: NexusDatabase, input: AcceptanceInput, actor: Actor): Row<'acceptance'>
resolveMerge(database: NexusDatabase, askId: string, target: MergeTarget, repositoryVerified: boolean): boolean
dispatchTicket(database: NexusDatabase, ticketId: string, actor: Actor): Row<'ticket'>
startTicket(database: NexusDatabase, ticketId: string, bindingId: string, actor: Actor): Row<'ticket'>
retryTicket(database: NexusDatabase, ticketId: string, reason: string, actor: Actor): Row<'ticket'>
advanceTicket(database: NexusDatabase, ticketId: string, event: 'ready' | 'session_ended' | 'failed' | 'complete', actor: Actor, reason = ''): Row<'ticket'>
pauseTicket(database: NexusDatabase, ticketId: string, paused: boolean, reason: string, actor: Actor): Row<'ticket'>
cancelTicket(database: NexusDatabase, ticketId: string, reason: string, actor: Actor): Row<'ticket'>
linkTickets(database: NexusDatabase, ticketId: string, relatedId: string, kind: 'depends' | 'relates', actor: Actor): void
resolveTicket(database: NexusDatabase, ticketId: string): { ticket: Row<'ticket'>, reasons: string[], dependencySatisfied: boolean }
sendMessage(database: NexusDatabase, id: string, recipient: string, ticketId: string | null, content: string, actor: Actor): Row<'message'>
updateMessage(database: NexusDatabase, id: string, event: 'delivered' | 'read' | 'handled' | 'failed', error?: string): Row<'message'>
transferMessages(database: NexusDatabase, previousBindingId: string, bindingId: string): void
saveChannel(database: NexusDatabase, id: string, name: string, enabled: boolean): Row<'channel'>
triageThread(database: NexusDatabase, threadId: string, projectId: string | null, disposition: 'claimed' | 'pending' | 'ignored', actor: Actor): Row<'thread'>
recordThread(database: NexusDatabase, input: ThreadInput): Row<'thread'>
recordTrigger(database: NexusDatabase, input: TriggerInput, actor: Actor): { trigger: Row<'trigger'>, authorized: boolean, accepted: boolean }
subscribeThread(database: NexusDatabase, ticketId: string, threadId: string, actor: Actor, subscribed = true): void
saveSourceState(database: NexusDatabase, channelId: string, name: string, value: string): void
handleWakeup(database: NexusDatabase, id: string): Row<'wakeup'>
publishMessage(database: NexusDatabase, messageId: string, recipient: string, actor: Actor): Row<'outbox'>
updateOutbox(database: NexusDatabase, id: string, state: 'sent' | 'failed' | 'unknown', detail: string, remoteId?: string, remoteUrl?: string): Row<'outbox'>
recordAttention(database: NexusDatabase, input: AttentionInput): Row<'attention'>
updateAttention(database: NexusDatabase, id: string, event: 'reminded' | 'failed' | 'escalated' | 'handled', detail: string): Row<'attention'>
```

## 验证边界

单测仅使用工作树 `.temp` 下的真实临时 SQLite。通过只证明持久化和策略，不代表 DSH 会话、GitHub 网络或浏览器集成通过。所有时间相关用例可在 Vitest fake timers 下运行；无后台服务、网络调用或插件构建。
