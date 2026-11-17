# GitHub channel

Spec 04 的主动调用适配器，不启动轮询器、模型、会话或 Web 服务。所有持久写入都调用 Spec 01 的 ledger；没有新迁移或第二份白名单/ask 策略。

## 装配与调用

宿主为一个已打开的隔离账本保留一个 GitHubChannel 实例，并注入 ExecFileGhRunner。测试注入记录 JSON 的 GhRunner，不调用真实 gh。

- selectEnvironment(projectId, { site, login, automationIds }, signal?)：由宿主在用户明确选择后调用；site 必须等于已登记 repository 的站点。automationIds 是已知自动化账号的提供方用户 ID。核验现有 gh 的 user、仓库 ID 和 full_name，固定用户 ID；不切换账号或读取/存储 token。
- verifyEnvironment(projectId, signal?)：重新核验环境，返回 available 与可区分 reason。项目必须仍启用、可用，仓库只能来自 ledger 的已核实身份。
- collect(projectId, signal?)：采集仓库新 issue/PR、全部订阅及已发布话题的评论/评审、关联 PR 的 head/CI。一个话题失败不会阻止其余话题；不同项目由调用方独立调度。
- collectTopic(projectId, threadId, signal?)：显式补取某个已登记话题的评论/评审；历史只作上下文。返回逐 ask 的答复处理结果，正式答案直接进入 ledger.answerAsk。
- collectPullRequest(projectId, threadId, signal?)：返回实际 PR/head/base、open/closed/merged、pending/running/passing/failing、PR 和 CI 各自的采集时间。CI 失联仍保留独立观察到的 PR 事实，ok=false 说明未完成全部核验。
- intake(projectId)：读取未确认的持久 main 分诊候选、订阅上下文与 PR/CI 事实；它不是建票或 Worker 派发。
- acknowledgeIntake(projectId, id)：消费者可靠地按 intake.id 去重落账后确认。崩溃后未确认输入仍可读；02 必须用稳定 intake.id 实现自己的消息注入幂等，不以一次函数返回充当持久交接。
- publish(outboxId, signal?)：投递已由 ledger.publishMessage 建立的地址。同话题串行；先 POST 一条 Nexus 评论，之后只 PATCH 已核验的关联。再次传入 sent 的 ID 会按最新领域状态刷新投影，而不是重发原请求；pending/failed 的 superseded 请求绝不发送。02 可用同一入口刷新答复状态和提醒（提醒正文来自新的合法出站消息），不会创建 ask。
- preflight(askId, signal?)：供宿主 MergeVerifier 在 allow_merge 答复前调用，返回 Promise<{ target: MergeTarget, verified: boolean, reason?: string }>。从 merge ask 的唯一关联工单核对当前交付目标、项目、所选环境和 PR 话题订阅，再复用 PR/CI 采集及仓库保护核验；head/base 变化、非 open、CI 或保护失败均返回 verified=false 与具体 reason。target 是已成功观测的当前 PR 目标；尚未观测到 PR 时保留 ask 目标。不存在或无法定位 merge ask/目标时抛 GhError(invalid_merge_decision)。仅执行远端 GET 与 POST graphql query，绝不合并或发布；本地仍保存环境/PR/CI 事实，目标变化按 ledger 规则取消过期 ask。它不回答问题、不检查已有批准、不替代 ledger 的身份、策略及验收门禁；宿主可接线为 (ask, actor, signal) => github.preflight(ask.id, signal)。
- merge(askId, signal?)：由 ledger 的具体 merge 决定确定唯一工单、仓库、PR、head/base，重新采集和核验保护后才发送带 sha 的合并请求。实际 merged 只调用 recordPullRequest，不完成工单；已外部合并时只记录事实，不补造批准。
- status(projectId)：供 02/05/06 读取持久环境、采集、答复、投递、合并状态与原因。送达不代表已读，不清除 Web 待答项。

## 持久边界

adapter 元数据位于 ledger.source_state 的 github:<repository>: 前缀：baseline、各资源流 cursor、revision、admission、handled、intake、managed、published_ask、ci_runs、ci_evidence、pr_fact 和 *_status。Trigger 保存提供方作者身份与稳定事件修订；source_state 保留完整修订、创建/更新时间及处理结果。PR 的 issue 评论与评审归入同一个 pull Thread。

分页每次从已确认 since 的第一页重读，保存页边界，用稳定来源修订消除重叠。连续两次完整扫描的来源修订集合一致后才推进至上一轮开始时间的重叠边界；变动或失败的扫描不越过未处理内容。没有内部重试循环；02 决定下一次调用时间。首次基线在环境选择时建立且重新选择不重置。

受管评论的 pending 写意图在网络请求前保存。超时/中断/响应丢失后按已知远端 ID 或提供方作者 ID 加话题标记核对；无法证明创建是否成功时保持 unknown，不盲目再 POST。标记仅作关联，不提供人工授权。已知评论 404 后还须成功枚举原话题并确认 ID 不在其中，才允许替代评论；outbox 保留历史成功回执，managed 保存当前关联。重试次数、指数退避上限来自 ledger 设置，并尊重 Retry-After；没有无限重试。

## 合并限制与验证边界

preflight 同时检查 GitHub 的 CLEAN/MERGEABLE、当前 head 的 CI/review，以及经典保护和 active rules 的必需检查（含 app ID）。没有配置检查与读取失败不同。API 不保证 CLEAN 覆盖一切仓库规则，故无法核实的签名、部署、会话解决、线性历史、分支锁定/推送限制、merge queue 等保护明确返回 unsupported_repository_requirement，不冒充通过，也不使用管理员绕过。保护读取权限不足时不能合并。仓库没有检查仍必须满足 ledger 的验收与有效决定。

此模块仅有模拟 gh 边界、真实 ledger 和临时数据库验证。真实 GitHub 写入、宿主调度和 Web 接线属于获得明确授权后的 Spec 06。
