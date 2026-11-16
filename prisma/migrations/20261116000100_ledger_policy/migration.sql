CREATE TEMP TABLE nexus_old_project AS SELECT id, channelId FROM project;
ALTER TABLE thread ADD COLUMN repository TEXT;
ALTER TABLE thread ADD COLUMN attentionReason TEXT;
UPDATE thread SET attentionReason = 'repository_identity_unverified';
ALTER TABLE "ticket_link" ADD COLUMN "satisfiedAt" TEXT;
ALTER TABLE "ticket_link" ADD COLUMN "wakeupId" TEXT;

CREATE TABLE "ticket_transition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "bindingId" TEXT,
    "at" TEXT NOT NULL,
    CONSTRAINT "ticket_transition_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "initiatorRole" TEXT NOT NULL,
    "initiatorBinding" TEXT,
    "responseRecipient" TEXT,
    "handler" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "withinAuthorization" BOOLEAN NOT NULL,
    "policyBasis" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "answer" TEXT,
    "answerActor" TEXT,
    "answerSource" TEXT,
    "answeredAt" TEXT,
    "answerPolicy" TEXT,
    "target" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TEXT NOT NULL,
    "cancelledAt" TEXT,
    "cancelReason" TEXT,
    "supersedesId" TEXT,
    "escalations" INTEGER NOT NULL DEFAULT 0,
    "lastEscalatedAt" TEXT
);

CREATE TABLE "ask_ticket" (
    "askId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,

    PRIMARY KEY ("askId", "ticketId"),
    CONSTRAINT "ask_ticket_askId_fkey" FOREIGN KEY ("askId") REFERENCES "ask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ask_ticket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "policy_change" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "previous" TEXT NOT NULL,
    "current" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    CONSTRAINT "policy_change_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "role_binding" (
    "startedAt" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "projectId" TEXT,
    "ticketId" TEXT,
    "supervisorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "activeKey" TEXT,
    "worktree" TEXT,
    "branch" TEXT,
    "repository" TEXT,
    "recoveryReason" TEXT,
    "previousBindingId" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "closedAt" TEXT,
    CONSTRAINT "role_binding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "role_binding_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "role_binding_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "message" (
    "triggerId" TEXT,
    "threadId" TEXT,
    "title" TEXT,
    "source" TEXT,
    "supersededAt" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "ticketId" TEXT,
    "recipient" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "askId" TEXT,
    "acceptedAt" TEXT NOT NULL,
    "deliveredAt" TEXT,
    "readAt" TEXT,
    "handledAt" TEXT,
    "deliveryState" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "nextRetryAt" TEXT,
    CONSTRAINT "message_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "message_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "trigger" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "message_askId_fkey" FOREIGN KEY ("askId") REFERENCES "ask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "outbox" (
    "supersededAt" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "ticketId" TEXT,
    "recipient" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "askId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "nextRetryAt" TEXT,
    "remoteId" TEXT,
    "remoteUrl" TEXT,
    "createdAt" TEXT NOT NULL,
    "sentAt" TEXT,
    CONSTRAINT "outbox_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "outbox_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "outbox_askId_fkey" FOREIGN KEY ("askId") REFERENCES "ask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "acceptance" (
    "executionBindingId" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "judge" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "askId" TEXT,
    "target" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "acceptance_executionBindingId_fkey" FOREIGN KEY ("executionBindingId") REFERENCES "role_binding" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "acceptance_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "acceptance_askId_fkey" FOREIGN KEY ("askId") REFERENCES "ask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "wakeup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "handledAt" TEXT,
    CONSTRAINT "wakeup_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "wakeup_relatedId_fkey" FOREIGN KEY ("relatedId") REFERENCES "ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "attention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT,
    "askId" TEXT,
    "bindingId" TEXT,
    "reason" TEXT NOT NULL,
    "waitingFor" TEXT NOT NULL,
    "progressAt" TEXT NOT NULL,
    "dueAt" TEXT NOT NULL,
    "remindedAt" TEXT,
    "recipient" TEXT NOT NULL,
    "deliveryState" TEXT NOT NULL DEFAULT 'pending',
    "deliveryError" TEXT,
    "escalatedAt" TEXT,
    "handledAt" TEXT,
    "resolution" TEXT,
    CONSTRAINT "attention_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "attention_askId_fkey" FOREIGN KEY ("askId") REFERENCES "ask" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "attention_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "role_binding" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "new_project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "directory" TEXT NOT NULL,
    "remoteUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "repository" TEXT,
    "attentionReason" TEXT,
    "identityEvidence" TEXT,
    "orchestratorSessionId" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);
