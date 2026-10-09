import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sourceSnapshots = sqliteTable("source_snapshots", {
  version: text("version").primaryKey(), snapshot: text("snapshot").notNull(),
  fetchedAt: text("fetched_at").notNull(), sourceUrl: text("source_url").notNull(), mode: text("mode").notNull(),
});
export const sourceState = sqliteTable("source_state", {
  id: integer("id").primaryKey(), currentVersion: text("current_version").notNull().references(() => sourceSnapshots.version),
});
export const dispatchDrafts = sqliteTable("dispatch_drafts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), revision: integer("revision").notNull(),
  sourceVersion: text("source_version").notNull(), content: text("content").notNull(), contentHash: text("content_hash").notNull(),
  approval: text("approval"), generation: text("generation"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const approvalRecords = sqliteTable("approval_records", {
  id: text("id").primaryKey(), draftId: text("draft_id").notNull().references(() => dispatchDrafts.id),
  userId: text("user_id").notNull(), revision: integer("revision").notNull(), sourceVersion: text("source_version").notNull(),
  contentHash: text("content_hash").notNull(), record: text("record").notNull(), approvedAt: text("approved_at").notNull(),
});
export const exportRecords = sqliteTable("export_records", {
  id: text("id").primaryKey(), draftId: text("draft_id").notNull().references(() => dispatchDrafts.id),
  userId: text("user_id").notNull(), revision: integer("revision").notNull(), sourceVersion: text("source_version").notNull(),
  contentHash: text("content_hash").notNull(), packageHash: text("package_hash").notNull(), metadata: text("metadata").notNull(), exportedAt: text("exported_at").notNull(),
});
export const requestLimits = sqliteTable("request_limits", {
  key: text("key").primaryKey(), calls: integer("calls").notNull(), expiresAt: integer("expires_at").notNull(),
});
export const generationReceipts = sqliteTable("generation_receipts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), sourceVersion: text("source_version").notNull(),
  sessionId: text("session_id").notNull(), editorialHash: text("editorial_hash").notNull(), metadata: text("metadata").notNull(), createdAt: text("created_at").notNull(),
});
