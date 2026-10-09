import type { Approval, SourceSnapshot } from "../domain/domain.ts";
import type { DispatchStore, ExportRecord, GenerationReceipt, StoredDraft } from "./types.ts";

type DraftRow = { id: string; revision: number; content: string; content_hash: string; approval: string | null; generation: string | null; created_at: string; updated_at: string };
const decodeDraft = (row: DraftRow): StoredDraft => ({ id: row.id, revision: row.revision, content: JSON.parse(row.content), contentHash: row.content_hash, approval: row.approval ? JSON.parse(row.approval) : null, generation: row.generation ? JSON.parse(row.generation) : null, createdAt: row.created_at, updatedAt: row.updated_at });

/** Every write compares the active snapshot inside SQL, closing the refresh/write race. */
export class D1DispatchStore implements DispatchStore {
  private db: D1Database;
  constructor(db: D1Database) { this.db = db; }
  async currentSnapshot(): Promise<SourceSnapshot | null> {
    const row = await this.db.prepare("SELECT snapshot FROM source_snapshots JOIN source_state ON source_snapshots.version = source_state.current_version WHERE source_state.id = 1").first<{ snapshot: string }>();
    return row ? JSON.parse(row.snapshot) : null;
  }
  async putSnapshot(snapshot: SourceSnapshot, initializeOnly = false): Promise<void> {
    const insert = this.db.prepare(`INSERT INTO source_snapshots (version,snapshot,fetched_at,source_url,mode) VALUES (?,?,?,?,?) ON CONFLICT(version) ${initializeOnly ? "DO NOTHING" : "DO UPDATE SET snapshot=excluded.snapshot,fetched_at=excluded.fetched_at,source_url=excluded.source_url,mode=excluded.mode"}`).bind(snapshot.version, JSON.stringify(snapshot), snapshot.fetchedAt, snapshot.sourceUrl, snapshot.mode);
    const activate = this.db.prepare(`INSERT INTO source_state (id,current_version) VALUES (1,?) ON CONFLICT(id) ${initializeOnly ? "DO NOTHING" : "DO UPDATE SET current_version=excluded.current_version"}`).bind(snapshot.version);
    await this.db.batch([insert, activate]);
  }
  async listDrafts(userId: string): Promise<StoredDraft[]> {
    const result = await this.db.prepare("SELECT * FROM dispatch_drafts WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(userId).all<DraftRow>();
    return result.results.map(decodeDraft);
  }
  async getDraft(userId: string, id: string): Promise<StoredDraft | null> {
    const row = await this.db.prepare("SELECT * FROM dispatch_drafts WHERE id=? AND user_id=?").bind(id, userId).first<DraftRow>();
    return row ? decodeDraft(row) : null;
  }
  async saveDraft(userId: string, draft: StoredDraft, expectedVersion: number | null, snapshotVersion: string): Promise<boolean> {
    if (expectedVersion === null) {
      const result = await this.db.prepare("INSERT INTO dispatch_drafts (id,user_id,revision,source_version,content,content_hash,approval,generation,created_at,updated_at) SELECT ?,?,?,?,?,?,NULL,?,?,? WHERE EXISTS (SELECT 1 FROM source_state WHERE id=1 AND current_version=?) ON CONFLICT(id) DO NOTHING").bind(draft.id, userId, draft.revision, draft.content.sourceVersion, JSON.stringify(draft.content), draft.contentHash, draft.generation ? JSON.stringify(draft.generation) : null, draft.createdAt, draft.updatedAt, snapshotVersion).run();
      return result.meta.changes === 1;
    }
    const result = await this.db.prepare("UPDATE dispatch_drafts SET revision=?,source_version=?,content=?,content_hash=?,approval=NULL,generation=?,updated_at=? WHERE id=? AND user_id=? AND revision=? AND EXISTS (SELECT 1 FROM source_state WHERE id=1 AND current_version=?)").bind(draft.revision, draft.content.sourceVersion, JSON.stringify(draft.content), draft.contentHash, draft.generation ? JSON.stringify(draft.generation) : null, draft.updatedAt, draft.id, userId, expectedVersion, snapshotVersion).run();
    return result.meta.changes === 1;
  }
  async recordApproval(userId: string, draft: StoredDraft, expectedVersion: number, snapshotVersion: string): Promise<boolean> {
    const approval = JSON.stringify(draft.approval);
    const update = this.db.prepare("UPDATE dispatch_drafts SET revision=?,approval=?,updated_at=? WHERE id=? AND user_id=? AND revision=? AND content_hash=? AND EXISTS (SELECT 1 FROM source_state WHERE id=1 AND current_version=?)").bind(draft.revision, approval, draft.updatedAt, draft.id, userId, expectedVersion, draft.contentHash, snapshotVersion);
    const audit = this.db.prepare("INSERT INTO approval_records (id,draft_id,user_id,revision,source_version,content_hash,record,approved_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(), draft.id, userId, draft.revision, draft.content.sourceVersion, draft.contentHash, approval, draft.updatedAt);
    const [result] = await this.db.batch([update, audit]);
    return result.meta.changes === 1;
  }
  async recordExport(record: ExportRecord, snapshotVersion: string, approval: Approval): Promise<boolean> {
    const result = await this.db.prepare("INSERT INTO export_records (id,draft_id,user_id,revision,source_version,content_hash,package_hash,metadata,exported_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM dispatch_drafts WHERE id=? AND user_id=? AND revision=? AND content_hash=? AND approval=?) AND EXISTS (SELECT 1 FROM source_state WHERE id=1 AND current_version=?)").bind(record.id, record.draftId, record.userId, record.revision, record.sourceVersion, record.contentHash, record.packageHash, JSON.stringify(record.package), record.exportedAt, record.draftId, record.userId, record.revision, record.contentHash, JSON.stringify(approval), snapshotVersion).run();
    return result.meta.changes === 1;
  }
  async takeLimit(userId: string, operation: "generate" | "refresh", minute: number, max: number): Promise<boolean> {
    // SQLite serializes this UPSERT; failed provider calls count too, preventing parallel overrun.
    const row = await this.db.prepare("INSERT INTO request_limits (key,calls,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET calls=calls+1 WHERE calls < ? RETURNING calls").bind(`${operation}:${userId}:${minute}`, (minute + 2) * 60000, max).first<{ calls: number }>();
    // Best-effort bounded retention; no background cost-bearing jobs.
    await this.db.prepare("DELETE FROM request_limits WHERE expires_at < ?").bind(minute * 60000).run();
    return !!row;
  }
  async saveGeneration(receipt: GenerationReceipt): Promise<void> {
    await this.db.prepare("INSERT INTO generation_receipts (id,user_id,source_version,session_id,editorial_hash,metadata,created_at) VALUES (?,?,?,?,?,?,?)").bind(receipt.id, receipt.userId, receipt.sourceVersion, receipt.sessionId, receipt.editorialHash, JSON.stringify(receipt.metadata), receipt.metadata.generatedAt).run();
  }
  async getGeneration(userId: string, id: string): Promise<GenerationReceipt | null> {
    const row = await this.db.prepare("SELECT * FROM generation_receipts WHERE id=? AND user_id=?").bind(id, userId).first<{ id: string; user_id: string; source_version: string; session_id: string; editorial_hash: string; metadata: string }>();
    return row ? { id: row.id, userId: row.user_id, sourceVersion: row.source_version, sessionId: row.session_id, editorialHash: row.editorial_hash, metadata: JSON.parse(row.metadata) } : null;
  }
}