INSERT INTO "new_project" ("createdAt", "directory", "id", "name", "orchestratorSessionId", "updatedAt", "workspaceId") SELECT "createdAt", "directory", "id", "name", "orchestratorSessionId", "updatedAt", "workspaceId" FROM "project";
DROP TABLE "project";
ALTER TABLE "new_project" RENAME TO "project";
CREATE UNIQUE INDEX "project_workspaceId_key" ON "project"("workspaceId");
CREATE UNIQUE INDEX "project_repository_key" ON "project"("repository");
CREATE TABLE "new_setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maxWorkers" INTEGER NOT NULL DEFAULT 4,
    "backgroundLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "defaultQuestionLevel" TEXT NOT NULL DEFAULT 'important',
    "defaultMergePolicy" TEXT NOT NULL DEFAULT 'follow_question_level',
    "whitelist" TEXT NOT NULL DEFAULT '[]',
    "reminderIntervalMinutes" INTEGER NOT NULL DEFAULT 10,
    "deliveryMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "deliveryRetryCeilingSeconds" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TEXT NOT NULL
);
INSERT INTO "new_setting" ("backgroundLimitMinutes", "deliveryMaxAttempts", "deliveryRetryCeilingSeconds", "id", "maxWorkers", "updatedAt") SELECT "backgroundLimitMinutes", "deliveryMaxAttempts", "deliveryRetryCeilingSeconds", "id", "maxWorkers", "updatedAt" FROM "setting";
DROP TABLE "setting";
ALTER TABLE "new_setting" RENAME TO "setting";
CREATE TABLE "new_ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL DEFAULT '',
    "authorization" TEXT NOT NULL DEFAULT '',
    "questionLevel" TEXT NOT NULL DEFAULT 'important',
    "mergePolicy" TEXT NOT NULL DEFAULT 'human_required',
    "policyRevision" INTEGER NOT NULL DEFAULT 0,
    "pauseReason" TEXT,
    "pauseActor" TEXT,
    "pausedAt" TEXT,
    "failureReason" TEXT,
    "failureBindingId" TEXT,
    "executionBindingId" TEXT,
    "deliveryTarget" TEXT,
    "startedAt" TEXT,
    "endedAt" TEXT,
    "prUrl" TEXT,
    "prState" TEXT,
    "ciState" TEXT,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "prepareError" TEXT,
    CONSTRAINT "ticket_failureBindingId_fkey" FOREIGN KEY ("failureBindingId") REFERENCES "role_binding" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ticket_executionBindingId_fkey" FOREIGN KEY ("executionBindingId") REFERENCES "role_binding" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ticket" ("channelId", "ciState", "createdAt", "description", "endedAt", "id", "paused", "prState", "prUrl", "prepareError", "projectId", "startedAt", "status", "title", "updatedAt") SELECT "channelId", "ciState", "createdAt", "description", "endedAt", "id", "paused", "prState", "prUrl", "prepareError", "projectId", "startedAt", "status", "title", "updatedAt" FROM "ticket";
DROP TABLE "ticket";
ALTER TABLE "new_ticket" RENAME TO "ticket";
CREATE INDEX "ticket_projectId_status_idx" ON "ticket"("projectId", "status");
CREATE INDEX "ticket_status_updatedAt_idx" ON "ticket"("status", "updatedAt");
CREATE TABLE "new_trigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorProviderId" TEXT,
    "actorLogin" TEXT,
    "actorSource" TEXT,
    "outbound" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_trigger" ("actorName", "at", "channelId", "human", "id", "kind", "mentioned", "ref", "text", "threadId", "url") SELECT "actorName", "at", "channelId", "human", "id", "kind", "mentioned", "ref", "text", "threadId", "url" FROM "trigger";
DROP TABLE "trigger";
ALTER TABLE "new_trigger" RENAME TO "trigger";
CREATE INDEX "trigger_threadId_at_idx" ON "trigger"("threadId", "at");
CREATE INDEX "trigger_channelId_at_idx" ON "trigger"("channelId", "at");
CREATE INDEX "trigger_at_idx" ON "trigger"("at");
CREATE INDEX "trigger_ref_idx" ON "trigger"("ref");

CREATE UNIQUE INDEX "role_binding_sessionId_key" ON "role_binding"("sessionId");

CREATE UNIQUE INDEX "role_binding_activeKey_key" ON "role_binding"("activeKey");

CREATE UNIQUE INDEX "message_seq_key" ON "message"("seq");

CREATE INDEX "message_ticketId_recipient_seq_idx" ON "message"("ticketId", "recipient", "seq");

CREATE UNIQUE INDEX "outbox_seq_key" ON "outbox"("seq");

CREATE INDEX "outbox_ticketId_recipient_seq_idx" ON "outbox"("ticketId", "recipient", "seq");

