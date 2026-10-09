import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalHash, createDraft, sha256, type Approval, type Draft, type SourceSnapshot } from "../lib/domain/domain.ts";
import { createSeedSnapshot } from "../lib/domain/seed.ts";
import { ServiceError } from "../lib/server/errors.ts";
import { generateEditorial } from "../lib/server/provider.ts";
import { DispatchService, type ServiceDependencies } from "../lib/server/service.ts";
import { refreshOfficialSource } from "../lib/server/source.ts";
import type { DispatchStore, ExportRecord, GenerationReceipt, StoredDraft } from "../lib/server/types.ts";

const origin = "https://dispatch.example";
const actor = { userId: "authenticated-actor", displayName: "Festival reviewer" };
const timestamp = new Date("2026-10-09T17:00:00Z");
const clone = <T>(value: T): T => structuredClone(value);

class MemoryStore implements DispatchStore {
  snapshot: SourceSnapshot | null = null; drafts = new Map<string, { userId: string; value: StoredDraft }>();
  exports: ExportRecord[] = []; approvals: Approval[] = []; generations = new Map<string, GenerationReceipt>(); limits = new Map<string, number>(); rejectWrite = false;
  async currentSnapshot() { return this.snapshot && clone(this.snapshot); }
  async putSnapshot(snapshot: SourceSnapshot, initializeOnly = false) { if (!initializeOnly || !this.snapshot) this.snapshot = clone(snapshot); }
  async listDrafts(userId: string) { return [...this.drafts.values()].filter(row => row.userId === userId).map(row => clone(row.value)); }
  async getDraft(userId: string, id: string) { const row = this.drafts.get(id); return row?.userId === userId ? clone(row.value) : null; }
  async saveDraft(userId: string, value: StoredDraft, expectedVersion: number | null, snapshotVersion: string) {
    const previous = this.drafts.get(value.id);
    if (this.rejectWrite || this.snapshot?.version !== snapshotVersion || (expectedVersion === null ? !!previous : !previous || previous.userId !== userId || previous.value.revision !== expectedVersion)) return false;
    this.drafts.set(value.id, { userId, value: clone(value) }); return true;
  }
  async recordApproval(userId: string, value: StoredDraft, expectedVersion: number, snapshotVersion: string) {
    const previous = this.drafts.get(value.id);
    if (this.rejectWrite || this.snapshot?.version !== snapshotVersion || previous?.userId !== userId || previous.value.revision !== expectedVersion || previous.value.contentHash !== value.contentHash) return false;
    this.drafts.set(value.id, { userId, value: clone(value) }); this.approvals.push(clone(value.approval!)); return true;
  }
  async recordExport(record: ExportRecord, snapshotVersion: string, approval: Approval) {
    const previous = this.drafts.get(record.draftId);
    if (this.rejectWrite || this.snapshot?.version !== snapshotVersion || previous?.userId !== record.userId || previous.value.revision !== record.revision || previous.value.contentHash !== record.contentHash || JSON.stringify(previous.value.approval) !== JSON.stringify(approval)) return false;
    this.exports.push(clone(record)); return true;
  }
  async takeLimit(userId: string, operation: "generate" | "refresh", minute: number, max: number) {
    const key = `${userId}:${operation}:${minute}`; const count = this.limits.get(key) ?? 0;
    if (count >= max) return false; this.limits.set(key, count + 1); return true;
  }
  async saveGeneration(receipt: GenerationReceipt) { this.generations.set(receipt.id, clone(receipt)); }
  async getGeneration(userId: string, id: string) { const receipt = this.generations.get(id); return receipt?.userId === userId ? clone(receipt) : null; }
}

