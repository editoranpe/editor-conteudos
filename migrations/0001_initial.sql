CREATE TABLE members (
 email TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','editor','visualizador')),
 status TEXT NOT NULL CHECK(status IN ('pendente','aprovado','recusado')), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE contents (
 id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)), revision INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL REFERENCES members(email), updated_by TEXT NOT NULL REFERENCES members(email),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX contents_updated ON contents(updated_at);
CREATE TABLE art_projects (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE,
 created_by TEXT NOT NULL REFERENCES members(email), revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE attachments (
 id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
 object_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
 created_by TEXT NOT NULL REFERENCES members(email), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX attachments_content ON attachments(content_id);
CREATE TABLE dispatches (
 id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES contents(id), revision INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('enviando','aceito','falhou')), created_by TEXT NOT NULL REFERENCES members(email),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(content_id, revision)
);
CREATE TABLE rate_limits (email TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(email,bucket));
CREATE TABLE audit_log (id TEXT PRIMARY KEY, email TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
