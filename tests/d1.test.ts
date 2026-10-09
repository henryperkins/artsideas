import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { D1DispatchStore } from '../lib/server/store.ts';
import { createSeedSnapshot } from '../lib/domain/seed.ts';
import { approveDraft, assembleExport, canonicalHash, createDraft, draftVersion, sessionVersion, sha256, type SourceSnapshot } from '../lib/domain/domain.ts';
import { posterSvg } from '../components/dispatch/poster-svg.ts';
import type { ExportRecord, StoredDraft } from '../lib/server/types.ts';

/** Executes the production SQL against real SQLite; this adapter only supplies D1's result shape. */
class SqliteStatement {
  readonly db: DatabaseSync;
  readonly sql: string;
  readonly values: SQLInputValue[];
  constructor(db: DatabaseSync, sql: string, values: SQLInputValue[] = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values: SQLInputValue[]): SqliteStatement { return new SqliteStatement(this.db, this.sql, values); }
  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.values);
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }
  async all<T>(): Promise<{ results: T[]; success: true; meta: { changes: number } }> {
    const results = this.db.prepare(this.sql).all(...this.values) as T[];
    return { results, success: true, meta: { changes: this.changes() } };
  }
  async run(): Promise<{ results: unknown[]; success: true; meta: { changes: number } }> {
    const result = this.db.prepare(this.sql).run(...this.values);
    return { results: [], success: true, meta: { changes: Number(result.changes) } };
  }
  private changes(): number { return Number(this.db.prepare('SELECT changes() AS count').get()!.count); }
}
class SqliteD1 {
  readonly db = new DatabaseSync(':memory:');
  constructor() {
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec(readFileSync(new URL('../drizzle/0000_overjoyed_steel_serpent.sql', import.meta.url), 'utf8'));
  }
  prepare(sql: string): SqliteStatement { return new SqliteStatement(this.db, sql); }
  async batch(statements: SqliteStatement[]): Promise<Awaited<ReturnType<SqliteStatement['run']>>[]> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  count(table: string): number {
    assert.match(table, /^[a-z_]+$/);
    return Number(this.db.prepare(`SELECT count(*) AS count FROM ${table}`).get()!.count);
  }
  close() { this.db.close(); }
}
const timestamp = '2026-10-09T20:00:00.000Z';
async function fixture() {
  const db = new SqliteD1();
  const store = new D1DispatchStore(db as unknown as D1Database);
  const snapshot = await createSeedSnapshot();
  return { db, store, snapshot };
}
async function storedDraft(snapshot: SourceSnapshot, id = 'draft-one'): Promise<StoredDraft> {
  const session = snapshot.sessions.find(s => s.title === 'Nobody Asked for This')!;
  const content = createDraft(session, { id, platform: 'linkedin', angle: 'question', editorialText: 'What could curiosity make possible?', altText: 'A typographic festival card.' });
  return { id, revision: 1, content, contentHash: await draftVersion(content), approval: null, generation: null, createdAt: timestamp, updatedAt: timestamp };
}
async function changedSnapshot(snapshot: SourceSnapshot): Promise<SourceSnapshot> {
  const updated = structuredClone(snapshot);
  updated.sessions[0].title = 'Doors and reception — updated';
  updated.sessions[0].version = await sessionVersion(updated.sessions[0]);
  updated.version = await canonicalHash(updated.sessions.map(s => ({ id: s.id, version: s.version })).sort((a, b) => a.id.localeCompare(b.id)));
  updated.mode = 'live'; updated.fetchedAt = '2026-10-09T20:01:00.000Z';
  return updated;
}
async function approveStored(draft: StoredDraft, snapshot: SourceSnapshot, reviewer = 'user-a'): Promise<StoredDraft> {
  const session = snapshot.sessions.find(s => s.id === draft.content.sessionId)!;
  return { ...draft, revision: draft.revision + 1, approval: await approveDraft(draft.content, session, reviewer, timestamp), updatedAt: timestamp };
}
async function exportRecord(draft: StoredDraft, snapshot: SourceSnapshot, id = 'export-one', userId = 'user-a'): Promise<ExportRecord> {
  const session = snapshot.sessions.find(s => s.id === draft.content.sessionId)!;
  const assembled = await assembleExport(draft.content, session, draft.approval, timestamp);
  const svg = posterSvg(assembled.poster);
  const packageData = { ...assembled, generation: draft.generation, snapshotVersion: snapshot.version, graphic: { filename: `${session.id}-${draft.content.platform}-graphic.svg`, mimeType: 'image/svg+xml' as const, svg, sha256: await sha256(svg) } };
  return { id, draftId: draft.id, userId, revision: draft.revision, sourceVersion: session.version, contentHash: draft.contentHash, packageHash: await canonicalHash(packageData), exportedAt: timestamp, package: packageData };
}