function request(path: string, body?: unknown, customOrigin = origin) {
  return new Request(`${origin}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", origin: customOrigin, "sec-fetch-site": customOrigin === origin ? "same-origin" : "cross-site" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function fixture(overrides: Partial<ServiceDependencies> = {}) {
  const store = new MemoryStore(); store.snapshot = await createSeedSnapshot();
  const deps: ServiceDependencies = { store, authenticate: async () => actor, provider: {}, now: () => timestamp, ...overrides };
  const service = new DispatchService(deps);
  const session = store.snapshot.sessions.find(s => s.conflicts.length === 0)!;
  const content = createDraft(session, { id: "client-new-id", platform: "linkedin", angle: "question", editorialText: "What will we make together?\n\nExplore a different approach.", altText: "A typographic festival poster for this session." });
  return { store, service, deps, session, content };
}
async function save(service: DispatchService, content: Draft): Promise<StoredDraft> {
  const response = await service.handle("save", request("/api/drafts/save", { content }));
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json() as { draft: StoredDraft }).draft;
}
function completedMessage(text = JSON.stringify({ hook: "Try a different approach.", body: "Explore this session together." })) {
  return { id: "msg_verified", type: "message", role: "assistant", model: "configured-test-model", stop_reason: "end_turn", content: [{ type: "text", text }], usage: { input_tokens: 500, output_tokens: 40 } };
}
const jsonFetcher = (payload: unknown): typeof fetch => (async () => Response.json(payload, { headers: { "request-id": "req_verified" } })) as typeof fetch;

test("unauthenticated read/write and cross-origin writes are rejected before storage or generation", async () => {
  const { deps, content, store } = await fixture();
  const anonymous = new DispatchService({ ...deps, authenticate: async () => null });
  assert.equal((await anonymous.handle("workspace", request("/api/workspace"))).status, 401);
  assert.equal((await anonymous.handle("save", request("/api/drafts/save", { content }))).status, 401);
  const authenticated = new DispatchService(deps);
  assert.equal((await authenticated.handle("save", request("/api/drafts/save", { content }, "https://attacker.example"))).status, 403);
  const noOrigin = new Request(`${origin}/api/drafts/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }) });
  assert.equal((await authenticated.handle("save", noOrigin)).status, 403);
  assert.equal(store.drafts.size, 0);
});

test("request schemas reject approval and account claims, arbitrary URLs, native identities, and oversized bodies", async () => {
  const { service, content, store } = await fixture();
  assert.equal((await service.handle("save", request("/api/drafts/save", { content, userId: "another-user", approval: { reviewedBy: "owner" } }))).status, 400);
  assert.equal((await service.handle("refresh", request("/api/source/refresh", { url: "https://internal.example/secret" }))).status, 400);
  assert.equal((await service.handle("save", request("/api/drafts/save", { content: { ...content, editorialText: "x".repeat(70000) } }))).status, 413);
  assert.equal((await service.handle("save", request("/api/drafts/save", { content: { ...content, destination: "a-connected-account" } }))).status, 400);
  const suppliedPortrait = store.snapshot!.sessions.find(s => s.presenter.photoUrl)!.presenter.photoUrl;
  assert.ok(suppliedPortrait, "The captured source contains supplied speaker photographs.");
  assert.equal((await service.handle("save", request("/api/drafts/save", { content: { ...content, photoUrl: suppliedPortrait } }))).status, 400);
  assert.equal(store.drafts.size, 0);
});

test("saving scopes ownership, assigns IDs, rejects stale sources and revisions, and strips claimed reviewers", async () => {
  const { service, store, content, deps, session } = await fixture();
  const draft = await save(service, { ...content, profiles: [{ sessionId: session.id, platform: "linkedin", url: "https://www.linkedin.com/in/test-speaker/", handle: "test-speaker", identityKind: "person", nativeId: null, reviewedBy: "forged-actor", reviewedAt: "2000-01-01T00:00:00Z" }] });
  assert.notEqual(draft.id, content.id); assert.equal(draft.content.id, draft.id);
  assert.equal(draft.content.profiles[0].reviewedBy, actor.userId);
  assert.equal(draft.content.profiles[0].reviewedAt, timestamp.toISOString());
  assert.equal((await service.handle("save", request("/api/drafts/save", { id: draft.id, expectedVersion: draft.revision, content: { ...draft.content, sourceVersion: "stale-source" } }))).status, 409);
  assert.equal((await service.handle("approve", request("/api/drafts/approve", { id: draft.id, expectedVersion: 99 }))).status, 409);
  const otherUser = new DispatchService({ ...deps, authenticate: async () => ({ userId: "another-user", displayName: "Other" }) });
  assert.equal((await otherUser.handle("approve", request("/api/drafts/approve", { id: draft.id, expectedVersion: 1 }))).status, 404);
  const workspace = await otherUser.handle("workspace", request("/api/workspace"));
  assert.deepEqual((await workspace.json() as { drafts: unknown[] }).drafts, []);
  assert.equal(store.drafts.get(draft.id)!.value.revision, 1);
});

