# 流程图

Nexus 的完整流转。状态名、字段名取自 `prisma/schema/`，代理的工具与提示词见 [agents/](agents/README.md)。
**这里只讲跨代理的机制**，单个角色怎么用工具不在本文重复。

1. [全景](#1-全景) · 2. [触发与分诊](#2-触发与分诊) · 3. [任务生命周期](#3-任务生命周期)
4. [Worker](#4-worker-生命周期) · 5. [汇报与求助](#5-汇报与求助) · 6. [收件箱](#6-收件箱投递规则)
7. [Supervisor](#7-跨项目-supervisor) · 8. [PR 与 CI](#8-触发点pr-与-ci) · 9. [时序](#9-端到端时序) · 10. [速查](#10-状态速查表)

---

## 1. 全景

```mermaid
flowchart TB
    CH["渠道<br/>GitHub / GitLab / 飞书"]

    subgraph 编排层
        MAIN["主编排 main<br/>全局唯一"]
        PROJ["项目编排 project<br/>每项目一个"]
        SUP["Supervisor<br/>临时"]
    end

    W["Worker<br/>独占 worktree"]

    CH -->|"Trigger"| TH["话题 Thread"]
    TH -->|"未分诊"| MAIN
    TH -->|"已分诊"| PROJ
    MAIN -->|"create_ticket · dispatch"| PROJ
    MAIN -->|"跨 ≥2 项目"| SUP
    SUP -->|"dispatch"| PROJ
    PROJ -->|"create_worker"| W
    W -->|"report / ask"| PROJ
    PROJ -->|"ask"| MAIN
    MAIN -->|"ask_user"| CH
    PROJ -->|"reply_channel"| CH
    W -->|"reply_channel"| CH
```

`main` / `project` / `worker` / `supervisor` 既是 `Inbox.type` 的取值，也是四个代理在库里互相指代的名字。

---

## 2. 触发与分诊

### 项目范围

当前设置页仅演示界面与本地交互，真实启动扫描、工作区同步、数据库更新和后台限制尚未接入。下述项目发现与启用范围是后续实现约定，不代表页面操作已改变运行中的插件。

项目应从已有工作区中发现，仅将目录存在、属于有效 Git 工作区且配置了 remote 的工作区纳入候选；无 remote、不可用和非 Git 工作区默认排除。启动及手动刷新只同步工作区元数据，不重置勾选，不删除失联历史；失联及不再符合候选条件的历史项目保留，但设置列表默认不展示。`workspaceId` 唯一，名称只是显示名；仓库托管平台与仓库路径从 `remoteUrl` 识别，Project 不保存渠道关联。`remoteUrl` 为兼容历史仍可为空，设置页采用紧凑列表且不展示 remote 地址。

`Thread.projectId` / `Thread.project` 和 `Project.threads` 是保留的话题分诊关系，与项目的 Git 身份无关。例如飞书话题可以由 `triage_thread` 分诊给任一已启用的 Git 项目，未分诊时 `Thread.projectId` 可以为空。

后台接入后，路由和动作入口在解析订阅或话题归属后，都应检查目标项目 `enabled`。禁用不删除历史、不撤销话题归属或订阅；停止对该项目的新自动分诊、建票、派工、建 Worker、消息投递与渠道出口。在途回合不强制中断，结束后不自动续跑。不能将禁用项目的现有订阅静默转派给别的项目。

**两件事分开**：`TicketThread`（哪些票跟着）决定投递，`Thread.triage`（归哪个项目）决定归属。

```mermaid
flowchart TD
    T["新 Trigger"] --> S{"TicketThread 有记录?"}

    S -->|有| K["投给这些票所在的项目编排"]
    S -->|没有| Q{"Thread.triage"}

    Q -->|pending| M["投给主编排"]
    Q -->|claimed| P["投给该项目编排"]
    Q -->|ignored| I{"mentioned?"}

    I -->|否| DROP["丢弃"]
    I -->|是| M

    M --> T2["triage_thread"]
    T2 -->|"claim + projectId"| C["triage=claimed"]
    T2 -->|ignore| G["triage=ignored"]
    T2 -->|"要开工"| C2["claim + create_ticket"]

    M -->|"已有票在跟"| A["attach_thread_to_ticket"]
    A -.->|"只写 TicketThread"| K
```

**所有没票跟着的新话题都先进主编排**（分支 CI 除外，见 8.5）。它是唯一做归属判断的地方。

### 为什么 attach 不写 `triage`

attach 只加一条订阅，`unlink_thread` 只删一条订阅。写 `triage` 会让两者不对称：
摘除时没人记得原值，话题就成了「订阅没了、路由还在」的孤儿 ——
消息继续投给 A 项目，A 查不到任何票跟着它，于是当新活，在自己的项目里给别人的仓库开 worktree。

副作用是合理的：一条话题可以同时被两个项目的票跟着，消息投给两处，各自决定怎么办。

---

## 3. 任务生命周期

```mermaid
stateDiagram-v2
    direction LR
    [*] --> waiting : create_ticket
    waiting --> queued : 依赖满足但并发满
    waiting --> running : create_worker
    queued --> running : 腾出并发位
    running --> review : Worker 报 ready
    running --> waiting : Worker 结束需重开
    review --> done : PR merged
    review --> running : 有新改动要求
    waiting --> cancelled : 人类放弃
    running --> cancelled : 人类放弃
    queued --> cancelled : 人类放弃
    review --> cancelled : 人类放弃
    done --> [*]
    cancelled --> [*]
```

**没有 `draft`。** 任务一旦存在，`projectId` 就必须确定 ——「还没想好归谁」属于话题分诊。

**没有 `attention`。** 工单可以一边 `running` 一边等人，覆盖 `status` 会丢掉它跑到哪一步。
「需介入」是派生的：存在指向它、`kind=ask`、`status=pending` 的 `Inbox`。

### 任务之间的关联

| kind | 影响 | 谁写 |
| --- | --- | --- |
| `depends` | `relatedId` 没做完，`ticketId` 停在 `waiting` | 同项目 `project` 的 `link_ticket`；跨项目 `supervisor` 的 `link_dependency` |
| `relates` | 无 | 同上 |

`depends` 的第二个作用：`relatedId` 到终态时**系统自动通知 Supervisor**（见第 7 章）。
同项目内没有 Supervisor，通知静默 —— 但**依赖约束照常生效**，由 `project` 自己看 `list_ticket`。

---

## 4. Worker 生命周期

```mermaid
stateDiagram-v2
    direction LR
    [*] --> queued : create_worker
    queued --> running : worktree 建好
    queued --> ended : 未起即作废
    running --> ended : 正常 / 被停 / 失败
    ended --> [*]
```

`branch` / `worktree` 在 `queued` 时为空，`running` 起填上，`ended` 后**保留不删** ——
那是「这个任务曾经在哪个分支上干过」的唯一记录。

| `WorkerEndReason` | 编排动作 |
| --- | --- |
| `completed` | 看 `reportState` 定任务状态 |
| `stopped` | 任务回 `waiting` |
| `failed` | 回 `waiting`，或转人工 |
| `restarted` | 回 `waiting`，自动重开 |

### 汇报状态

`reportState` 是结构化通道，和会话正文（`view` 读的）是两回事。

```mermaid
flowchart LR
    P["progress"] --> R{"干完了吗"}
    R -->|是| READY["ready<br/>PR 已开 → Ticket review"]
    R -->|失败| F["failed → Ticket waiting"]
    R -->|"这事不用做"| D["dropped<br/>直接结束，不发消息"]
```

「我在等答复」归 `ask`，不占状态位。`dropped` 是「什么都不做」的合法表达 ——
没有它，Worker 遇到复现不了或已被别人修好的活，只能谎报 `ready` 或白问一次人。

---

## 5. 汇报与求助

**人类也是一个收件人。** 把 `type=user` 放进 `InboxTarget` 之后，「问人」和「问上级」是同一件事的两种取值。

```
worker     → project
project    → main          （给 supervisorId 则 → supervisor）
supervisor → main
main       → user（ask_user）
```

各角色工具的参数差异见 [agents/README.md](agents/README.md#汇报与求助)，不在这里重复。

### 升级：就地改 `type`，不新建记录

```mermaid
stateDiagram-v2
    direction LR
    [*] --> user : ask_user
    user --> project : 超时 + 代理选择开
    user --> answered : 人抢答
    project --> main : 超时 或 escalate
    project --> answered : 项目编排答了
    main --> answered : 主编排答了
    main --> user : 答不了，改问人（新的一条）
    answered --> [*]
```

一个问题只有一条记录、一个身份，任何时候只有一个处理者。
每次升级更新：`type` 改上一级、`escalations+1`、`lastEscalatedAt=now`、
`deadline` 重置（升到 main 则置空）、`status` 保持 `pending`。

**只有从 `user` 升级出去的那一次要回渠道补一句话** —— 因为只有 `type=user`
意味着问题已经问出口了。

---

## 6. 收件箱投递规则

```mermaid
flowchart LR
    subgraph 来源
        CH["channel"]; SY["system"]; MA["main"]; PR["project"]; SU["supervisor"]; WK["worker"]
    end
    subgraph 目标
        TMA["type=main"]; TPR["type=project"]; TSU["type=supervisor"]; TU["type=user"]
    end

    CH -->|trigger| TMA
    CH -->|已分诊| TPR
    SY --> TMA
    SY --> TPR
    MA -->|ticket / notice| TPR
    MA -->|ask_user| TU
    MA -->|attach / detach| TSU
    PR -->|report / ask| TMA
    PR -->|"带 supervisorId"| TSU
    SU -->|ticket / notice| TPR
    SU -->|report / ask| TMA
    WK -->|report / ask| TPR
```

三条边界：`type=user` 只有 main 能写；`type=supervisor` 只有 main 和 project 能写；
**Worker 没有收件箱**，上级的话直接 prompt 进会话。

### 三个状态

| `status` | 含义 | 进「N 条未处理」吗 |
| --- | --- | :-: |
| `pending` | 还没轮到 | ✅ |
| `done` | 处理完了 | — |
| `stalled` | **投递卡住**：重试 N 次都失败 | ❌ 单独显示 |

`stalled` 不是「没轮到」，是「送不到」。混进未读数会让人以为消息还在排队。
退避 2s → 4s → … → 封顶 60s，连续失败 3 次转 `stalled`。

### 已读与顺序

`readAt` 记「会话把它取进上下文的时刻」，和 `status` 分开：
`pending` + 空 = 还在队列；`pending` + 有值 = 看到了没处理完；`done` = 处理完了。
票结束时，`pending` 且 `readAt` 为空的消息**退回**，重新投给接手的人。

同一票对同一地址按 `seq` 顺序发：前一条没成功，后一条等着。不同票之间不等 ——
没有它，Worker 先回的「收到」可能比半小时后的「改好了」后到。

会话结束或空闲时，框架数一下自己名下 `status=pending` 的条数提示「你有 N 条消息未处理」。
**超时检查不靠后台定时器**，和这次提示共用同一次会话钩子。

---

## 7. 跨项目 Supervisor

```mermaid
stateDiagram-v2
    direction LR
    [*] --> active : create_supervisor
    active --> active : attach / detach
    active --> closed : 关联工单全部 done（插件自动）
    active --> closed : 主编排 close_supervisor
    closed --> [*] : 从界面消失，行保留
```

**两条收口语义都不需要会话动手** —— 全部 done 是插件推导的，强关是主编排的决定。
有票 `cancelled` 不走自动关，只通知主编排。完整规则见
[supervisor.md](agents/supervisor.md#收工)，这里只讲唤醒与兜底。

### 唤醒：四个来源

| 来源 | 触发 |
| --- | --- |
| 主编排 | `create_supervisor` / `attach` / `detach` / `close` |
| 项目编排 | `report` / `ask` 带 `supervisorId` |
| 系统兜底 | 依赖已完成（见下） |
| 自动关停 | 关联票全 `done` → 直接关，**不叫醒** |

### 兜底：依赖完成时自动通知

```mermaid
sequenceDiagram
    participant P as 项目编排
    participant DB as TicketLink
    participant K as 插件
    participant S as Supervisor

    P->>S: link_dependency(T-105, dependsOn=T-200)
    Note over DB: T-105 depends on T-200
    P->>DB: Worker report(ready) → 引擎结单
    DB->>K: relatedId=T-200 的 depends 行
    K->>K: 查 T-105 属于哪个 Supervisor
    K->>S: Inbox kind=notice「T-200 完成了」
```

**为什么需要**：项目编排本来就该在工单进终态时 `report`，但漏报会让整条跨项目链路停摆。
依赖关系已经在 `TicketLink` 里，顺手兜一下不费事。

它**只兜一层**：同项目内的依赖没有 Supervisor，通知静默，由 `project` 自己看 `list_ticket`。
静默的只是通知，`depends` 的约束照常生效。

---

## 8. 触发点：PR 与 CI

### 8.1 PR 上的事件

| 事件 | `TriggerKind` | 走触发？ |
| --- | --- | :-: |
| PR 打开 | `open` | ✅ |
| 对话区 / 行内评论 | `comment` | ✅ |
| Review（含无正文的通过打回） | `comment` | ✅ |
| CI 变化 | `ci` | ✅ |
| **合并 / 关闭** | — | ❌ 引擎直接结单 |

**Review 没写正文但点了 Approve 也要发** —— 点 Approve 本身就是答复，
吞掉它，等审批的 Worker 就永远等不到。

PR 和 issue 共用编号，但**话题不同**：issue 是 `github:42`，PR 是 `github:88`。
GitLab 编号是项目内递增，话题键要带项目：`gitlab:a/x:!42`。

### 8.2 PR 归谁处理

| 情况 | 谁处理 |
| --- | --- |
| 已绑定工单 —— 评论 / review | Worker |
| 已绑定工单 —— CI | 项目编排 |
| 已绑定工单 —— 合并 / 关闭 | 引擎结单 |
| **没绑定** | 走触发 → 主编排分诊 |

**主编排只在没有归属时出场。** 已绑定 PR 的任何事件都不经过它。

### 8.3 合并 / 关闭：引擎结单

```
PR 合并 / 关闭 → closePull → threadClosed(thread, outcome, at)
  → 引擎直接 end(ticket)                    ← 结单在这里
  → emit('ticket.ended')
      ├─ 主编排收件箱 kind=notice            ← 只是通知
      └─ 代码托管渠道以外补一句话            ← GitHub/GitLab 时间线已有
```

三个关键点：

**① 结单是引擎做的。** 编排收到的是通知，不是「请你处理」。

**② `unfinished` 例外。** Worker 还有没报 `ready` 的活，或 PR 关后又起了新 Assignment
→ **不结单**，等 `ready`。防止「PR 合了但活没干完」被误判完成。

**③ `followsDone`：关注的话题全关才结单。**

我们的等价实现放在**渠道插件**（Host half）—— **Host 代码，不是代理工具**：

```
1. 按 TicketThread 找跟进这张 PR 的工单
2. 检查 unfinished
3. 没有 → 写 prState + status=done + endedAt
4. 有   → 只记 prState，留 review，等 report(ready)
5. 主编排 + 项目编排各投一条 kind=notice
6. 代码托管渠道以外发一句话；GitHub / GitLab 上不发
```

**为什么不走触发**：PR 合并时没有要判断的东西 —— 结论已经在代码托管平台上了。
走触发等于让编排重复确认一件已确定的事，还多一个「忘了处理就永远不关」的失败点。

### 8.4 PR 归哪张工单

```mermaid
flowchart TD
    A["PR #88 打开"] --> B{"分支名对得上?"}
    B -->|"对得上"| D["attach_thread_to_ticket + claim"]
    B -->|"对不上"| E{"正文引用了已有工单的 issue?"}
    E -->|是| F["attach_thread_to_ticket"]
    E -->|否| G["当新活 create_ticket"]
    D --> H["插件记 prUrl / prState"]
    F --> H
```

| 依据 | 可靠性 |
| --- | --- |
| 分支名末段 == `Worker.branch` 末段 | **确定性**，纯字符串比较 |
| 正文 `Closes #42` | 高，但作者可能不写 |
| 标题 / 内容相似 | 低，不要用 |

**分支名优先**，所以建分支时末段必须就是任务号：`nexus/T-105`。不这么做只能靠模型读正文猜。

### 8.5 两套 CI

| | 合并请求 CI | 分支 CI |
| --- | --- | --- |
| 看谁 | open ticket 的 PR / MR | 默认分支 head |
| 话题 | 跟 PR 共用 | **独立**（`github:ci:main`） |
| 能回复 | ✅ | ❌ **没有地址** |
| 开关 | 无条件 | 渠道开关，默认关 |

**防抖与渠道无关**：两套都用 `CiWatch.fingerprint` 记住上次快照，指纹变了才发。
各渠道数据形状不同（GitHub 是 `check-runs`，GitLab 是 `pipeline`），但算完都归到同一个字段 ——
**算法归渠道，表不关心它长什么样**。

两条最容易漏的规则：

- **首次只建基线，不发。** 没有它，每接一张新任务，第一次轮询都会因为「和空值不同」误报一次。
- **分支 CI：还有 check 在 running 就假装失败集合没变。** 没有它，跑到一半时
  「3 个失败」→「2 个失败」→「1 个失败」会连触发三次；有了它，恢复只在全绿后报一次。

失败判定：`failure` · `timed_out` · `cancelled` · `action_required` · `startup_failure` · `error`
（check-runs 看 `conclusion`，旧式 status 看 `state`）。

**投递**：PR CI 跟 PR 的 `triage` 走；分支 CI 直接投项目编排 —— 仓库已注册为项目，归属确定。

### 8.6 分支 CI 不能回复

分支 CI 的话题根本没有 channel 字段。`reply_channel` 拿到 `ThreadKind=ci` 的触发必须
**明确报错**，不能猜一个地方发。

---

## 9. 端到端时序

```mermaid
sequenceDiagram
    participant GH as GitHub
    participant CH as 插件
    participant M as 主编排
    participant P as 项目编排
    participant W as Worker
    participant U as 人类

    GH->>CH: issue #42 @bot
    CH->>M: Inbox kind=trigger
    M->>M: triage_thread(claim) + create_ticket
    M->>P: dispatch_ticket
    P->>W: create_worker

    W->>P: report(progress)
    W->>P: ask「需要改 B/x」
    alt 跨项目
        P->>M: ask「请考虑 Supervisor」
        M->>M: create_supervisor
        M->>P: answer
    else 问人
        P->>M: ask
        M->>U: ask_user
        U->>M: 回答
        M->>P: answer
    end
    P->>W: send(mode=reply)

    W->>U: 开 PR
    W->>P: report(ready)

    U->>CH: 合并
    CH->>CH: 引擎结单（Host half）
    CH->>P: Inbox kind=notice
    CH->>M: Inbox kind=notice
```

**同话题追加消息不经过主编排**：`TicketThread` 已有票跟着，直接投给该项目编排 ——
分诊已完成，不该被同一件事反复叫醒。

---

## 10. 状态速查表

| 枚举 | 取值 |
| --- | --- |
| `ThreadKind` | `issue` · `pull` · `chat` · `ci` |
| `ThreadTriage` | `pending` · `claimed` · `ignored` |
| `TriggerKind` | `comment` · `open` · `close` · `ci` · `push` |
| `TicketStatus` | `waiting` · `queued` · `running` · `review` · `done` · `cancelled` |
| `PullRequestState` | `open` · `merged` · `closed` |
| `CiState` | `pending` · `running` · `passing` · `failing` |
| `TicketLinkKind` | `depends` · `relates` |
| `WorkerStatus` | `queued` · `running` · `ended` |
| `WorkerEndReason` | `completed` · `stopped` · `failed` · `restarted` |
| `ReportState` | `progress` · `ready` · `failed` · `dropped` |
| `InboxTarget` | `user` · `main` · `project` · `supervisor` |
| `InboxOrigin` | `channel` · `main` · `project` · `worker` · `supervisor` · `system` |
| `InboxStatus` | `pending` · `done` · `stalled` |
| `InboxKind` | `trigger` · `ticket` · `ask` · `notice` |
| `InboxAnsweredBy` | `user` · `main` · `project` · `supervisor` · `worker` |
| `SupervisorStatus` | `active` · `closed` |

### 派生状态

| 想要 | 怎么算 |
| --- | --- |
| 任务需介入 | 存在指向它、`kind=ask`、`status=pending` 的 Inbox |
| 收件箱未读数 | `type=自己 AND status=pending` 的 count |
| 已升级的 ask | `escalations > 0` |
| Supervisor 自动关停 | 关联工单**全部 `done`** → 插件写 `closed` |
| Supervisor 待主编排决定 | 关联工单里有 `cancelled` → 只投 notice，不自动关 |
| 某票是不是某 Supervisor 的 | `SupervisorTicket` 有记录 |

`closed` 和票的状态同源：**都是事实推出来的，不是谁调用的结果。**
这也是 `close_self`、`update_ticket` 被删掉的原因 —— 让会话去写一个库里早就能算出的值，
只会多一个漏判的机会，不会多一分准确。