test('D1 initializes the real seed once and does not replace a refreshed active source during concurrent initialization', async t => {
  const { db, store, snapshot } = await fixture(); t.after(() => db.close());
  assert.equal(await store.currentSnapshot(), null);
  await store.putSnapshot(snapshot, true);
  assert.deepEqual(await store.currentSnapshot(), snapshot);
  assert.equal(db.count('source_snapshots'), 1);
  assert.equal(db.count('source_state'), 1);
  const refreshed = await changedSnapshot(snapshot);
  await store.putSnapshot(refreshed);
  await store.putSnapshot(snapshot, true);
  assert.deepEqual(await store.currentSnapshot(), refreshed);
  assert.equal(db.count('source_snapshots'), 2);
  assert.equal(db.count('source_state'), 1);
});

test('D1 persists user-scoped drafts and rejects duplicate IDs, wrong owners, and stale revisions', async t => {
  const { db, store, snapshot } = await fixture(); t.after(() => db.close());
  await store.putSnapshot(snapshot, true);
  const initial = await storedDraft(snapshot);
  assert.equal(await store.saveDraft('user-a', initial, null, snapshot.version), true);
  assert.deepEqual(await store.getDraft('user-a', initial.id), initial);
  assert.equal(await store.getDraft('user-b', initial.id), null);
  assert.deepEqual(await store.listDrafts('user-b'), []);
  assert.equal(await store.saveDraft('user-b', initial, null, snapshot.version), false);
  const nextContent = { ...initial.content, editorialText: 'A new opening.' };
  const edited = { ...initial, revision: 2, content: nextContent, contentHash: await draftVersion(nextContent), updatedAt: '2026-10-09T20:02:00.000Z' };
  assert.equal(await store.saveDraft('user-b', edited, 1, snapshot.version), false);
  assert.equal(await store.saveDraft('user-a', edited, 2, snapshot.version), false);
  assert.deepEqual(await store.getDraft('user-a', initial.id), initial);
  assert.equal(await store.saveDraft('user-a', edited, 1, snapshot.version), true);
  assert.equal(await store.saveDraft('user-a', initial, 1, snapshot.version), false);
  assert.deepEqual(await store.getDraft('user-a', initial.id), edited);
  assert.deepEqual(await store.listDrafts('user-a'), [edited]);
});

test('D1 source comparison inside writes rejects new drafts, edits, approvals, and exports after refresh', async t => {
  const { db, store, snapshot } = await fixture(); t.after(() => db.close());
  await store.putSnapshot(snapshot, true);
  const initial = await storedDraft(snapshot);
  assert.equal(await store.saveDraft('user-a', initial, null, snapshot.version), true);
  const approved = await approveStored(initial, snapshot);
  assert.equal(await store.recordApproval('user-a', approved, 1, snapshot.version), true);
  const record = await exportRecord(approved, snapshot);
  await store.putSnapshot(await changedSnapshot(snapshot));
  assert.equal(await store.saveDraft('user-a', await storedDraft(snapshot, 'new-draft'), null, snapshot.version), false);
  assert.equal(await store.saveDraft('user-a', { ...approved, revision: 3, approval: null }, 2, snapshot.version), false);
  assert.equal(await store.recordApproval('user-a', { ...approved, revision: 3 }, 2, snapshot.version), false);
  assert.equal(await store.recordExport(record, snapshot.version, approved.approval!), false);
  assert.equal(db.count('dispatch_drafts'), 1);
  assert.equal(db.count('approval_records'), 1);
  assert.equal(db.count('export_records'), 0);
  assert.deepEqual(await store.getDraft('user-a', initial.id), approved);
});