test("conflicting timed facts block approval; deliberate omission permits reviewed export with authoritative metadata", async () => {
  const { service, store } = await fixture();
  const session = store.snapshot!.sessions.find(s => s.conflicts.some(c => c.field === "startTime"))!;
  const content = createDraft(session, { id: "conflicted", platform: "linkedin", angle: "practical", editorialText: "Find a useful approach.", altText: "A typographic poster for the session.", includeDate: true, includeTime: true });
  const timed = await save(service, content);
  const blocked = await service.handle("approve", request("/api/drafts/approve", { id: timed.id, expectedVersion: timed.revision }));
  assert.equal(blocked.status, 422); assert.equal(store.approvals.length, 0);
  const update = await service.handle("save", request("/api/drafts/save", { id: timed.id, expectedVersion: timed.revision, content: { ...timed.content, includeTime: false, includeDate: false } }));
  const edited = (await update.json() as { draft: StoredDraft }).draft;
  const approve = await service.handle("approve", request("/api/drafts/approve", { id: edited.id, expectedVersion: edited.revision }));
  assert.equal(approve.status, 200); const approved = (await approve.json() as { draft: StoredDraft }).draft;
  assert.equal(approved.approval!.reviewedBy, actor.userId);
  const exported = await service.handle("export", request("/api/drafts/export", { id: approved.id, expectedVersion: approved.revision }));
  assert.equal(exported.status, 200); const result = await exported.json() as { package: ExportRecord["package"]; record: { packageHash: string } };
  assert.equal(result.package.review.reviewedBy, actor.userId); assert.equal(result.package.sourceVersion, session.version);
  assert.equal(result.package.snapshotVersion, store.snapshot!.version); assert.equal(result.package.generation, null);
  assert.equal(result.package.graphic.mimeType, "image/svg+xml");
  assert.ok(result.package.graphic.svg.includes(session.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")));
  assert.equal(result.package.graphic.sha256, await sha256(result.package.graphic.svg));
  assert.equal(result.record.packageHash, await canonicalHash(result.package));
  assert.equal(store.exports.length, 1); assert.ok(result.package.review.omittedDisputedFields.includes("startTime"));
});

test("client and persisted approval tampering, content edits, and concurrent snapshot writes cannot export", async () => {
  const { service, store, content } = await fixture(); const draft = await save(service, content);
  const approvedResponse = await service.handle("approve", request("/api/drafts/approve", { id: draft.id, expectedVersion: draft.revision }));
  const approved = (await approvedResponse.json() as { draft: StoredDraft }).draft;
  assert.equal((await service.handle("export", request("/api/drafts/export", { id: approved.id, expectedVersion: approved.revision, approval: approved.approval }))).status, 400);
  store.drafts.get(approved.id)!.value.approval!.draftVersion = "tampered";
  assert.equal((await service.handle("export", request("/api/drafts/export", { id: approved.id, expectedVersion: approved.revision }))).status, 422);
  store.drafts.get(approved.id)!.value.approval = approved.approval;
  store.rejectWrite = true;
  assert.equal((await service.handle("export", request("/api/drafts/export", { id: approved.id, expectedVersion: approved.revision }))).status, 409);
  store.rejectWrite = false;
  const update = await service.handle("save", request("/api/drafts/save", { id: approved.id, expectedVersion: approved.revision, content: { ...approved.content, altText: "An edited alternative description." } }));
  const edited = (await update.json() as { draft: StoredDraft }).draft;
  assert.equal(edited.approval, null);
  assert.equal((await service.handle("export", request("/api/drafts/export", { id: edited.id, expectedVersion: edited.revision }))).status, 422);
  assert.equal(store.exports.length, 0);
});

test("unconfigured and malformed providers preserve saved draft and approval", async () => {
  const { service, store, content, session, deps } = await fixture(); const draft = await save(service, content);
  const generationBody = { sessionId: session.id, sourceVersion: session.version, platform: "linkedin", angle: "question" };
  assert.equal((await service.handle("generate", request("/api/drafts/generate", generationBody))).status, 503);
  for (const payload of [null, {}, { ...completedMessage(), content: [null] }, { ...completedMessage(), content: [123] }, { ...completedMessage(), stop_reason: "max_tokens" }, completedMessage("not-json"), completedMessage(JSON.stringify({ hook: "Hello", body: "World", speaker: "Invented" }))]) {
    const configured = new DispatchService({ ...deps, provider: { apiKey: "test-secret", model: "explicit-test-model" }, fetcher: jsonFetcher(payload) });
    assert.equal((await configured.handle("generate", request("/api/drafts/generate", generationBody))).status, 502);
  }
  assert.deepEqual(store.drafts.get(draft.id)!.value, draft);
  assert.equal(store.generations.size, 0);
});

test("generation preserves attribution, accepts thinking blocks, uses structured JSON, and never accepts client models", async () => {
  const { deps, session, content, store } = await fixture(); let seenBody: Record<string, unknown> | undefined;
  const fetcher: typeof fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages"); seenBody = JSON.parse(init!.body as string);
    assert.equal((init!.headers as Record<string, string>)["x-api-key"], "test-secret");
    const payload = completedMessage(); return Response.json({ ...payload, content: [{ type: "thinking", thinking: "private", signature: "private" }, ...payload.content] }, { headers: { "request-id": "req_verified" } });
  }) as typeof fetch;
  const service = new DispatchService({ ...deps, provider: { apiKey: "test-secret", model: "explicit-test-model" }, fetcher });
  const body = { sessionId: session.id, sourceVersion: session.version, platform: "linkedin", angle: "question" };
  assert.equal((await service.handle("generate", request("/api/drafts/generate", { ...body, model: "user-overridden" }))).status, 400);
  const response = await service.handle("generate", request("/api/drafts/generate", body)); assert.equal(response.status, 200);
  const generated = await response.json() as { editorialText: string; generationId: string; provenance: { requestId: string; grounding: string; editorialEdited: boolean } };
  assert.equal(seenBody!.model, "explicit-test-model"); assert.deepEqual(Object.keys(seenBody!).sort(), ["max_tokens", "messages", "model", "output_config", "system"]);
  assert.equal(generated.provenance.requestId, "req_verified"); assert.equal(generated.provenance.grounding, session.topicSummary ? "editorial-paraphrase" : "schedule-only");
  assert.equal(store.drafts.size, 0);
  const saveResponse = await service.handle("save", request("/api/drafts/save", { content: { ...content, generationMode: "claude", editorialText: generated.editorialText + "\nAn organizer edit." }, generationId: generated.generationId }));
  assert.equal(saveResponse.status, 200); const saved = (await saveResponse.json() as { draft: StoredDraft }).draft;
  assert.equal(saved.generation!.editorialEdited, true); assert.equal(saved.generation!.messageId, "msg_verified");
  assert.equal((await service.handle("save", request("/api/drafts/save", { id: saved.id, expectedVersion: saved.revision, content: { ...saved.content, platform: "facebook" } }))).status, 400);
  assert.equal((await service.handle("save", request("/api/drafts/save", { content: { ...content, generationMode: "claude" } }))).status, 400);
});

