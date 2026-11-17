# Nexus 运行边界

Spec 02 不激活宿主、不打开默认数据库，也不注册公共通信工具。Spec 06 负责用 `profileContext.dir` 和 `resolveDataDirectory` 打开账本，再创建 `runtime.create(database, gateway, timers, managerDirectory)`。管理目录应位于 Nexus 状态目录，不能使用项目工作目录。

## 消费入口

- Spec 03：`resolve` 查询已登记角色与真实会话；`intake` 接受已核实的宿主事件；`deliver` 投递已有 Message；`read` 核对真实上下文回执；`handled` 记录显式处理；`suspend` 挂起原 pending Ask 的工作线。公共 ask/send_message 仍由 03 定义，不能把这些宿主事实入口直接暴露给模型。
- Spec 05：`dispatch` 只记录受理，`start` 返回实际启动或名额排队；`pause`、`cancel`、`retry` 执行独立管理决定；`closeSupervisor` 接受明确上级处置或验证全部协调工作成功。角色、工单、消息与 Attention 的展示仍读取账本。
- Spec 06：`bind` 建立主角色责任；`boot` 核对旧责任并恢复已受理队列；`recover` 仅续接原绑定；`startQueued` 消费已受理派工；`observe` 处理携带稳定事件 ID 的 session 事件；`projectChanged` 打断已禁用或失联项目；`dispose` 解除本实例宿主定时器。
- 有效等待使用 `watch`；有效进展使用 `progress`；有实际处置证据时使用 `settleAttention`。`remind` 供宿主定时器调用。只读消息、空回合和重复受理都不是有效进展。

所有执行入口接受 AbortSignal。`interrupted_tool` 结束本次等待，不取消 Ask、不补造交付、不重做结果未知的远端写入。`retry` / `recover` 的核对回调必须由 04/06 核实已有交付与外部副作用，只能返回 `verified` 或 `unknown`。

## DSH 会话端口

`SessionGateway` 和 `HostTimers` 在 `types.ts` 定义。`createSessionGateway(ctx, retireWriters)` 使用 DSH agents 的 create/resume、preset resolve/mount、followup/inject/cancel 与 owned AgentHandle。创建与恢复同时读取宿主 agentDefaultModel 的当前模型选择。Nexus 读入回执来自持久 `user/message.data.source`，不把入队回执视为已读。原生 helper/sidechat 不因 preset 同名取得角色绑定。

`retireWriters(sessionId, signal)` 是 06 必须提供的正向证明：在原 root 仍登记时，停止并等待其 helper 树和所有 session-owned jobs/subprocess writer；无法核实则返回 false。adapter 先等待 `agent.whenIdle()`，再调用该回调，最后等待 owned handle.dispose()，三者成功才报告 stopped。当前依赖树没有 dsh-jobs 契约，因此本模块不编造 jobs API，也不把 idle、取消受理、agent 缺失或 scope unwind 视为完整停止证明。重启时没有 live root 也不能单凭缺失判停：只有该回调正向核实旧进程及所有 writer 已退休，才能补记停止；关联不明则保留未核实状态。

`HostTimers.timeout` 由 06 接到 `ctx.timeout`，每次回调返回 Promise；宿主应记录拒绝结果。定时器只运行 Attention 的持久截止时间，不使用 jobs.json、不以轮询读取制造进展。

## 工作区与停止事实

每次执行的 repository、worktree、branch、baseCommit 均记录在绑定。git admin 目录的 nexus-owner.json 与实际 common-dir、remote、branch、base 和 worktree 注册/锁定事实共同核验归属；历史改动保留，不复用、reset 或删除冲突资产。

管理者只在专有管理目录运行；运行服务只为 worker 创建业务执行工作区，不代替 worker 修改业务代码。该目录隔离不是额外的 OS sandbox，也不改变原生 sidechat 权限。

暂停/取消先落管理事实，再请求完整停止。只有 gateway 的正向停止证明才能写 execution_stopped；未确认仍占据旧执行责任。暂停保留原上下文与工作区，解除人工暂停不会自动重试；需要新执行时必须显式 retry 并核对已有交付与副作用。

宿主 session/agent 的 turn end、idle、disposal 都不是工单完成。`observe` 只记录事件、核对真实读入和继续已有停止核对；runtime:session 回执仅留审计，不唤醒上级、不注入其运行步骤，避免数量提醒回合生成新的会话回执唤醒链；正式 ready/failed/complete 仍走 Spec 01 的 advanceTicket 与验收/交付策略。
