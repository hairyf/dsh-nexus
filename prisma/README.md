# Nexus 账本与策略

Spec 01 的领域写入口是 `src/service/ledger.ts`，纯策略入口是 `src/service/policy.ts`。它们均使用单一 `defineService` 导出；下游不得直接改工单状态、复制路由策略或把模型正文当作身份。领域类型在 `src/types/ledger.ts`，生成的 Kysely 读类型在 `src/database/types.ts`。

## 初始化与隔离

只在宿主显式激活时调用 `await openDatabase(resolveDataDirectory(options, dshHome, profileDirectory))`，退出时调用返回句柄的 `close()`。导入数据库模块不打开文件、不迁移。`options.dataDir` 必须是绝对路径，显式配置优先；无显式配置时，可由宿主传入 `profileContext.dir`，默认存于其 `storages/nexus` 子目录；无 profile 上下文则以 `DSH_HOME`（缺省用户 DSH home）为根。这个模块不读取真实用户目录，也不自行查找 profile；Spec 06 负责传入可信宿主值。

共享常量 DSH_PLUGIN_HOME 有意跟随新的默认 storages/nexus 根。尚未装配的独立 src/runtime/scheduler.ts 若被导入，其 jobs.json 也会取这个新根；本 Spec 没有启动它，也不搬移或删除旧 .nexus/jobs.json。Spec 02 负责替换这段独立队列，不能把它当作新的提醒/派工事实来源。

初始化失败抛 `LedgerError`，错误码区分 `invalid_config`、`unavailable` 和 `migration_failed`。关闭/缺失句柄抛 `not_initialized`。迁移与版本记录、外键核验在同一 SQLite 事务中完成，任一失败关闭句柄并回滚；调用方不得启动派工或外部写操作。已知旧 Kysely 版本记录直接延续；没有版本记录的原始旧库只有在所有基线表的实际列结构吻合后才被接纳。不会删除或重建用户库。

## 权威迁移与生成链

- `prisma/migrations/20261113135519/migration.sql` 是不可修改的旧基线。
- `prisma/migrations/20261116000100_ledger_policy/migration.sql` 是本次前向迁移。
- `pnpm run prisma:migrate` 只把已有 SQL 链搬运成 `src/database/migrations.ts`，不再删除开发数据库，也不隐式创建迁移。
- `pnpm run prisma:generate` 从 `prisma/schema/` 生成 `src/database/types.ts`。
- 新增结构时先用 Prisma migrate diff 产生 SQL，再补数据迁移规则；提交 schema、SQL 和两个生成物。Prisma CLI 的开发 datasource 仅用于开发核验，不是运行时状态目录。

旧项目不按显示名或 channel 猜仓库，全部保留原 ID、工作区、会话与历史引用，记录原 channel 身份证据，禁用并标记 `repository_identity_unverified`；人工确认仓库后才能启用。旧工单固定补 `important + human_required`；旧全局设置无论 autoMerge 原值为何都转 `human_required`。新安装默认 `important + follow_question_level`、4 个 Worker、10 分钟提醒。已结束工单不补验收或批准。执行指针不以 activeKey 代替历史事实：唯一未关闭候选，或唯一已结束候选，都保留真实绑定；多个已结束候选不按时间猜赢家。非终态的歧义、缺失或与交付事实冲突的状态写入 Ticket.executionAttention，并在 resolveTicket 中可见，派工/恢复不会绕过它。

旧 Inbox 被迁成同 ID 的 Message；其中问题另迁成同 ID 的唯一 Ask，保留来源、问题、历史答案、回答角色快照及升级次数/时间。所有消息种类均保留 triggerId、threadId、title 外键/字段和不可变来源 JSON，不只为 Ask 留来源。历史 `user` 不转成已核验的人，无法核实的旧收件地址显式标记待恢复；旧 Inbox 表删除，不保留第二份答案。历史顺序按旧 seq、时间、ID 稳定归一，不让旧的重复 seq 导致丢消息。只有新流程的显式决定、当前验收证据与真实 merged 事实能完成新的交付。

## 信任边界与下游须知

`Actor` 只能由认证后的 Web 入口、已验证的提供方事件或已登记 DSH 会话构造，不能从工具参数、模型正文或 preset 名称构造。GitHub 身份保存 provider ID 与 login 快照；白名单每次重新检查，机器人、出站回流和代理均不能冒充人。非白名单正文仍可入上下文，但 `recordTrigger` 的 `authorized=false`；重复来源事件返回 `accepted=false`，不能重新处理成新授权。

