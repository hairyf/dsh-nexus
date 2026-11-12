# 流程图

Nexus 的完整流转。所有状态名、字段名取自 `prisma/schema/`，可直接对照。

## 目录

1. [全景](#1-全景)
2. [触发与分诊](#2-触发与分诊)
3. [任务生命周期](#3-任务生命周期)
4. [Worker 生命周期](#4-worker-生命周期)
5. [ask 与升级](#5-ask-与升级)
6. [收件箱投递规则](#6-收件箱投递规则)
7. [跨项目 Supervisor](#7-跨项目-supervisor)
8. [端到端时序](#8-端到端时序)
9. [状态速查表](#9-状态速查表)

---

## 1. 全景

四个代理、三层架构。

```mermaid
flowchart TB
    subgraph 外部
        CH["渠道<br/>GitHub / GitLab / 飞书 / QQ / 微信"]
    end

    subgraph 编排层
        MAIN["主编排 main<br/>全局唯一 · 只分诊派活"]
        PROJ["项目编排 project<br/>每项目一个 · 管任务"]
        SUP["Supervisor<br/>跨项目时临时拉起"]
    end

    subgraph 执行层
        W1["Worker<br/>任务 T-105"]
        W2["Worker<br/>任务 T-200"]
    end

    CH -->|"Trigger"| TH["话题 Thread"]
    TH -->|"未分诊"| MAIN
    TH -->|"已分诊 claimed"| PROJ
    MAIN -->|"create_ticket · dispatch"| PROJ
    MAIN -->|"跨 ≥2 项目"| SUP
    SUP -->|"dispatch_to_project"| PROJ
    PROJ -->|"create_worker"| W1
    PROJ -->|"create_worker"| W2
    W1 -->|"report / ask"| PROJ
    W2 -->|"report / ask"| PROJ
    PROJ -->|"ask"| MAIN
    MAIN -->|"ask"| CH
    PROJ -->|"reply_channel"| CH
    W1 -->|"reply_channel"| CH
```

**代号约定**：`main` / `project` / `worker` / `supervisor` 是 Inbox 的 `type` 与 `origin` 取值，
也是四个代理在库里互相指代的名字。

---

## 2. 触发与分诊

一条 Trigger 落在 Thread 上之后，投给谁完全由 `Thread.triage` 决定。
**分诊只发生一次**，判完就固定下来，这是主编排不被同一件事反复叫醒的关键。

```mermaid
flowchart TD
    T["新 Trigger 到达<br/>写在 Thread 上"] --> Q{"Thread.triage"}

    Q -->|pending| M["投给主编排<br/>Inbox type=main<br/>origin=channel kind=trigger"]
    Q -->|claimed| P["投给该项目编排<br/>Inbox type=project<br/>projectId=Thread.projectId"]
    Q -->|ignored| I{"Trigger.mentioned?"}

    I -->|否| DROP["不投递<br/>只留在 Trigger 表里"]
    I -->|是| M2["重新叫醒主编排<br/>Inbox type=main"]

    M --> TRIAGE["主编排 triage_thread"]

    TRIAGE -->|"claim + projectId"| C["Thread.triage=claimed<br/>triagedAt=now"]
    TRIAGE -->|ignore| G["Thread.triage=ignored<br/>triagedAt=now"]
    TRIAGE -->|"要开工"| C2["claim 后<br/>create_ticket"]

    C --> NEXT["此后该话题的触发<br/>直接进项目编排收件箱"]
    G --> DROP2["此后不再投递<br/>除非有人 @"]
```

### 分诊判断依据

| 情况 | 动作 | 结果 |
| --- | --- | --- |
| 仓库能直接对上某个项目 | `triage_thread(claim, projectId)` | 后续触发归该项目 |
| 是提问 / 闲聊 / 通知，不需要动作 | `triage_thread(ignore)` | 不再投递 |
| 判完才发现要做 | `create_ticket` + `dispatch_ticket` | 任务进入项目 |
| 真拿不准 | `ask(askTo='user')` | 停下来问人，不猜 |

> **判重**：已有任务覆盖同一话题（`TicketThread` 有记录）时，不再开新任务，
> 只把 `triage` 判到同一项目。任务和话题的关系记在 `TicketThread` 上。

---

## 3. 任务生命周期

`Ticket.status` 的六种取值与流转。

```mermaid
stateDiagram-v2
    direction LR
    [*] --> waiting : create_ticket

    waiting --> queued : 依赖已满足<br/>但并发已满
    waiting --> running : create_worker
    waiting --> cancelled : 人类放弃

    queued --> running : 腾出并发位<br/>create_worker
    queued --> cancelled : 人类放弃

    running --> review : Worker 报告 ready<br/>PR 已开
    running --> waiting : Worker 结束<br/>需重开
    running --> cancelled : 人类放弃

    review --> done : PR merged
    review --> running : 有新的改动要求
    review --> cancelled : 人类放弃

    done --> [*]
    cancelled --> [*]
```

### 两条不存在的状态

**没有 `draft`。** 任务一旦存在，`projectId` 就必须是确定的。
「这件事我看到了，但还没定要不要做」属于话题分诊阶段（`Thread.triage`），
不该污染任务列表。

**没有 `attention`。** 一张工单完全可以一边 `running` 一边等人 ——
把 `status` 覆盖成 `attention` 会丢掉它本来跑到哪一步。所以「需介入」是**派生的**：

```sql
-- 需介入 = 存在指向它的 pending ask
SELECT * FROM ticket t
WHERE EXISTS (
  SELECT 1 FROM inbox i
  WHERE i.ticketId = t.id AND i.kind = 'ask' AND i.status = 'pending'
)
```

### 任务之间的关联

`TicketLink.kind` 两种，方向永远是 `ticketId` 指向 `relatedId`：

```mermaid
flowchart LR
    A["T-105<br/>项目 A"] -->|"kind=depends<br/>等 B 先做"| B["T-200<br/>项目 B"]
    C["T-106"] ---|"kind=relates<br/>只是相关，谁都不等"| D["T-107"]
```

| kind | 语义 | 对状态的影响 |
| --- | --- | --- |
| `depends` | `relatedId` 没做完，`ticketId` 就停在 `waiting` | 阻塞推进 |
| `relates` | 只是相关（对称，存一条就够） | 无 |

---

## 4. Worker 生命周期

一个任务可以先后有多个 Worker（重试、换人），对应详情页的「执行会话 (1~5) 个」。

```mermaid
stateDiagram-v2
    direction LR
    [*] --> queued : create_worker
    queued --> running : worktree 建好
    queued --> ended : 未起即作废
    running --> ended : 正常 / 被停 / 失败
    ended --> [*]
```

`branch` / `worktree` 在 `queued` 时为空，`running` 起填上，`ended` 后保留不删 ——
那一行是「这个任务曾经在哪个分支上干过」的唯一记录。完整字段变化见
[一个 Worker 的完整字段生命周期](#9-状态速查表)。

**一个 Worker 只对应一个 worktree。** 它没有「挂了几个仓库」的概念 ——
跨项目协作靠 Supervisor，不靠一个会话改多个仓库。

### Worker 结束原因

| `WorkerEndReason` | 含义 | 编排通常怎么做 |
| --- | --- | --- |
| `completed` | 正常结束 | 看 `reportState` 定任务状态 |
| `stopped` | 被 `cancel` 停掉 | 任务回 `waiting`，等重开 |
| `failed` | 失败 | 任务回 `waiting`，或转人工 |
| `restarted` | 宿主重启打断 | 任务回 `waiting`，自动重开 |

### 汇报状态

`Worker.reportState` 是**结构化通道**，和会话正文（`view` 读的那条）是两回事。

```mermaid
flowchart LR
    P["progress<br/>还在跑"] --> R{"干完了吗"}
    R -->|是| READY["ready<br/>PR 已开，可审"]
    R -->|卡住| B["blocked<br/>自己解不了"]
    R -->|等问| W["waiting<br/>配合 ask"]
    R -->|失败| F["failed<br/>需重试或人介入"]

    READY --> TICK{"Ticket 转 review"}
    B --> ASK["ask 出去"]
    W --> ASK
    F --> TICK2{"Ticket 回 waiting"}
```

| `reportState` | 语义 | 编排动作 |
| --- | --- | --- |
| `progress` | 还在跑 | 不动，别打扰 |
| `waiting` | 停在等人（配合 `ask`） | 等答案，或升级 |
| `ready` | 干完了，PR 已开 | `update_ticket(status=review)` |
| `blocked` | 卡住，自己解不了 | 答 ask / 干预 / 升级 |
| `failed` | 失败了 | `update_ticket(status=waiting)` 重开 |

---

## 5. ask 与升级

**人类也是一个收件人。** 这是整个设计的关键：把 `type=user` 放进 `InboxTarget` 之后，
「问人类」和「问上级」就变成同一件事的不同取值，而不是两套流程。

### 5.1 提问的两个方向

```mermaid
flowchart TD
    W["Worker 卡住"] --> WH{"问谁"}

    WH -->|"我们想要什么"| U["ask(askTo=user)<br/>Inbox type=user<br/>origin=worker kind=ask<br/>带 deadline"]
    WH -->|"技术上怎么配合"| P["ask(askTo=project)<br/>Inbox type=project<br/>origin=worker kind=ask"]

    U --> CHOUT["锚定一条 Trigger<br/>往那个渠道发问题"]
    P --> NONECH["不碰渠道<br/>只在代理间流转"]
```

`ask` 的定位靠 `Inbox.triggerId`：一条任务可以有好几个消息源，
但一个问题只会锚在一条触发上 —— 这是多消息源下唯一不歧义的答案。

### 5.2 升级链

升级**就地改 `type`，不新建记录**。一个问题从头到尾只有一条记录、一个身份，
任何时刻都只有一个处理者，永远不会出现两条 pending 抢同一件事。

```mermaid
stateDiagram-v2
    direction LR
    [*] --> user : Worker ask(askTo=user)

    user --> project : 超时 + 代理选择开<br/>escalations += 1<br/>deadline 重置
    user --> answered : 人在 UI / 渠道抢答

    project --> main : 超时 或 项目编排 escalate
    project --> answered : 项目编排答了

    main --> answered : 主编排答了
    main --> user : 主编排答不了<br/>改问人（新的一条）

    answered --> [*]
```

每一步都会更新：

| 字段 | 升级时 |
| --- | --- |
| `type` | 改成上一级 |
| `escalations` | +1 |
| `lastEscalatedAt` | now |
| `deadline` | 重置（已升到 main 则置空） |
| `status` | 保持 `pending` |

### 5.3 回答与回送

```mermaid
sequenceDiagram
    participant W as Worker
    participant DB as Inbox
    participant P as 项目编排
    participant M as 主编排
    participant U as 人类/渠道

    W->>DB: ask(askTo=project)
    DB-->>P: type=project 投递
    P->>P: 看任务上下文
    alt 答得了
        P->>DB: answer + answeredBy=project
    else 答不了，原样上交
        P->>DB: escalate<br/>type→main escalations+1
        DB-->>M: 转投主编排
        M->>DB: answer + answeredBy=main
    end
    DB->>DB: status=done
    DB-->>W: 答案顺着 workerId prompt 回会话
    W->>W: 继续干活
```

### 5.4 `escalate` 和 `ask(to='main')` 的区别

最容易用错的一对。

| | `escalate(askId)` | `ask(to='main')` |
| --- | --- | --- |
| 问题 | **同一个问题**，原样往上递 | **另一个新问题** |
| 记录 | 就地改现有那条的 `type` | 新建一条 Inbox |
| 原 ask | 已转走 | 还挂着，等我拿到答复再回去答 |
| 什么时候用 | 我不懂、上级懂 | 我看出这事得跨项目协同 |

```mermaid
flowchart TD
    A["Worker: 需要同步改 B/x，阻塞"] --> B{"项目编排"}
    B -->|"我不懂这个技术点"| C["escalate<br/>同一条记录改投 main"]
    B -->|"这得跨项目协调"| D["ask(to=main)<br/>新建一条<br/>「请考虑创建 Supervisor」"]
    C --> E["主编排答"]
    D --> E2["主编排建 Supervisor 并回答"]
    E --> F["答案回 Worker"]
    E2 --> G["项目编排再 send(mode=reply)<br/>回 Worker"]
```

---

## 6. 收件箱投递规则

`Inbox.type` 是「此刻轮到谁」，`Inbox.origin` 是「谁发起的」。
两者合起来决定方向。

### 6.1 谁能投给谁

```mermaid
flowchart LR
    subgraph 来源
        CH["channel"]
        SY["system"]
        MA["main"]
        PR["project"]
        SU["supervisor"]
        WK["worker"]
    end

    subgraph 目标
        TMA["type=main"]
        TPR["type=project"]
        TSU["type=supervisor"]
        TU["type=user"]
    end

    CH -->|trigger| TMA
    CH -->|trigger 已分诊| TPR
    SY --> TMA
    SY --> TPR

    MA -->|ticket 派工| TPR
    MA -->|ask| TU

    PR -->|ask 答不了| TMA
    PR -->|ask| TU

    SU -->|ticket 派工| TPR
    SU -->|ask| TMA
    SU -->|ask| TU

    WK -->|ask 技术| TPR
    WK -->|ask 决策| TU
    WK -->|report| TPR
```

**Worker 没有收件箱。** 它短命、被动、在等的时候是阻塞的，
所以上级的话必须直接 prompt 进会话，不能进队列等它来取。

### 6.2 消费与提示

```mermaid
flowchart TD
    A["代理被唤醒"] --> B["inbox_list<br/>type=自己 AND status=pending"]
    B --> C{"逐条处理"}
    C -->|"kind=ask"| D["先答 ask<br/>提问方在阻塞"]
    C -->|"kind=trigger"| E["分诊 / 判重"]
    C -->|"kind=ticket"| F["派工 / 更新"]
    C -->|"kind=notice"| G["看一眼"]
    D --> H["inbox_kill"]
    E --> H
    F --> H
    G --> H
    H --> I{"还有 pending?"}
    I -->|有| C
    I -->|没有| J["结束回合<br/>不要空转"]
```

会话结束（或空闲）时，框架数一下自己名下 `status = pending` 的条数，
提示「你有 N 条消息未处理」。**超时检查不靠后台定时器**，和这次提示共用同一次会话钩子。

---

## 7. 跨项目 Supervisor

一个 Worker 只有一个 worktree，所以跨项目**没有别的路**：要么拉 Supervisor，
要么拆成两条独立任务各自走。这两种都由主编排决定。

```mermaid
stateDiagram-v2
    direction LR
    [*] --> active : create_supervisor
    active --> closed : 工单全部落地
    active --> closed : 主编排强关
    closed --> [*] : 从界面消失，行保留
```

`active` 期间它做的事（不改变状态）：

| 动作 | 触发时机 |
| --- | --- |
| `dispatch_to_project` | 某项目还没派活，或有新步骤要推进 |
| `link_dependency` | 发现「谁等谁」，写进 `TicketLink(kind=depends)` |
| `answer` | 项目编排把下级 ask 递上来了 |
| `ask(to='main')` | 自己推不动，往主编排上报 |

### 收工条件

```mermaid
flowchart TD
    A["list_tickets"] --> B{"全部 ∈ done / cancelled ?"}
    B -->|是| C["close_self<br/>status=closed + closedAt"]
    B -->|否| D{"有工单卡在<br/>waiting / blocked ?"}
    D -->|是| E["继续协调<br/>不许收工"]
    D -->|"且推不动"| F["ask(to=main)<br/>说明卡点"]
```

**有工单停在 `waiting` / `blocked` 时不许收工**，那是还没做完。
`close_self` 之后行不删 —— 那几张工单还指着它说明自己当初为什么存在。

---

## 8. 端到端时序

一个完整例子：GitHub 上一个 issue @ 了我们，最终合出 PR。

```mermaid
sequenceDiagram
    autonumber
    participant GH as GitHub
    participant CH as Channel 插件
    participant TH as Thread
    participant M as 主编排
    participant P as 项目编排 A
    participant W as Worker
    participant U as 人类

    GH->>CH: issue #42 有人 @bot
    CH->>TH: 写 Trigger（幂等 id）
    CH->>M: Inbox type=main kind=trigger
    M->>TH: triage_thread(claim, projectId=A)
    M->>M: create_ticket T-105 + dispatch
    M->>P: Inbox type=project kind=ticket

    P->>P: 查 TicketThread 判重
    P->>W: create_worker（建 worktree + 分支）
    W->>W: 读代码 / 改代码 / 跑测试

    W->>P: report(progress)
    W->>W: 发现要改 B/x
    W->>P: ask(askTo=project)

    alt 项目编排能协调
        P->>P: ask(to=main) 请考虑 Supervisor
        P->>M: Inbox type=main kind=ask
        M->>M: create_supervisor（关联 T-105 + T-200）
        M->>P: answer
        P->>W: send(mode=reply)
    else 需要人拍板
        P->>W: ask(to=user) 走渠道
        W->>U: 渠道里出现一个问题
        U->>W: 回答（或超时升级到 main）
    end

    W->>W: 继续干活
    W->>U: 开 PR
    W->>P: report(ready)
    P->>P: update_ticket(status=review)

    U->>P: 审完合并 PR
    P->>P: update_ticket(prState=merged, status=done)
```

### 另一条常见路径：同话题追加消息

```mermaid
sequenceDiagram
    autonumber
    participant GH as GitHub
    participant TH as Thread
    participant P as 项目编排
    participant W as Worker

    Note over TH: Thread.triage 已是 claimed
    GH->>TH: 同一 PR 上有人追加评论
    TH->>P: Inbox type=project kind=trigger
    P->>P: TicketThread 有记录 → 属于 T-105
    P->>P: link_thread（如未挂）
    alt 需要 Worker 知道
        P->>W: send(mode=queue)
    else 只是闲聊
        P->>P: inbox_kill 就好
    end
```

**这条路径不经过主编排** —— 分诊已经完成，主编排不该被同一件事反复叫醒。

---

## 9. 状态速查表

### 枚举取值总表

| 枚举 | 取值 |
| --- | --- |
| `AccountRole` | `bot` · `admin` |
| `AccountStatus` | `online` · `offline` |
| `ThreadKind` | `issue` · `pull` · `chat` |
| `ThreadTriage` | `pending` · `claimed` · `ignored` |
| `TriggerKind` | `comment` · `open` · `close` · `merge` · `ci` · `push` |
| `TicketStatus` | `waiting` · `queued` · `running` · `review` · `done` · `cancelled` |
| `PullRequestState` | `open` · `merged` · `closed` |
| `CiState` | `pending` · `running` · `passing` · `failing` |
| `TicketLinkKind` | `depends` · `relates` |
| `WorkerStatus` | `queued` · `running` · `ended` |
| `WorkerEndReason` | `completed` · `stopped` · `failed` · `restarted` |
| `ReportState` | `progress` · `waiting` · `ready` · `blocked` · `failed` |
| `InboxTarget` | `user` · `main` · `project` · `supervisor` |
| `InboxOrigin` | `channel` · `main` · `project` · `worker` · `supervisor` · `system` |
| `InboxStatus` | `pending` · `done` |
| `InboxKind` | `trigger` · `ticket` · `ask` · `notice` |
| `InboxAnsweredBy` | `user` · `main` · `project` · `supervisor` · `worker` |
| `SupervisorStatus` | `active` · `closed` |

### 派生状态

有些「状态」不占字段，直接查出来：

| 想要 | 怎么算 |
| --- | --- |
| 任务需介入 | 存在 `ticketId` 指向它、`kind=ask`、`status=pending` 的 Inbox |
| 收件箱未读数 | `type=自己 AND status=pending` 的 count |
| 已升级的 ask | `escalations > 0` |
| 任务实际负责的 Worker | `Worker.ticketId` 最新那条（或 `status=running` 那条） |
| Supervisor 该收工 | 关联工单全部 ∈ `{done, cancelled}` |
| 话题是不是已经判过 | `Thread.triage != pending` |

### 一个 Worker 的完整字段生命周期

| 时刻 | `status` | `branch` / `worktree` | `reportState` | `endedReason` |
| --- | --- | --- | --- | --- |
| `create_worker` 登记 | `queued` | 空 | 空 | 空 |
| worktree 建好、会话起来 | `running` | 已填 | 空 | 空 |
| 跑起来第一次汇报 | `running` | 已填 | `progress` | 空 |
| 干完 | `running` | 已填 | `ready` | 空 |
| 收工 | `ended` | 已填 | `ready` | `completed` |