test("provider timeout, refusal, rate and billing failures remain explicit and sanitized", async () => {
  const { session, store } = await fixture(); const base = { session, snapshot: store.snapshot!, platform: "linkedin" as const, angle: "question" as const, config: { apiKey: "test-secret", model: "explicit-test-model" } };
  const timeoutFetcher: typeof fetch = (async (_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => { init!.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); })) as typeof fetch;
  await assert.rejects(generateEditorial({ ...base, fetcher: timeoutFetcher, timeoutMs: 5 }), (error: unknown) => error instanceof ServiceError && error.status === 504 && error.code === "provider-timeout");
  await assert.rejects(generateEditorial({ ...base, fetcher: jsonFetcher({ ...completedMessage(), stop_reason: "refusal" }) }), (error: unknown) => error instanceof ServiceError && error.status === 422);
  const billing = (async () => Response.json({ error: { message: "Credit balance too low test-secret" } }, { status: 400, headers: { "request-id": "req_billing" } })) as typeof fetch;
  await assert.rejects(generateEditorial({ ...base, fetcher: billing }), (error: unknown) => error instanceof ServiceError && error.code === "provider-billing" && error.requestId === "req_billing" && !error.message.includes("test-secret"));
  const rate = (async () => Response.json({}, { status: 429, headers: { "retry-after": "30" } })) as typeof fetch;
  await assert.rejects(generateEditorial({ ...base, fetcher: rate }), (error: unknown) => error instanceof ServiceError && error.code === "provider-rate-limit" && error.retryAfter === 30);
  await assert.rejects(generateEditorial({ ...base, fetcher: (async () => new Response("<html>unavailable</html>", { status: 402 })) as typeof fetch }), (error: unknown) => error instanceof ServiceError && error.code === "provider-billing");
  await assert.rejects(generateEditorial({ ...base, fetcher: (async () => new Response("", { status: 504 })) as typeof fetch }), (error: unknown) => error instanceof ServiceError && error.code === "provider-timeout" && error.status === 504);
});

