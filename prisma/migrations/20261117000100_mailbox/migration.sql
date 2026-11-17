CREATE TABLE inbox (
  id TEXT NOT NULL PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  recipient TEXT NOT NULL,
  sender TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  askId TEXT,
  acceptedAt TEXT NOT NULL,
  readAt TEXT,
  handledAt TEXT,
  notifiedAt TEXT,
  supersededAt TEXT
);
CREATE INDEX inbox_recipient_handledAt_seq_idx ON inbox(recipient, handledAt, seq);
CREATE TABLE inbox_message (id TEXT NOT NULL PRIMARY KEY REFERENCES inbox(id), messageId TEXT NOT NULL UNIQUE REFERENCES message(id));
INSERT INTO inbox (id, seq, recipient, sender, kind, title, content, askId, acceptedAt, readAt, handledAt, supersededAt)
SELECT m.id, m.seq, 'nexus:' || r.role || ':' || r.scope, COALESCE('nexus:' || s.role || ':' || s.scope, m.sender), m.kind, m.title, m.content, m.askId, m.acceptedAt, m.readAt, m.handledAt, m.supersededAt
FROM message m JOIN role_binding r ON r.id = m.recipient
LEFT JOIN role_binding s ON s.id = m.sender OR s.sessionId = m.sender
WHERE m.kind = 'ask' OR (m.kind IN ('message', 'answer') AND s.id IS NOT NULL);
INSERT INTO inbox_message SELECT id, id FROM inbox;
UPDATE message SET content = '' WHERE id IN (SELECT messageId FROM inbox_message);
