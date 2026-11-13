/**
 * 建表 SQL。由 `prisma migrate diff --from-empty --to-schema prisma/schema --script`
 * 生成，去掉 CLI 横幅后批量加 `IF NOT EXISTS`，所以启动时重复执行是安全的。
 *
 * 生成命令见 `prisma/README.md`。**改 schema 之后必须重新生成** ——
 * 两边不一致时面板会读到缺列的表。
 */
export const SCHEMA_SQL = `
-- CreateTable
CREATE TABLE IF NOT EXISTS "channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "channel_account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "channel_account_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ci_watch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "head" TEXT,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "ci_watch_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "source_state" (
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    PRIMARY KEY ("channelId", "name"),
    CONSTRAINT "source_state_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "supervisorId" TEXT,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "doneAt" TEXT,
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "deliveryError" TEXT,
    "nextRetryAt" TEXT,
    "readAt" TEXT,
    "escalations" INTEGER NOT NULL DEFAULT 0,
    "lastEscalatedAt" TEXT,
    "answer" TEXT,
    "answeredBy" TEXT,
    "answeredAt" TEXT,
    "triggerId" TEXT,
    "threadId" TEXT,
    "ticketId" TEXT,
    "workerId" TEXT,
    CONSTRAINT "inbox_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inbox_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inbox_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "trigger" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inbox_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inbox_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inbox_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "directory" TEXT NOT NULL,
    "orchestratorSessionId" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "project_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maxWorkers" INTEGER NOT NULL DEFAULT 4,
    "backgroundLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "autoMerge" BOOLEAN NOT NULL DEFAULT false,
    "autoMergeMaxLines" INTEGER NOT NULL DEFAULT 200,
    "deliveryMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "deliveryRetryCeilingSeconds" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "supervisor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TEXT NOT NULL,
    "closedAt" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "supervisor_ticket" (
    "supervisorId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    PRIMARY KEY ("supervisorId", "ticketId"),
    CONSTRAINT "supervisor_ticket_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supervisor_ticket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "thread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "projectId" TEXT,
    "refId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "triage" TEXT NOT NULL DEFAULT 'pending',
    "triagedAt" TEXT,
    CONSTRAINT "thread_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "thread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "trigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorName" TEXT,
    "human" BOOLEAN NOT NULL DEFAULT true,
    "mentioned" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT NOT NULL,
    "url" TEXT,
    "at" TEXT NOT NULL,
    "ref" TEXT,
    CONSTRAINT "trigger_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trigger_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "startedAt" TEXT,
    "endedAt" TEXT,
    "prUrl" TEXT,
    "prState" TEXT,
    "ciState" TEXT,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "prepareError" TEXT,
    CONSTRAINT "ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket_thread" (
    "ticketId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    PRIMARY KEY ("ticketId", "threadId"),
    CONSTRAINT "ticket_thread_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_thread_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket_link" (
    "ticketId" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    PRIMARY KEY ("ticketId", "relatedId", "kind"),
    CONSTRAINT "ticket_link_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_link_relatedId_fkey" FOREIGN KEY ("relatedId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "worker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "startedAt" TEXT,
    "endedAt" TEXT,
    "title" TEXT,
    "endedReason" TEXT,
    "branch" TEXT,
    "worktree" TEXT,
    "reportState" TEXT,
    "report" TEXT,
    "reportAt" TEXT,
    "backgroundUntil" TEXT,
    "recoveryNote" TEXT,
    CONSTRAINT "worker_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "channel_account_channelId_role_idx" ON "channel_account"("channelId", "role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "channel_account_channelId_role_name_key" ON "channel_account"("channelId", "role", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ci_watch_channelId_kind_ref_key" ON "ci_watch"("channelId", "kind", "ref");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "source_state_updatedAt_idx" ON "source_state"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_type_projectId_status_idx" ON "inbox"("type", "projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_type_status_createdAt_idx" ON "inbox"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_status_createdAt_idx" ON "inbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_ticketId_seq_idx" ON "inbox"("ticketId", "seq");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inbox_status_nextRetryAt_idx" ON "inbox"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_workspaceId_key" ON "project"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_channelId_name_key" ON "project"("channelId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supervisor_status_idx" ON "supervisor"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supervisor_ticket_ticketId_idx" ON "supervisor_ticket"("ticketId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "thread_updatedAt_idx" ON "thread"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "thread_projectId_idx" ON "thread"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "thread_triage_idx" ON "thread"("triage");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "thread_channelId_refId_key" ON "thread"("channelId", "refId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_threadId_at_idx" ON "trigger"("threadId", "at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_channelId_at_idx" ON "trigger"("channelId", "at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_at_idx" ON "trigger"("at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trigger_ref_idx" ON "trigger"("ref");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_projectId_status_idx" ON "ticket"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_status_updatedAt_idx" ON "ticket"("status", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_thread_ticketId_createdAt_idx" ON "ticket_thread"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_thread_threadId_idx" ON "ticket_thread"("threadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_link_relatedId_idx" ON "ticket_link"("relatedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "worker_ticketId_createdAt_idx" ON "worker"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "worker_status_idx" ON "worker"("status");
`