test("per-actor generation limiter counts attempts before concurrent provider calls", async () => {
  const { deps, session } = await fixture(); let calls = 0;
  const fetcher = (async () => { calls++; return Response.json(completedMessage()); }) as typeof fetch;
  const service = new DispatchService({ ...deps, provider: { apiKey: "test-secret", model: "explicit-test-model" }, fetcher });
  const responses = await Promise.all(Array.from({ length: 11 }, () => service.handle("generate", request("/api/drafts/generate", { sessionId: session.id, sourceVersion: session.version, platform: "linkedin", angle: "question" }))));
  assert.equal(calls, 10); assert.equal(responses.filter(r => r.status === 429).length, 1);
});

test("source refresh failure preserves trusted snapshot and initial fallback is visibly marked seed", async () => {
  const { deps, store } = await fixture(); const before = clone(store.snapshot);
  const service = new DispatchService({ ...deps, sourceLoader: async () => { throw new ServiceError(503, "source-unavailable", "Source unavailable"); } });
  assert.equal((await service.handle("refresh", request("/api/source/refresh", {}))).status, 503); assert.deepEqual(store.snapshot, before);
  store.snapshot = null;
  const response = await service.handle("workspace", request("/api/workspace")); assert.equal(response.status, 200);
  assert.equal((await response.json() as { snapshot: SourceSnapshot }).snapshot.mode, "seed");
});

test("public source transport has fixed URL, response bounds, and a whole-request timeout", async () => {
  const oversized = (async (url: unknown, options?: RequestInit) => { assert.equal(url, "https://fest.philosophers.group/content.json"); assert.equal(options!.redirect, "error"); return new Response("", { headers: { "content-length": String(5 * 1024 * 1024 + 1) } }); }) as typeof fetch;
  await assert.rejects(refreshOfficialSource(oversized), (error: unknown) => error instanceof ServiceError && error.status === 413);
  const never = (async (_url: unknown, options?: RequestInit) => new Promise<Response>((_resolve, reject) => { options!.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); })) as typeof fetch;
  await assert.rejects(refreshOfficialSource(never, timestamp, 5), (error: unknown) => error instanceof ServiceError && error.status === 504);
});
