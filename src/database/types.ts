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
    done: "done"
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
    chat: "chat"
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
    merge: "merge",
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
    failed: "failed"
} as const;
export type ReportState = (typeof ReportState)[keyof typeof ReportState];
export type Channel = {
    /**
     * 'github' | 'gitlab' | 'feishu' | 'qq' | 'wechat'
     * 故意保持 String：这是身份而非状态，新增渠道只要插一行，不该逼一次迁移。
     * 它同时是 skill 文件名的后缀：`github` → `nexus-channel-github`
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
export type Inbox = {
    id: string;
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
     * `${channelId}:${refId}`，由来源事实派生，重复事件得到同一个 key
     */
    id: string;
    channelId: string;
    /**
     * 归哪个项目；triage = claimed 时必填
     */
    projectId: string | null;
    /**
     * 渠道里的原始标识，例如 GitHub 的 issue 号、飞书的话题 id
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
};
export type DB = {
    channel: Channel;
    channel_account: ChannelAccount;
    inbox: Inbox;
    project: Project;
    supervisor: Supervisor;
    supervisor_ticket: SupervisorTicket;
    thread: Thread;
    ticket: Ticket;
    ticket_link: TicketLink;
    ticket_thread: TicketThread;
    trigger: Trigger;
    worker: Worker;
};
