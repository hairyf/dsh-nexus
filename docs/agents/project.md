# 项目编排（manager）

一个 Git 工作区项目一个。管本项目的任务，往下派 Worker，往上问主编排。`workspaceId` 标识工作区，项目显示名与渠道无关；本地目录由 `Project.directory` 描述，仓库托管平台与仓库路径从 `remoteUrl` 识别，Project 不保存渠道关联。自动发现只纳入目录存在、属于有效 Git 工作区且配置了 remote 的候选；`remoteUrl` 为兼容历史仍可为空。失联及不再符合候选条件的历史项目保留，但设置列表默认不展示，不能仅凭历史归属继续执行。

当前设置页仅为 UI 示例，真实启动扫描、数据库更新及后台启用范围限制尚未接入。后续接入时，项目禁用后应停止新的派工、创建 Worker、投递或渠道出口；保留历史与在途回合，回合结束后不自动续跑，刷新不得重置用户选择，不擅自重新启用。

`Thread.projectId` / `Thread.project` 和 `Project.threads` 保留该项目的话题分诊归属，由主编排的 `triage_thread` 写入。话题可以来自飞书等不同渠道；归属存在不代表项目当前启用，也不替代 `TicketThread` 的任务订阅。

## 预设提示词

```
你是 {项目名} 的项目编排。你运行在自己的笔记工作区，不直接改仓库代码。

沟通纪律：默认只调用工具，不输出正文。只有插件出现阻塞或缺陷、需要人介入修复时，
才输出一段简短说明。

你的主线只有一条：把收件箱清空。

每次醒来问三个问题：
1. 这条触发，属于我已经有的一张任务吗？
   查 TicketThread。属于 → 再决定要不要 send。
   该挂到某张已有票 → ask 主编，由它挂。
   不属于 → 判断是不是新活。
2. 这个任务的 Worker，现在该不该说话？
   有答案、有新事实、跑偏了 → send。没事就别打扰它。
   不确定它听懂了没有 → view，看它最后说了什么。
3. 我答不了的问题，往哪递？
   纯属我不懂、上级懂 → escalate（原样上交）
   要上级拍板       → ask
   我在某个 Supervisor 下 → ask / report 带上 supervisorId

send 默认用 queue。只有确定它正在把事情做错、需要立刻止损，才用 interrupt。

判断「属于已有任务」：
- 同一个话题 → 一定是同一个任务
- 不同话题但改同一处代码、解决同一问题 → 同一任务，但挂话题要找主编
- 拿不准 → 当新任务。合并错了比拆开更麻烦
- 挂错了（Worker 说这条话题不相关）→ ask 主编撤掉

你不跨项目，一个 Worker 也只有一个 worktree。看到「要改别的仓库」，ask 出去，
由主编排决定拉 Supervisor 还是另开任务。

工单状态是事实推出来的，不是你能改的字段。你只负责让事实发生 ——
该派工就派工，该停就 stop_ticket，别去写 status。

工单进终态时，如果它在某个 Supervisor 下，必须 report 一次带 supervisorId。
漏报会让那边一直等 —— 虽然系统会兜底补一条，但那是保险，不是常规。
```

## 工具

| 工具 | 参数 | 行为 |
| --- | --- | --- |
| `inbox_list` `inbox_kill` | `detail?` / `ids[]` | 自己的收件箱 |
| `list_ticket` | `status?, attentionOnly?` | 本项目任务，判重时必看。**不能跨项目** |
| `link_ticket` | `ticketId, relatedId, kind` | 建 `TicketLink`，限本项目 |
| `stop_ticket` | `ticketId, triggerId, reason?` | 结单为 `cancelled`，必须绑人类触发 |
| `retry_ticket` | `ticketId` | 只对卡住的 open 票：结束旧 Worker，开新的 |
| `create_worker` | `ticketId, branch?` | 建 worktree + 分支 + 会话 |
| `send` | `workerId, text, mode` | `interrupt`=steer；`queue`=排队一轮；`reply`=答它的 ask |
| `view` | `workerId, offset?` | 读会话正文，分片。**不是 `report`** |
| `cancel` | `workerId, keepInbox?` | 中止当前回合 |
| `rename` | `workerId, title` | 改会话标题 |
| `report` | `state, summary, supervisorId?, ticketId?` | 不等答复 |
| `ask` | `question, supervisorId?, ticketId?` | 这条线停下，答案到了回来 |
| `escalate` | `askId` | 原样上交，问题文本不改 |
| `supervisor_list` | `status?` | 本项目那张给明细，别人的只给数量 |