`bindRole`、`recordPullRequest`、`updateMessage`、`updateOutbox`、提醒写入是可信宿主/适配器事实入口，不是可直接暴露给模型的工具。main/project 的初始责任绑定可由宿主启动建立；worker 必须传入本项目 project 的可信 Actor（或已认证人工），supervisor 必须传 main/人工。同票主 Worker、main 和项目责任由数据库唯一键约束，未核实关闭的旧执行仍占责任。新 worker 还受全局并发、人的暂停、项目可用性、既有授权和成功依赖约束；这里不启动任何会话。

`recordPullRequest` 只记录适配器核实的远端事实，不执行合并，也不产生批准。外部 merged 缺决定会保留 merged 并显示待核验。执行外部合并前调用 `resolveMerge`，第四参必须是本次核实的仓库要求结果；旧的 answered 状态、任意肯定文字、过期 head 或后来收紧的策略都不是许可。完成工单必须显式调用 `advanceTicket(..., 'complete', ...)`，ready/会话结束只转 review。

main 的无票 Ask 可以通过已核实的 Thread→已启用、可用项目关系发布到其 source 原话题，正式答案沿用同一来源；无需也不得为发布伪造工单。main 发出的无票普通消息保存可信 Actor 来源快照，也可直接把已登记 Thread ID 作为 sendMessage 的真实收件地址，无需伪造内部中转收件人或依赖项目会话可用，再通过 publishMessage 建立外部投递。有票的直接话题地址复用原有项目/工单/订阅权限，supervisor 和越权话题不因此获得出口。显式话题地址持久记录为 Message.destinationThreadId，publication 只能使用同一目标，重放到另一地址抛 address_conflict；该目标引用不能因删除话题而被静默抹去。内部收件消息不带此字段，仍按原权限允许有意发布，不把来源 threadId 误当作外部目的地。只有当前 main 或经过核验的人可以发布这类消息；worker/project/supervisor 不获得无票出口，正文自报 main 不能建立来源身份，未知历史话题仍需人工核验。

Thread 的 repository 是持久事实；分诊、订阅和发布均按同一仓库身份核验。历史未知身份保持 `repository_identity_unverified`，不能根据显示名或项目归属字段猜仓库。

执行入口统一使用 `dispatchTicket` 受理 queued、`startTicket` 原子记录 Ticket.running/首次 startedAt 与 Worker 运行事实、`retryTicket` 在确认旧 Worker 关闭后重新排队；均校验 project/人工授权、项目可用、暂停、依赖与待答问题，不改变既有工单授权。`ticket_transition` 保留操作者、原因、前后状态与执行绑定。RoleBinding.startedAt 只由受控启动或真实旧 Worker.startedAt 产生，单纯绑定、派工受理或旧 running 标记都不构成已启动证据。宿主核验会话实际启动后才能调用 startTicket；本层不执行 spawn。Ticket.executionBindingId 保存当前执行，failureBindingId 保存失败来源。updateBinding 不能把 idle/unavailable Worker 改成 running；已有实际启动证据的当前执行只能通过 recoverTicket 在重新核验项目、暂停、授权、依赖和并发后恢复。恢复调用前由运行层核对真实会话和工作区，不凭同名 preset 猜测。历史绑定缺仓库/工作区核验信息时，可信 project/人工通过 verifyExecutionMetadata 按已确认项目身份写入 repository/worktree/branch，并记录前后值、原因和操作者；该入口不会写 startedAt。历史 running 但 startedAt 未知的执行不能伪恢复；宿主确认旧会话实际终止后，通过 confirmExecutionStopped 审计关闭该绑定并把未完成的执行转回 waiting，再由 retryTicket/new binding/startTicket 走新执行。确认终止可补记已 closed 的旧绑定，也不伪造旧启动时间；它是可信观察入口，不负责终止进程。该观察只清除已解决的 legacy_execution_closed，不清除交付冲突 attention。已有 merged 事实的未完执行进入 review，保留待核验标记，不把正常停止伪造成新失败；先 reconcile，再按当前证据和策略处理交付，不能经 retry/dispatch 绕过。对有歧义的历史绑定，可信宿主经核验所有旧执行已关闭后，调用 reconcileLegacyExecution 选择同票的真实迁移绑定并核验仓库/工作区，记录原指针、attention、选定绑定、原因与操作者；不允许使用别票绑定或新造绑定充当历史。随后 confirmExecutionStopped/retryTicket/new binding/startTicket 走受控重试，真实旧 startedAt 保持原值或 NULL。

