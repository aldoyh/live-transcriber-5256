import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

export type StoredSegment = { id: string; start: number; end: number; text: string };
export const sessions = sqliteTable(
  "transcript_sessions",
  {
    workspace: text("workspace").notNull(),
    id: text("id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    mode: text("mode").notNull().default("live"),
    created: integer("created").notNull(),
    updated: integer("updated").notNull(),
    seconds: real("seconds").notNull().default(0),
    segments: text("segments", { mode: "json" }).$type<StoredSegment[]>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspace, table.id] }),
    index("sessions_workspace_updated").on(table.workspace, table.updated),
  ],
);

export const activity = sqliteTable(
  "transcript_activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: text("event_id").notNull().unique(),
    workspace: text("workspace").notNull(),
    sessionId: text("session_id"),
    action: text("action").notNull(),
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    occurred: integer("occurred").notNull(),
    received: integer("received").notNull(),
  },
  (table) => [
    index("activity_workspace_id").on(table.workspace, table.id),
    index("activity_session_id").on(table.workspace, table.sessionId),
  ],
);