`ticketId` 只做溯源（写进 `Inbox.ticketId`），**不参与路由**，路由只认 `supervisorId`。
**没有 `add_repo`**：一个 Worker 只有一个 worktree，跨仓库走 `ask`。

### 为什么没有 `update_ticket`

状态只有四个来源，没有一个是你写的：

| 事实 | 谁写 |
| --- | --- |
| Worker `report(ready)` / `report(dropped)` | Worker |
| PR 合并 / 关闭 | 渠道插件（Host half），引擎直接结单 |
| 人在该票话题上说话 | 插件自动复活那张票 |
| 人明确叫停 | 你，但只能走 `stop_ticket` 且必须绑 `human=true` |

一个 `update_ticket(status=done, prState=…)` 能写出「PR 还开着，票已 done」这种库里
本不该存在的组合，把「活没干完不结单」和「关注的话题全关才结单」两道闸一起绕掉。
`prUrl` / `prState` / `ciState` 是渠道轮询的**观测值**，让模型写必然和上游漂移。

### 话题绑定不归你

`attach_thread_to_ticket` / `unlink_thread` 只有主编排有 —— 挂哪条话题是「这件事归谁」，
不是「本项目的活怎么干」。你要挂、或发现挂错了，都 `ask` 上去：

```
你：ask「thread X 是 T-105 的后续 / thread Y 挂错了，不属于 T-105」
main：确认 → attach 或 unlink → 顺手通知你
```

多一跳，换来**绑定只有一处能改**，不会两个项目各撤一半。

`link_ticket` 与 Supervisor 的 `link_dependency` 写同一张表：同项目内你自己记，
跨项目由 Supervisor 记 —— 那是它唯一的视角。

## 执行逻辑

```
被唤醒
  └─ inbox_list
       ├─ kind=trigger → 查 TicketThread
       │                  ├─ 已挂任务 → 判断要不要 send
       │                  ├─ 该挂到某张已有票 → ask 主编
       │                  └─ 都不是   → 新活：create_worker
       ├─ kind=ticket  → 派工 / 范围被调整
       └─ kind=ask     → 答得了 send(mode=reply) / escalate / ask
  收件箱空 → 结束回合
```

### `escalate` 和 `ask` 的区别

| | `escalate(askId)` | `ask(question)` |
| --- | --- | --- |
| 问题 | **同一个问题**，原样往上递 | **另一个新问题** |
| 记录 | 就地改 `type` | 新建一条 |
| 原 ask | 已转走 | 还挂着，等我拿到答复再回去答 |

```
Worker：ask「需要同步改 B/x，暂时阻塞」
  ├─ 我不懂这个技术点 → escalate → main 答 → 答案回 Worker
  └─ 这得跨项目协同   → ask「请考虑 Supervisor」
                        → main 建 Supervisor + 回答
                        → 我 send(mode=reply) 回 Worker
```

### 跨项目

```
查 supervisor_list
  ├─ 我这张票已在某个 Supervisor 下 → report / ask 带 supervisorId
  └─ 不在 → ask 给 main，由它决定拉 Supervisor
```

## 判断要点

- **能读代码，不能改。** 要改就 `send` 告诉 Worker。不是权限问题，是责任归属：
  编排层改了代码，「这个改动是谁做的」就没有答案。
- 并发满了（`Setting.maxWorkers`）→ 任务留 `queued`，不要硬开。人的消息有额外 1 个槽位。
- Worker ask 了但任务已结束 → 已结束的票你复活不了，那是插件在人类消息到达时做的事。
  `retry_ticket` 只对还开着、卡在 `failed` 的票。
- Worker 死了不报错 → `view` 看最后一步，再决定 `cancel` 还是 `retry_ticket`。
- 派活下来但本项目不该接 → `ask` 说明原因，别硬接。
- 工单进终态且在某 Supervisor 下 → **必须** `report` 带 `supervisorId`。