ready/failed/session_ended 必须属于当前且真实启动过的执行：Worker 身份从可信会话绑定推导，宿主/project 转交事件必须显式提供 executionBindingId。失败不会被迟到 ready/session_ended 清除；retry 仅重新排队并保留失败，只有获授权的新执行产生 ready 才清除当前失败，失败历史仍在 ticket_transition。AcceptanceInput.executionBindingId 为必填，验收记录和交付决定均绑定当前执行，不能跨重试重放旧证据或旧批准。真实 startedAt 与仓库元信息核验是独立事实：无论启动时间是否已知，本票仓库身份、worktree 和 branch 都必须由可信写入口核实。缺项时验收、合并交付 Ask 和 complete 均拒绝 execution_metadata_unverified；历史绑定通过 verifyExecutionMetadata/reconcileLegacyExecution 审计补齐，而非凭时间戳放行。仅历史已关闭绑定的 review+merged 交付，在核实当前仓库元信息和目标后，允许本票 project/人工记录新的验收证据而不补造未知的旧启动时间；仍须有效且显式的交付决定 Ask，不能把旧 ended 当作验收或批准。历史或外部合并不另加永久 human-only 规则：按当前工单策略判断谁能答复；human_required 必须人答，人工明确改成 automatic_allowed 后允许上级编排依据证据代答。策略后来收紧时，尚未履行的旧代答不能继续完成交付。已 merged 的目标在 resolveMerge 中始终不是再执行合并的许可；同一 PR 补齐目标时保留已有 merged/closed 事实，交付核验后才由 complete 结束。

正式答案必须回传当前 `policyBasis`，一次事务内结清 Ask 并写入回送消息。升级沿用原 askId；实质目标变化会取消旧 pending Ask，已答旧决定保留但不能用于新目标。已读和处理完通知均不回答 Ask。Ask.initiatorBinding 保留原发起者审计，responseRecipient 保存已核验的当前回送责任；transferMessages 必须核验 previousBindingId、同角色/范围和旧会话关闭，并在同一事务迁移该回送地址。发起方尚未恢复时，答案仍一次性落账，回送消息显式失败为 initiator_requires_recovery，恢复后移交原消息，不要求重答。

Message 的 acceptedAt、deliveredAt、readAt、handledAt 是不同事实。同票同收件责任按 seq 保序，不同票互不阻塞。失败保留次数、原因、重试时间；角色替换只能显式移交相同责任的未读消息和 pending Ask。策略变更或升级改变 handler 时，在同一事务将旧待办标为 superseded 并向新责任人落一条 pending 投递；消费方必须排除 supersededAt 非空的消息，原 readAt/handledAt 不伪造为已处理。handler 不变的策略编辑不额外造通知。取消、正式结清以及两种目标变化路径也在同一事务退役原请求，保留 readAt/handledAt 历史；退役请求不阻塞后续投递。不可用的处理者会在创建/升级/策略重路由前被拒绝，整次写入回滚。派生外部请求也在同一事务设置 Outbox.supersededAt，尚未发送的 pending/failed 转 superseded，不再阻塞后续同票/同话题投递；已知 sent 和结果 unknown 保留原状态、远端关联及尝试/故障事实。适配器不得发送 supersededAt 非空的请求；退役的 unknown 仍须核对远端，迟到的成功回执可以补记，但核对不计为一次新发送。sent 需要远端 ID，已知成功不能再次发送。

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
verifyExecutionMetadata(database: NexusDatabase, ticketId: string, bindingId: string, metadata: ExecutionMetadata, reason: string, actor: Actor): Row<'role_binding'>
reconcileLegacyExecution(database: NexusDatabase, ticketId: string, bindingId: string, metadata: ExecutionMetadata, reason: string, actor: Actor): Row<'ticket'>
confirmExecutionStopped(database: NexusDatabase, ticketId: string, bindingId: string, reason: string, actor: Actor): Row<'ticket'>
recoverTicket(database: NexusDatabase, ticketId: string, bindingId: string, reason: string, actor: Actor): Row<'ticket'>
retryTicket(database: NexusDatabase, ticketId: string, reason: string, actor: Actor): Row<'ticket'>
advanceTicket(database: NexusDatabase, ticketId: string, event: 'ready' | 'session_ended' | 'failed' | 'complete', actor: Actor, reason = '', executionBindingId?: string): Row<'ticket'>
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
