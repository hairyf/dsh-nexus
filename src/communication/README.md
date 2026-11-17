# Nexus 通信边界

Spec 03 不打开数据库、不启动宿主、不创建角色会话。主机入口仅注册预设；原先按 preset 名给每个 agent 注入角色工具的监听已删除。

## 04 / 05 / 06 的领域 API

无宿主调用栈的适配器可使用同步 communication.answer(database, FormalAnswer, trustedActor)，返回 accepted 与同一 Ask 行，不启动会话；GitHub 的显式多选答案使用 JSON 字符串数组并在入口转换为 selections。此方法与下面实例的 answer 共享同一个结清路径。

使用 communication.create(database, runtimePort, verifyMerge?)。实例的领域动词为 resolve / ask / sendMessage / answer / cancel / list / readMailbox / handleMail，数据库写入仅通过 ledger，路由、人工要求、工单范围、策略版本与交付证据仅由 01 核定。

- resolve(sessionId, signal?) 调用 02 的 runtime.resolve，身份不是工具参数、prompt 或 preset。
- ask(sessionId, Question | { askId }, signal?) 创建/上交问题。新问题必须有实际 question 与稳定 requestId；同一角色责任、同一 requestId 得到同一 askId，显式责任替换后仍复用。原问题内容/选项/范围不能被重试改写。Worker 默认绑定本票；project/supervisor 显式提供 ticketIds；main 可以无票分诊。默认决定性质为 important；显式决定性质交给 01 路由，模型不能指定 handler 或放宽工单策略。合并仍须精确 target、允许/拒绝选项与当前验收证据。
- sendMessage(sessionId, requestId, input, signal?) 接受普通消息或正式答复。普通消息显式 to，可以有 facts（progress/ready/failed/dropped、摘要、交付证据）；不更新 Ticket.status、不产生验收。正式答复必须有 askId、当前 policyBasis 与 message；多选用完整 selections。不能混用 to/agent_id，不接受模型身份或 verified。
- answer(FormalAnswer, Actor, signal?) 供认证后的 Web、已核实 GitHub 适配器和宿主提交正式答案。Actor 来自适配器认证，不能由模型正文或默认倒计时构造。多选同时保存原始 answer 文本与 selections。第一份合法答案一次性落账并写回送消息；重复入口返回 accepted=false、reason=ask_answered 和原结果，不重投；取消/目标变化给出不同错误。
- cancel(askId, reason, Actor, signal?) 是独立管理入口，不是第三个模型通信工具。
- list() 为可信适配器返回同一账本状态、表单、处理责任、policyBasis 与目标；Web/渠道自身负责认证后展示范围。

内部角色通信的普通消息、ask 与 Agent 正式答复写入独立 Inbox；运行中不 inject、不 cancel、不插入下一步。空闲后用官方 followup 提交 source.kind=nexus 的数量提醒，触发原生非人消息视图。提醒不携带正文、不创建新信件；持久 session receipt 按会话与信件最大序号去重，旧会话提醒不会抑制同角色新会话。用户消息与人工答案沿原 runtime/Message 路径投递。pending ask 仍挂起发起者原工作线，中断不取消问题。

verifyMerge 是宿主提供的可信核验端口：接收账本 Ask、真实 Actor、AbortSignal，返回本次核实的 target 和 verified。工具的 allow_merge 没有此核验就拒绝。04 的远端读取、发布/更新与最终合并不在本模块执行。

地址只接受 role:main|project|supervisor|worker、binding:<登记ID>、session:<会话ID>、channel:<已登记Thread ID>。同角色有多个活责任时 role 地址报 ambiguous_address，调用者须明确 binding/session；不猜测、不创建收件人、不广播。渠道发送先由 01 核验订阅/范围，再建立 Outbox；网络仍归 04。

## 可信作用域安装

使用 createCommunicationInstaller(service, nativeSend).attach(agentCtx, binding)，其中 agentCtx 必须是该可信角色自身的 agent.ctx。binding 来自 02 的账本登记；安装时再次 runtime.resolve，缺绑定返回 null，helper/原生子代理归属被拒绝。同一 installer 对同一 context 重复 attach 复用 disposer，不重复注册。

installer 安装该角色已有管理能力、通信定义 ask/send_message 与信箱工具 read_mailbox/handle_mail；预设不再携带旧 report/answer/escalate/ask_user/send/reply_channel。保留 better-dsh 的编码与 delegation 插件。原生 helper、fork、sidechat 不能调用 attach，也不因继承预设成为主 Worker。

nativeSend 必须直接委托该角色在 preset 层原有的原生 send_message 定义或原生 subagents 发送端口，保留原 ToolRunContext、父子权限、原生 messageId 回执及错误。不要经过已经 shadow 的同名查找再次递归。Nexus 的 agent_id 分支不建 Message/Ask；helper scope 完全不安装 Nexus 同名定义，原生内部回报标记、结果/完成通知保留原路径。

Spec 06 尚须在 create/resume 的可信 agent setup 挂载预设后调用 attach，并将 disposer 纳入相同角色生命周期；提供 nativeSend 与 verifyMerge，向 04/05 注入同一 service 实例并消费 durable Message/Outbox。不能恢复旧的 preset-name agent/created 注册方式。此提交不宣称真实 DSH、Web 或 GitHub 闭环已运行。

## 持久事实

前向迁移 20261117000100_mailbox 建立通用 Inbox 与业务适配 InboxMessage。Inbox 只有稳定 recipient/sender、kind、title/content、可空 askId 与接收/阅读/处理/提醒/退役时间；没有工单、项目、角色绑定或策略字段。通用 mailbox.save 可独立使用，不要求创建业务 Message。Nexus 适配层把角色与 scope 解析为 nexus:<role>:<scope> 地址，InboxMessage 关联需要业务消费者的 Message；正文只存 Inbox，旧账本查询从 Inbox 投影正文和阅读/处理状态，facts 与权限仍由业务账本管理。迁移保留旧历史和关联，把已有内部消息正文搬入 Inbox 并清空 Message 正文，不复制正文。

归档读取宿主 workspaceRegistry.archivedSessionIds，关闭旧角色绑定但不删邮件。同角色同 scope 新会话绑定原地址，继承包含已读但未处理的邮件，不修改信件 recipient。GET 会话信箱只读且不标记状态，非角色/归档/helper 会话返回 active:false；read_mailbox 显式阅读并返回当前问题表单与业务关联，阅读不代表已处理，handle_mail 才确认处理。上下文只注入未处理数量，不注入信件全文。结清/撤销/目标失效退役原问题信件与 pending_ask Attention，不产生默认批准。
