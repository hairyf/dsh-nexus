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
export type Acceptance = {
    executionBindingId: string | null;
    id: string;
    ticketId: string;
    scope: string;
    criteria: string;
    evidence: string;
    judge: string;
    basis: string;
    verdict: string;
    askId: string | null;
    target: string | null;
    createdAt: string;
};
export type Ask = {
    id: string;
    source: string;
    initiatorRole: string;
    initiatorBinding: string | null;
    responseRecipient: string | null;
    handler: string;
    decisionType: string;
    withinAuthorization: number;
    policyBasis: string;
    content: string;
    options: string;
    status: Generated<string>;
    answer: string | null;
    answerActor: string | null;
    answerSource: string | null;
    answeredAt: string | null;
    answerPolicy: string | null;
    target: string | null;
    verified: Generated<number>;
    createdAt: string;
    cancelledAt: string | null;
    cancelReason: string | null;
    supersedesId: string | null;
    escalations: Generated<number>;
    lastEscalatedAt: string | null;
};
export type AskTicket = {
    askId: string;
    ticketId: string;
};
export type Attention = {
    id: string;
    ticketId: string | null;
    askId: string | null;
    bindingId: string | null;
    reason: string;
    waitingFor: string;
    progressAt: string;
    dueAt: string;
    remindedAt: string | null;
    recipient: string;
    deliveryState: Generated<string>;
    deliveryError: string | null;
    escalatedAt: string | null;
    handledAt: string | null;
    resolution: string | null;
};
export type Channel = {
    id: string;
    name: string;
    enabled: Generated<number>;
    host: string | null;
    createdAt: string;
};
export type ChannelAccount = {
    id: string;
    channelId: string;
    role: AccountRole;
    name: string;
    avatar: string | null;
    status: Generated<AccountStatus>;
    createdAt: string;
};
export type CiWatch = {
    id: string;
    channelId: string;
    kind: string;
    ref: string;
    fingerprint: string;
    revision: Generated<number>;
    head: string | null;
    updatedAt: string;
};
export type Message = {
    triggerId: string | null;
    threadId: string | null;
    title: string | null;
    source: string | null;
    supersededAt: string | null;
    id: string;
    seq: number;
    ticketId: string | null;
    recipient: string;
    sender: string;
    kind: string;
    content: string;
    askId: string | null;
    acceptedAt: string;
    deliveredAt: string | null;
    readAt: string | null;
    handledAt: string | null;
    deliveryState: Generated<string>;
    attempts: Generated<number>;
    error: string | null;
    nextRetryAt: string | null;
};
export type Outbox = {
    supersededAt: string | null;
    id: string;
    messageId: string;
    ticketId: string | null;
    recipient: string;
    seq: number;
    content: string;
    askId: string | null;
    state: Generated<string>;
    attempts: Generated<number>;
    error: string | null;
    nextRetryAt: string | null;
    remoteId: string | null;
    remoteUrl: string | null;
    createdAt: string;
    sentAt: string | null;
};
export type PolicyChange = {
    id: string;
    ticketId: string;
    actor: string;
    at: string;
    previous: string;
    current: string;
    reason: string;
};
export type Project = {
    id: string;
    name: string;
    workspaceId: string;
    directory: string;
    remoteUrl: string | null;
    enabled: Generated<number>;
    available: Generated<number>;
    repository: string | null;
    attentionReason: string | null;
    identityEvidence: string | null;
    orchestratorSessionId: string | null;
    createdAt: string;
    updatedAt: string;
};
export type RoleBinding = {
    baseCommit: string | null;
    startedAt: string | null;
    id: string;
    role: string;
    scope: string;
    sessionId: string;
    projectId: string | null;
    ticketId: string | null;
    supervisorId: string | null;
    status: Generated<string>;
    activeKey: string | null;
    worktree: string | null;
    branch: string | null;
    repository: string | null;
    recoveryReason: string | null;
    previousBindingId: string | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
};
export type Setting = {
    id: string;
    maxWorkers: Generated<number>;
    backgroundLimitMinutes: Generated<number>;
    defaultQuestionLevel: Generated<string>;
    defaultMergePolicy: Generated<string>;
    whitelist: Generated<string>;
    reminderIntervalMinutes: Generated<number>;
    deliveryMaxAttempts: Generated<number>;
    deliveryRetryCeilingSeconds: Generated<number>;
    updatedAt: string;
};
export type SourceState = {
    channelId: string;
    name: string;
    value: string;
    updatedAt: string;
};
export type Supervisor = {
    id: string;
    sessionId: string | null;
    title: string;
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
    repository: string | null;
    attentionReason: string | null;
    id: string;
    channelId: string;
    projectId: string | null;
    refId: string;
    kind: ThreadKind;
    title: string;
    url: string | null;
    createdAt: string;
    updatedAt: string;
    triage: Generated<ThreadTriage>;
    triagedAt: string | null;
};
export type Ticket = {
    id: string;
    projectId: string;
    channelId: string;
    title: string;
    description: string | null;
    status: TicketStatus;
    createdAt: string;
    updatedAt: string;
    acceptanceCriteria: Generated<string>;
    authorization: Generated<string>;
    questionLevel: Generated<string>;
    mergePolicy: Generated<string>;
    policyRevision: Generated<number>;
    pauseReason: string | null;
    pauseActor: string | null;
    pausedAt: string | null;
    failureReason: string | null;
    failureBindingId: string | null;
    executionBindingId: string | null;
    executionAttention: string | null;
    deliveryTarget: string | null;
    startedAt: string | null;
    endedAt: string | null;
    prUrl: string | null;
    prState: PullRequestState | null;
    ciState: CiState | null;
    paused: Generated<number>;
    prepareError: string | null;
};
export type TicketLink = {
    ticketId: string;
    relatedId: string;
    kind: TicketLinkKind;
    satisfiedAt: string | null;
    wakeupId: string | null;
    createdAt: string;
};
export type TicketThread = {
    ticketId: string;
    threadId: string;
    createdAt: string;
};
export type TicketTransition = {
    id: string;
    ticketId: string;
    event: string;
    fromStatus: string;
    toStatus: string;
    actor: string;
    reason: string;
    bindingId: string | null;
    at: string;
};
export type Trigger = {
    id: string;
    channelId: string;
    threadId: string;
    kind: TriggerKind;
    actorProviderId: string | null;
    actorLogin: string | null;
    actorSource: string | null;
    outbound: Generated<number>;
    actorName: string | null;
    human: Generated<number>;
    mentioned: Generated<number>;
    text: string;
    url: string | null;
    at: string;
    ref: string | null;
};
export type Wakeup = {
    id: string;
    ticketId: string;
    relatedId: string;
    reason: string;
    createdAt: string;
    handledAt: string | null;
};
export type Worker = {
    id: string;
    ticketId: string;
    status: WorkerStatus;
    createdAt: string;
    startedAt: string | null;
    endedAt: string | null;
    title: string | null;
    endedReason: WorkerEndReason | null;
    branch: string | null;
    worktree: string | null;
    reportState: ReportState | null;
    report: string | null;
    reportAt: string | null;
    backgroundUntil: string | null;
    recoveryNote: string | null;
};
export type DB = {
    acceptance: Acceptance;
    ask: Ask;
    ask_ticket: AskTicket;
    attention: Attention;
    channel: Channel;
    channel_account: ChannelAccount;
    ci_watch: CiWatch;
    message: Message;
    outbox: Outbox;
    policy_change: PolicyChange;
    project: Project;
    role_binding: RoleBinding;
    setting: Setting;
    source_state: SourceState;
    supervisor: Supervisor;
    supervisor_ticket: SupervisorTicket;
    thread: Thread;
    ticket: Ticket;
    ticket_link: TicketLink;
    ticket_thread: TicketThread;
    ticket_transition: TicketTransition;
    trigger: Trigger;
    wakeup: Wakeup;
    worker: Worker;
};