test('D1 approval transaction writes audit evidence only when the matching update succeeds', async t => {
  const { db, store, snapshot } = await fixture(); t.after(() => db.close());
  await store.putSnapshot(snapshot, true);
  const initial = await storedDraft(snapshot); await store.saveDraft('user-a', initial, null, snapshot.version);
  const approved = await approveStored(initial, snapshot);
  assert.equal(await store.recordApproval('user-b', approved, 1, snapshot.version), false);
  assert.equal(db.count('approval_records'), 0);
  assert.equal(await store.recordApproval('user-a', { ...approved, contentHash: 'mismatched-hash' }, 1, snapshot.version), false);
  assert.equal(db.count('approval_records'), 0);
  assert.equal(await store.recordApproval('user-a', approved, 2, snapshot.version), false);
  assert.equal(db.count('approval_records'), 0);
  assert.equal(await store.recordApproval('user-a', approved, 1, snapshot.version), true);
  assert.equal(db.count('approval_records'), 1);
  const audit = db.db.prepare('SELECT * FROM approval_records').get()!;
  assert.equal(audit.user_id, 'user-a');
  assert.equal(audit.revision, 2);
  assert.equal(audit.content_hash, approved.contentHash);
  assert.deepEqual(JSON.parse(audit.record as string), approved.approval);
  assert.equal(await store.recordApproval('user-a', approved, 1, snapshot.version), false);
  assert.equal(db.count('approval_records'), 1);
  const nextContent = { ...initial.content, altText: 'A revised accessible description.' };
  const edited = { ...approved, revision: 3, content: nextContent, contentHash: await draftVersion(nextContent), approval: null };
  assert.equal(await store.saveDraft('user-a', edited, 2, snapshot.version), true);
  assert.equal((await store.getDraft('user-a', initial.id))!.approval, null);
  assert.equal(db.count('approval_records'), 1);
});

test('D1 batch rolls back a source insert if active-source SQL fails', async t => {
  const { db, store, snapshot } = await fixture(); t.after(() => db.close());
  db.db.exec("CREATE TRIGGER reject_activation BEFORE INSERT ON source_state BEGIN SELECT RAISE(ABORT, 'activation rejected'); END");
  await assert.rejects(store.putSnapshot(snapshot, true), /activation rejected/);
  assert.equal(db.count('source_snapshots'), 0);
  assert.equal(db.count('source_state'), 0);
});

test('D1 export SQL requires the exact stored reviewer record, user, revision, and content hash', async t => {
  const { db, store, snapshot } = await fixture(); t.after(() => db.close());
  await store.putSnapshot(snapshot, true);
  const initial = await storedDraft(snapshot); await store.saveDraft('user-a', initial, null, snapshot.version);
  const approved = await approveStored(initial, snapshot);
  await store.recordApproval('user-a', approved, 1, snapshot.version);
  const record = await exportRecord(approved, snapshot);
  const changedApproval = { ...approved.approval!, reviewedBy: 'user-b' };
  assert.equal(await store.recordExport(record, snapshot.version, changedApproval), false);
  assert.equal(await store.recordExport({ ...record, userId: 'user-b' }, snapshot.version, approved.approval!), false);
  assert.equal(await store.recordExport({ ...record, revision: 1 }, snapshot.version, approved.approval!), false);
  assert.equal(await store.recordExport({ ...record, contentHash: 'changed-content' }, snapshot.version, approved.approval!), false);
  assert.equal(db.count('export_records'), 0);
  assert.equal(await store.recordExport(record, snapshot.version, approved.approval!), true);
  assert.equal(db.count('export_records'), 1);
  const stored = db.db.prepare('SELECT * FROM export_records').get()!;
  assert.equal(stored.package_hash, record.packageHash);
  assert.deepEqual(JSON.parse(stored.metadata as string), record.package);
  const edited = { ...approved, revision: 3, approval: null };
  await store.saveDraft('user-a', edited, 2, snapshot.version);
  assert.equal(await store.recordExport({ ...record, id: 'after-edit' }, snapshot.version, approved.approval!), false);
  assert.equal(db.count('export_records'), 1);
});

test('D1 rate-limit UPSERT grants ten calls, rejects the eleventh, and isolates account/operation/minute', async t => {
  const { db, store } = await fixture(); t.after(() => db.close());
  const minute = 1000;
  for (let i = 0; i < 10; i++) assert.equal(await store.takeLimit('user-a', 'generate', minute, 10), true);
  assert.equal(await store.takeLimit('user-a', 'generate', minute, 10), false);
  assert.equal(await store.takeLimit('user-a', 'generate', minute, 10), false);
  assert.equal(db.db.prepare('SELECT calls FROM request_limits WHERE key=?').get('generate:user-a:1000')!.calls, 10);
  assert.equal(await store.takeLimit('user-b', 'generate', minute, 10), true);
  assert.equal(await store.takeLimit('user-a', 'refresh', minute, 3), true);
  assert.equal(await store.takeLimit('user-a', 'generate', minute + 1, 10), true);
  const competing = await Promise.all(Array.from({ length: 25 }, () => store.takeLimit('user-c', 'generate', minute, 10)));
  assert.equal(competing.filter(Boolean).length, 10);
  assert.equal(db.db.prepare('SELECT calls FROM request_limits WHERE key=?').get('generate:user-c:1000')!.calls, 10);
  await store.takeLimit('user-a', 'generate', minute + 3, 10);
  assert.equal(db.db.prepare('SELECT key FROM request_limits WHERE key=?').get('generate:user-a:1000'), undefined);
});
