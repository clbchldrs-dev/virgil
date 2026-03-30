CREATE TABLE IF NOT EXISTS "AgentTask" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId"              uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "chatId"              uuid REFERENCES "Chat"("id") ON DELETE SET NULL,
  "taskType"            varchar(32) NOT NULL,
  "title"               text NOT NULL,
  "description"         text NOT NULL,
  "priority"            varchar(16) NOT NULL DEFAULT 'medium',
  "status"              varchar(16) NOT NULL DEFAULT 'submitted',
  "githubIssueNumber"   integer,
  "githubIssueUrl"      text,
  "agentNotes"          text,
  "metadata"            jsonb NOT NULL DEFAULT '{}',
  "createdAt"           timestamp DEFAULT now() NOT NULL,
  "updatedAt"           timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "AgentTask_userId_status_idx" ON "AgentTask" ("userId", "status");
CREATE INDEX IF NOT EXISTS "AgentTask_status_priority_idx" ON "AgentTask" ("status", "priority");
