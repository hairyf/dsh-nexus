import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export const AccountRole = {
    bot: "bot",
    admin: "admin"
} as const;
export type AccountRole = (typeof AccountRole)[keyof typeof AccountRole];
export const AccountStatus = {
    online: "online",
    offline: "offline"
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];
export const InboxTarget = {
    user: "user",
    main: "main",
    project: "project",
    supervisor: "supervisor"
} as const;
export type InboxTarget = (typeof InboxTarget)[keyof typeof InboxTarget];
export const InboxOrigin = {
    channel: "channel",
    main: "main",
    project: "project",
    worker: "worker",
    supervisor: "supervisor",
    system: "system"
} as const;
export type InboxOrigin = (typeof InboxOrigin)[keyof typeof InboxOrigin];
export const InboxStatus = {
    pending: "pending",
    done: "done",
    stalled: "stalled"
} as const;
export type InboxStatus = (typeof InboxStatus)[keyof typeof InboxStatus];
export const InboxKind = {
    trigger: "trigger",
    ticket: "ticket",
    ask: "ask",
    notice: "notice"
} as const;
export type InboxKind = (typeof InboxKind)[keyof typeof InboxKind];
export const InboxAnsweredBy = {
    user: "user",
    main: "main",
    project: "project",
    supervisor: "supervisor",
    worker: "worker"
} as const;
export type InboxAnsweredBy = (typeof InboxAnsweredBy)[keyof typeof InboxAnsweredBy];
export const SupervisorStatus = {
    active: "active",
    closed: "closed"
} as const;
export type SupervisorStatus = (typeof SupervisorStatus)[keyof typeof SupervisorStatus];
export const ThreadKind = {
    issue: "issue",
    pull: "pull",
    chat: "chat",
    ci: "ci"
} as const;
export type ThreadKind = (typeof ThreadKind)[keyof typeof ThreadKind];
export const ThreadTriage = {
    pending: "pending",
    claimed: "claimed",
    ignored: "ignored"
} as const;
export type ThreadTriage = (typeof ThreadTriage)[keyof typeof ThreadTriage];
export const TriggerKind = {
    comment: "comment",
    open: "open",
    close: "close",
    ci: "ci",
    push: "push"
} as const;
export type TriggerKind = (typeof TriggerKind)[keyof typeof TriggerKind];
export const TicketLinkKind = {
    depends: "depends",
    relates: "relates"
} as const;
export type TicketLinkKind = (typeof TicketLinkKind)[keyof typeof TicketLinkKind];
export const TicketStatus = {
    waiting: "waiting",
    queued: "queued",
    running: "running",
    review: "review",
    done: "done",
    cancelled: "cancelled"
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];
export const PullRequestState = {
    open: "open",
    merged: "merged",
    closed: "closed"
} as const;
export type PullRequestState = (typeof PullRequestState)[keyof typeof PullRequestState];
export const CiState = {
    pending: "pending",
    running: "running",
    passing: "passing",
    failing: "failing"
} as const;
export type CiState = (typeof CiState)[keyof typeof CiState];
export const WorkerStatus = {
    queued: "queued",
    running: "running",
    ended: "ended"
} as const;
export type WorkerStatus = (typeof WorkerStatus)[keyof typeof WorkerStatus];
export const WorkerEndReason = {
    completed: "completed",
    stopped: "stopped",
    failed: "failed",
    restarted: "restarted"
} as const;
export type WorkerEndReason = (typeof WorkerEndReason)[keyof typeof WorkerEndReason];
export const ReportState = {
    progress: "progress",
    ready: "ready",
    failed: "failed",
    dropped: "dropped"
} as const;
export type ReportState = (typeof ReportState)[keyof typeof ReportState];
export type Channel = {
    /**
     * 'github' | 'gitlab' | 'feishu' | 'qq' | 'wechat'
     * 故意保持 String：这是身份而非状态，新增渠道只要插一行，不该逼一次迁移。
     *
     * **它同时决定用哪份 skill**：`nexus-channel-<id>`，
     * 例如 `github` → `assets/skills/nexus-channel-github/SKILL.md`。
     * 一个渠道一份 skill，不搞别名。
     */
    id: string;
    /**
     * 展示名
     */
    name: string;
    /**
     * 是否开启监听；关掉的渠道不会再产生触发
     */
    enabled: Generated<number>;
    /**
     * 自建 GitLab 的站点地址。仅 gitlab 使用，SaaS 留空即 `gitlab.com`。
     */
    host: string | null;
    createdAt: string;
};
export type ChannelAccount = {
    id: string;
    channelId: string;
    role: AccountRole;
    /**
     * 渠道侧的显示名，例如 GitHub 登录名、飞书用户名
     */
    name: string;
    avatar: string | null;
    status: Generated<AccountStatus>;
    createdAt: string;
};
export type CiWatch = {
    id: string;
    /**
     * 观察点在哪条渠道
     */
    channelId: string;
    /**
     * 观察目标：
     * 'branch' 默认分支。ref 是分支名，例如 `main`
     * 'pull'   某张 PR 的 head。ref 是 PR 号
     */
    kind: string;
    /**
     * 'branch' 时是分支名，'pull' 时是 PR 号
     */
    ref: string;
    /**
     * 观察目标的当前指纹。
     * 'branch'：失败 check 名的排序 JSON，例如 `["lint","test"]`
     * 'pull'  ：整份快照的哈希
     * 和它相等就说明没变，不发触发
     */
    fingerprint: string;
    /**
     * 发过几次触发。每次变化 +1，进触发 id 保证重复轮询得到同一个 id
     */
    revision: Generated<number>;
    /**
     * 'branch' 专用：上一次看到的 head sha。
     * 分支换了提交但 CI 结果恰好一样时，靠它区分「仍是旧结论」还是「新一轮」
     */
    head: string | null;
    updatedAt: string;
};
export type Inbox = {
    id: string;
    /**
     * 入队顺序。**同一票对同一地址按它顺序发**：前一条没成功，后一条等着，
     * 避免「结果」比「确认」先到。不同票之间不互相等
     */
    seq: number;
    /**
     * 此刻轮到谁处理。
     * Worker 没有收件箱：它短命、被动、在等的时候是阻塞的，
     * 所以上级的话必须直接 prompt 进会话，不能进队列等它来取。
     */
    type: InboxTarget;
    /**
     * 关于哪个项目。type = project 时必填；type = main 时为空表示全局事务，
     * 有值表示这条是某个项目升上来的（主编排据此知道该翻哪个项目的上下文）
     */
    projectId: string | null;
    /**
     * 临时 Supervisor；type = supervisor 时必填
     */
    supervisorId: string | null;
    origin: InboxOrigin;
    status: Generated<InboxStatus>;
    kind: InboxKind;
    /**
     * 一行摘要，列表展示用
     */
    title: string | null;
    /**
     * 正文，代理读到的内容；ask 时就是那个问题本身
     */
    message: string;
    createdAt: string;
    /**
     * 被标记为已处理的时间
     */
    doneAt: string | null;
    /**
     * 投递尝试次数。成功一次就清零
     */
    deliveryAttempts: Generated<number>;
    /**
     * 最近一次投递失败的原因；成功后清空
     */
    deliveryError: string | null;
    /**
     * 下次重试的时刻。退避 2s → 4s → … → 60s 封顶；
     * 连续失败 3 次转 stalled
     */
    nextRetryAt: string | null;
    /**
     * 会话把它取进上下文的时刻。
     * 判定：取进某一步、且之后报了 report 或结束回合，才算数。
     * 为空 = 还在队列；有值 = 看到了但没处理完
     */
    readAt: string | null;
    /**
     * 到这个时刻还没人回答，就看「代理选择」开关要不要升级给上一级。
     * 人在 UI / 渠道里随时可以抢答，所以它是「升级时间」而不是「失效时间」。
     * 已升到主编排的 ask 不再需要它，置空即可
     */
    deadline: string | null;
    /**
     * 升过几次级；0 表示一次没升过。面板可以显示「已升级 2 次」
     */
    escalations: Generated<number>;
    lastEscalatedAt: string | null;
    /**
     * 回答。填上它就把 status 置为 done，同时把答案顺着 workerId 送回发起方
     */
    answer: string | null;
    answeredBy: InboxAnsweredBy | null;
    answeredAt: string | null;
    /**
     * 这条消息是由哪条触发 / 哪个话题 / 哪个任务 / 哪个 Worker 冒出来的，都可能为空。
     * 代理靠它决定「要不要去看那条触发 / 那个任务的上下文」，而不是靠猜正文。
     *
     * 对 ask 来说 triggerId 还有第二个用处：它是「这个问题往哪个渠道发」的锚点。
     * 一条任务可以有好几个消息源，但一个问题只会锚在一条触发上 ——
     * 这就是官方 attentionTriggerId 的做法，也是多消息源下唯一不歧义的答案。
     */
    triggerId: string | null;
    threadId: string | null;
    ticketId: string | null;
    workerId: string | null;
};
export type Project = {
    id: string;
    /**
     * 项目挂在哪条 git 渠道下
     */
    channelId: string;
    /**
     * 仓库全名，例如 `hairyf/dsh-third-kernel`
     */
    name: string;
    /**
     * 对应的 DSH 工作区 id；一个工作区最多属于一个项目
     */
    workspaceId: string;
    /**
     * 本地克隆目录
     */
    directory: string;
    /**
     * 项目编排会话 id；为空表示还没起过。冒号后面的 session 可以随时换，这里只记最近一次
     */
    orchestratorSessionId: string | null;
    createdAt: string;
    updatedAt: string;
};
export type Setting = {
    /**
     * 固定 `global`
     */
    id: string;
    /**
     * 同时能跑几个 Worker（槽位上限）。超出就排队 `queued`。范围 1–16。
     *
     * **额外留 1 个槽位给「人的消息」和状态查询**：正常槽位满时仍能插进去，
     * 所以新人派活永远挤不掉你已经在做的活。
     */
    maxWorkers: Generated<number>;
    /**
     * 后台工作最多还能跑几分钟。到点杀掉后台、把票报成 waiting。
     *
     * 回合结束时如果还有 shell job 或 subagent 在跑，票继续占着槽位、继续算
     * working，不报 waiting —— 否则槽位被别的票占了，任务起了服务器却没人接。
     */
    backgroundLimitMinutes: Generated<number>;
    /**
     * 自动合并。**默认关**。
     *
     * 开着时也只对本票开的 PR 生效，且要满足：`ready`、批准覆盖 head、
     * 增删合计小于行数阈值。推新版本前先撤销自动合并。
     */
    autoMerge: Generated<number>;
    /**
     * 自动合并的行数上限（增 + 删）。
     */
    autoMergeMaxLines: Generated<number>;
    /**
     * 「代理选择」。**默认关**。
     *
     * 开：ask 超时后交给上一级编排判断要不要自己答、还是继续往上问。
     * 关：ask 停在原地，只有人能答。
     */
    proxyDecide: Generated<number>;
    /**
     * ask 的默认等待时长（分钟）。到点看 `proxyDecide` 决定升不升级
     */
    askDeadlineMinutes: Generated<number>;
    /**
     * 投递连续失败几次转 `stalled`
     */
    deliveryMaxAttempts: Generated<number>;
    /**
     * 投递重试的封顶间隔（秒）。退避 2s → 4s → … → 这个值
     */
    deliveryRetryCeilingSeconds: Generated<number>;
    updatedAt: string;
};
export type SourceState = {
    /**
     * 渠道 id，见 `Channel.id`
     */
    channelId: string;
    /**
     * 游标名。各渠道自己定，例如：
     * `notifications`  通知列表的 since
     * `thread:42`      issue / MR 42 的评论游标
     * `thread:ci:main` 分支 CI 的观察位置
     * `feishu:oc_xxx`  飞书某个会话的读取位置
     */
    name: string;
    /**
     * 游标值。JSON 字符串，形状归各渠道自己解释
     */
    value: string;
    /**
     * 最后一次推进的时间，用来发现「这个游标停了多久」
     */
    updatedAt: string;
};
export type Supervisor = {
    id: string;
    /**
     * 它的 DSH 会话 id；还没起会话时为空
     */
    sessionId: string | null;
    /**
     * 一句话说明它在协调什么，例如「T-105 需要 B/x 配合」
     */
    title: string;
    /**
     * 为什么拉起来的；写清卡在哪，方便它自己和主编排事后回溯
     */
    reason: string;
    status: Generated<SupervisorStatus>;
    createdAt: string;
    closedAt: string | null;
};
export type SupervisorTicket = {
    supervisorId: string;
    ticketId: string;
    createdAt: string;
};
export type Thread = {
    /**
     * `${channelId}:${refId}`，由来源事实派生，重复事件得到同一个 key。
     * PR 的 CI 和 PR 本身共用一条话题；分支 CI 是独立话题（`github:ci:main`）
     */
    id: string;
    channelId: string;
    /**
     * 归哪个项目；triage = claimed 时必填
     */
    projectId: string | null;
    /**
     * 渠道里的原始标识：issue 号、PR 号、飞书话题 id、或 `ci:<分支>`
     */
    refId: string;
    kind: ThreadKind;
    title: string;
    url: string | null;
    createdAt: string;
    /**
     * 本话题最新一条触发的时间；列表按它倒序
     */
    updatedAt: string;
    /**
     * 主编排的分诊结论。它既是「已经认领过这件事」的凭据，
     * 也是不让主编排被同一条话题反复叫醒的东西
     */
    triage: Generated<ThreadTriage>;
    /**
     * 分诊时间；还是 pending 时为空
     */
    triagedAt: string | null;
};
export type Ticket = {
    /**
     * 任务编号，也是人类和代理互相指代的短 id，例如 `T-105`
     */
    id: string;
    projectId: string;
    /**
     * 触发它的渠道，对应详情页的「触发渠道」。可以和项目的渠道不同（飞书上报，GitHub 干活）
     */
    channelId: string;
    title: string;
    /**
     * 需求正文
     */
    description: string | null;
    status: TicketStatus;
    createdAt: string;
    updatedAt: string;
    /**
     * 第一次真正开跑的时间；为空表示还没跑过
     */
    startedAt: string | null;
    /**
     * 结束（完成 / 取消）的时间；为空表示还没结束
     */
    endedAt: string | null;
    /**
     * PR 已创建时才有
     */
    prUrl: string | null;
    prState: PullRequestState | null;
    ciState: CiState | null;
    /**
     * 暂停这个任务。**在任务详情里按，不是全局开关**。
     *
     * 暂停时：不派发、不建 Worker、不投递、不出口。源继续记录触发，
     * 正在跑的回合不打断（打断会留下半成品）。
     */
    paused: Generated<number>;
    /**
     * 建 worktree 失败的原因。非空表示准备阶段挂了，`retry` 或人发消息可以再来一次
     */
    prepareError: string | null;
};
export type TicketLink = {
    ticketId: string;
    relatedId: string;
    kind: TicketLinkKind;
    createdAt: string;
};
export type TicketThread = {
    ticketId: string;
    threadId: string;
    /**
     * 关联建立时间；最早的那条就是该任务的「触发来源」
     */
    createdAt: string;
};
export type Trigger = {
    id: string;
    channelId: string;
    threadId: string;
    kind: TriggerKind;
    /**
     * 谁发的，用渠道侧的身份，例如 GitHub 登录名。跨渠道从不做身份映射
     */
    actorName: string | null;
    /**
     * 是人发的，而不是 bot / CI / 我们自己
     */
    human: Generated<number>;
    /**
     * 有没有 @ 我们（GitHub 是 @提及，飞书是直接 si/at）。没 @ 的触发不会叫醒代理
     */
    mentioned: Generated<number>;
    /**
     * 触发正文，来自外部，不可信
     */
    text: string;
    url: string | null;
    /**
     * 发生时间
     */
    at: string;
    /**
     * 来源侧的引用，各渠道含义不同，统一放在这一列：
     * PR 的 `open` / `merge` / `close`：head 分支名，例如 `nexus/T-105`
     * CI 的 `ci`：被检查的 commit sha
     * 推送的 `push`：分支名
     * 其余为空
     *
     * **PR 归哪张工单，就靠它判断。** 分支名最后一段和 `Worker.branch` 对得上，
     * 就是同一张工单的活。这是确定性的字符串比较，不需要模型猜。
     */
    ref: string | null;
};
export type Worker = {
    /**
     * DSH 会话 id，直接就是主键
     */
    id: string;
    ticketId: string;
    status: WorkerStatus;
    createdAt: string;
    /**
     * 会话真正开始跑的时间
     */
    startedAt: string | null;
    endedAt: string | null;
    /**
     * 会话标题。面板上显示的名字，编排可以用 rename 改，方便人一眼看懂它在干嘛
     */
    title: string | null;
    endedReason: WorkerEndReason | null;
    /**
     * 它独占的那个 worktree：分支名 + 绝对路径。
     * 还没建 worktree（status = queued）时这两个为空
     */
    branch: string | null;
    worktree: string | null;
    /**
     * 最近一次汇报：状态 + 一句话摘要，详情页直接显示。
     * 和会话正文是两条通道 —— 这里只有状态，正文靠 view 读
     */
    reportState: ReportState | null;
    report: string | null;
    reportAt: string | null;
    /**
     * 后台工作还能跑到什么时候。
     *
     * 回合结束时如果还有 shell job 或 subagent 在跑，**票继续占着槽位、继续算
     * working**，不报 waiting —— 否则槽位被别的票占了，任务起了服务器却没人接。
     * 上限 30 分钟；到点杀掉后台并把票报成 waiting。
     * 为空表示没有后台工作，正常释放槽位。
     */
    backgroundUntil: string | null;
    /**
     * 被重启打断后重开时写的一句话：
     * 「先查目录、git 历史和 GitHub，再决定要不要重做外部动作」。
     *
     * 没有它，重启后的 Worker 不知道自己在哪，会重复开 PR、重复发评论。
     */
    recoveryNote: string | null;
};
export type DB = {
    channel: Channel;
    channel_account: ChannelAccount;
    ci_watch: CiWatch;
    inbox: Inbox;
    project: Project;
    setting: Setting;
    source_state: SourceState;
    supervisor: Supervisor;
    supervisor_ticket: SupervisorTicket;
    thread: Thread;
    ticket: Ticket;
    ticket_link: TicketLink;
    ticket_thread: TicketThread;
    trigger: Trigger;
    worker: Worker;
};