CREATE UNIQUE INDEX "outbox_messageId_recipient_key" ON "outbox"("messageId", "recipient");
UPDATE project SET attentionReason = 'repository_identity_unverified', identityEvidence = (SELECT json_object('channelId', channelId) FROM nexus_old_project WHERE nexus_old_project.id = project.id);
DROP TABLE nexus_old_project;
UPDATE setting SET defaultMergePolicy = 'human_required';
INSERT INTO ask (id, source, initiatorRole, handler, decisionType, withinAuthorization, policyBasis, content, options, status, answer, answerActor, answerSource, answeredAt, createdAt, escalations, lastEscalatedAt)
SELECT id, json_object('inboxId', id, 'triggerId', triggerId, 'threadId', threadId, 'workerId', workerId, 'previousHandler', type, 'origin', origin), CASE WHEN origin IN ('main', 'project', 'supervisor', 'worker') THEN origin ELSE 'main' END, 'human', 'important', 0, CASE WHEN ticketId IS NULL THEN '[]' ELSE json_array(json_object('id', ticketId, 'questionLevel', 'important', 'mergePolicy', 'human_required', 'revision', 0)) END, message, '[]', CASE WHEN answer IS NOT NULL THEN 'answered' ELSE 'pending' END, answer, NULL, answeredBy, answeredAt, createdAt, escalations, lastEscalatedAt FROM inbox WHERE kind = 'ask';
INSERT INTO ask_ticket SELECT id, ticketId FROM inbox WHERE kind = 'ask' AND ticketId IS NOT NULL;
INSERT INTO message (id, seq, ticketId, recipient, sender, kind, content, askId, acceptedAt, deliveredAt, readAt, handledAt, deliveryState, attempts, error, nextRetryAt, triggerId, threadId, title, source)
SELECT id, ROW_NUMBER() OVER (ORDER BY seq, createdAt, id), ticketId, CASE WHEN type = 'user' THEN 'human' ELSE 'unresolved:' || type || ':' || COALESCE(projectId, supervisorId, id) END, json_object('origin', origin, 'workerId', workerId), kind, message, CASE WHEN kind = 'ask' THEN id ELSE NULL END, createdAt, readAt, readAt, CASE WHEN kind != 'ask' AND status = 'done' THEN doneAt ELSE NULL END, CASE WHEN readAt IS NULL THEN 'failed' ELSE 'delivered' END, deliveryAttempts, COALESCE(deliveryError, 'recipient_binding_requires_verification'), nextRetryAt, triggerId, threadId, title, json_object('inboxId', id, 'seq', seq, 'type', type, 'projectId', projectId, 'supervisorId', supervisorId, 'origin', origin, 'status', status, 'title', title, 'triggerId', triggerId, 'threadId', threadId, 'workerId', workerId, 'escalations', escalations, 'lastEscalatedAt', lastEscalatedAt, 'doneAt', doneAt) FROM inbox;
DROP TABLE inbox;
INSERT INTO role_binding (id, role, scope, sessionId, projectId, ticketId, status, activeKey, worktree, branch, recoveryReason, createdAt, updatedAt, closedAt, startedAt)
SELECT 'migrated:worker:' || w.id, 'worker', w.ticketId, w.id, t.projectId, w.ticketId, CASE WHEN w.status = 'ended' THEN 'closed' ELSE 'unavailable' END, CASE WHEN w.status != 'ended' AND (SELECT COUNT(*) FROM worker active WHERE active.ticketId = w.ticketId AND active.status != 'ended') = 1 THEN 'worker:' || w.ticketId ELSE NULL END, w.worktree, w.branch, 'migration_requires_session_verification', w.createdAt, COALESCE(w.endedAt, w.startedAt, w.createdAt), w.endedAt, w.startedAt FROM worker w JOIN ticket t ON t.id = w.ticketId;
UPDATE ask SET initiatorBinding = (SELECT 'migrated:worker:' || worker.id FROM worker WHERE worker.id = json_extract(ask.source, '$.workerId')) WHERE initiatorRole = 'worker';
UPDATE ask SET responseRecipient = initiatorBinding;
UPDATE ticket SET executionBindingId = (SELECT id FROM role_binding WHERE role = 'worker' AND activeKey = 'worker:' || ticket.id);
UPDATE ask SET policyBasis = (SELECT json_group_array(json_object('id', ticket.id, 'questionLevel', ticket.questionLevel, 'mergePolicy', ticket.mergePolicy, 'revision', ticket.policyRevision, 'executionBindingId', ticket.executionBindingId)) FROM ask_ticket JOIN ticket ON ticket.id = ask_ticket.ticketId WHERE ask_ticket.askId = ask.id);
UPDATE message SET supersededAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), deliveryState = 'superseded', error = NULL, nextRetryAt = NULL WHERE kind = 'ask' AND askId IN (SELECT id FROM ask WHERE status != 'pending');
