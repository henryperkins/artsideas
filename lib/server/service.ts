import { z } from "zod";
import { approveDraft, assembleExport, canonicalHash, createDraft, draftVersion, sessionVersion, sha256, validateDraft, type Draft, type Session, type SourceSnapshot } from "../domain/domain.ts";
import { posterSvg } from "../../components/dispatch/poster-svg.ts";
import { createSeedSnapshot } from "../domain/seed.ts";
import { ServiceError, errorResponse } from "./errors.ts";
import { readJsonBody, requireSameOrigin } from "./http.ts";
import { generateEditorial, type ProviderConfig } from "./provider.ts";
import { refreshOfficialSource } from "./source.ts";
import type { Actor, DispatchStore, ExportRecord, GenerationMetadata, StoredDraft } from "./types.ts";

const id = z.string().min(1).max(200);
const platform = z.enum(["linkedin", "instagram", "facebook", "x"]);
const angle = z.enum(["question", "hands-on", "practical"]);
const profile = z.object({ sessionId: id, platform, url: z.string().max(1000), handle: z.string().max(100), identityKind: z.enum(["person", "organization"]), nativeId: z.null(), reviewedBy: z.string().max(200), reviewedAt: z.string().max(100) }).strict();
const resolution = z.object({ field: z.enum(["date", "startTime", "location"]), value: z.string().max(1000), sourceVersion: id, confirmedBy: z.string().max(200), confirmedAt: z.string().max(100), reason: z.string().min(1).max(2000) }).strict();
const draftSchema = z.object({ id, sessionId: id, sourceVersion: id, platform, angle, editorialText: z.string().max(12000), altText: z.string().max(2000), generationMode: z.enum(["hand-authored-sample", "claude"]), includeDate: z.boolean(), includeTime: z.boolean(), includeLocation: z.boolean(), posterTemplate: z.enum(["blue", "yellow", "teal", "red"]), photoUrl: z.null(), destination: z.null(), profiles: z.array(profile).max(10), resolutions: z.array(resolution).max(3) }).strict();
const saveSchema = z.object({ content: draftSchema, id: id.optional(), expectedVersion: z.number().int().positive().optional(), generationId: id.optional() }).strict();
const versionedSchema = z.object({ id, expectedVersion: z.number().int().positive() }).strict();
const generateSchema = z.object({ sessionId: id, sourceVersion: id, platform, angle }).strict();

export interface ServiceDependencies {
  store: DispatchStore; authenticate: (request: Request) => Promise<Actor | null>; provider: ProviderConfig;
  fetcher?: typeof fetch; now?: () => Date; sourceLoader?: () => Promise<SourceSnapshot>;
}
type Action = "workspace" | "refresh" | "save" | "approve" | "export" | "generate";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ServiceError(400, "invalid-request", "This request contains missing, invalid, or unsupported fields.");
  return result.data;
}

export class DispatchService {
  private deps: ServiceDependencies;
  constructor(deps: ServiceDependencies) { this.deps = deps; }
  private now() { return (this.deps.now ?? (() => new Date()))(); }
  private async snapshot(): Promise<SourceSnapshot> {
    let snapshot = await this.deps.store.currentSnapshot();
    if (!snapshot) {
      try { snapshot = await this.loadSource(); } catch { snapshot = await createSeedSnapshot(); }
      await this.deps.store.putSnapshot(snapshot, true);
      snapshot = await this.deps.store.currentSnapshot();
    }
    if (!snapshot) throw new ServiceError(503, "source-unavailable", "The program source is unavailable.");
    const hash = await canonicalHash(snapshot.sessions.map(s => ({ id: s.id, version: s.version })).sort((a, b) => a.id.localeCompare(b.id)));
    if (snapshot.version !== hash) throw new ServiceError(503, "source-integrity", "The stored program source failed its integrity check. Refresh it before continuing.");
    return snapshot;
  }
  private loadSource() { return this.deps.sourceLoader?.() ?? refreshOfficialSource(this.deps.fetcher, this.now()); }
  private async session(snapshot: SourceSnapshot, sessionId: string, version?: string): Promise<Session> {
    const session = snapshot.sessions.find(s => s.id === sessionId);
    if (!session) throw new ServiceError(404, "session-not-found", "That session is not in the current program.");
    if (session.version !== await sessionVersion(session)) throw new ServiceError(503, "source-integrity", "The stored session failed its integrity check. Refresh it before continuing.");
    if (version && version !== session.version) throw new ServiceError(409, "stale-source", "The published session has changed. Review the current source before continuing.");
    return session;
  }
  private async stored(actor: Actor, input: { id: string; expectedVersion: number }): Promise<StoredDraft> {
    const stored = await this.deps.store.getDraft(actor.userId, input.id);
    if (!stored) throw new ServiceError(404, "draft-not-found", "That draft is unavailable in this account.");
    if (stored.revision !== input.expectedVersion) throw new ServiceError(409, "draft-changed", "The saved draft has changed. Reload it before continuing.");
    if (stored.contentHash !== await draftVersion(stored.content)) throw new ServiceError(409, "draft-integrity", "The saved draft failed its integrity check. Save and review a new version.");
    return stored;
  }
  private conflict() { throw new ServiceError(409, "concurrent-change", "The source or saved draft changed during this action. Reload and review the current version."); }
  async handle(action: Action, request: Request): Promise<Response> {
    try {
      const actor = await this.deps.authenticate(request);
      if (!actor?.userId) throw new ServiceError(401, "authentication-required", "Sign in with ChatGPT to save, review, and export drafts.");
      if (action !== "workspace") requireSameOrigin(request);
      const input = action === "workspace" ? undefined : await readJsonBody(request);
      const result = await this.run(action, actor, input);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) { return errorResponse(error); }
  }
  private async run(action: Action, actor: Actor, body: unknown): Promise<unknown> {
    if (action === "refresh") {
      parse(z.object({}).strict(), body);
      if (!await this.deps.store.takeLimit(actor.userId, "refresh", Math.floor(this.now().getTime() / 60000), 3)) throw new ServiceError(429, "refresh-limited", "Wait a minute before refreshing the official source again.");
      const snapshot = await this.loadSource(); await this.deps.store.putSnapshot(snapshot);
      return { snapshot };
    }
    const snapshot = await this.snapshot();
    if (action === "workspace") return { snapshot, drafts: await this.deps.store.listDrafts(actor.userId), provider: { configured: !!this.deps.provider.apiKey?.trim() && !!this.deps.provider.model?.trim() } };
    if (action === "generate") {
      const input = parse(generateSchema, body); const session = await this.session(snapshot, input.sessionId, input.sourceVersion);
      if (!this.deps.provider.apiKey?.trim() || !this.deps.provider.model?.trim()) throw new ServiceError(503, "provider-unconfigured", "Claude generation requires an Anthropic API key and an explicitly selected model. The current draft is unchanged.");
      if (!await this.deps.store.takeLimit(actor.userId, "generate", Math.floor(this.now().getTime() / 60000), 10)) throw new ServiceError(429, "generation-limited", "This account has reached ten generation attempts in one minute. Try again shortly.");
      const generated = await generateEditorial({ session, snapshot, platform: input.platform, angle: input.angle, config: this.deps.provider, fetcher: this.deps.fetcher, now: this.now() });
      const candidate = createDraft(session, { id: generated.metadata.receiptId, platform: input.platform, angle: input.angle, editorialText: generated.editorialText, altText: "Promotional festival poster", generationMode: "claude" });
      const issues = await validateDraft(candidate, session);
      if (issues.length) throw new ServiceError(502, "provider-draft-invalid", "Claude returned copy that failed factual or platform checks. The current draft is unchanged.", issues);
      if ((await this.deps.store.currentSnapshot())?.version !== snapshot.version) this.conflict();
      await this.deps.store.saveGeneration({ id: generated.metadata.receiptId, userId: actor.userId, sessionId: session.id, sourceVersion: session.version, editorialHash: await canonicalHash(generated.editorialText), metadata: generated.metadata });
      return { editorialText: generated.editorialText, generationId: generated.metadata.receiptId, provenance: generated.metadata };
    }
    if (action === "save") {
      const input = parse(saveSchema, body);
      if (!!input.id !== !!input.expectedVersion) throw new ServiceError(400, "version-required", "Updating a draft requires its saved ID and current revision.");
      const session = await this.session(snapshot, input.content.sessionId, input.content.sourceVersion);
      const previous = input.id ? await this.stored(actor, { id: input.id, expectedVersion: input.expectedVersion! }) : null;
      if (previous && previous.content.sessionId !== input.content.sessionId) throw new ServiceError(400, "session-mismatch", "Create a new draft when selecting a different session.");
      const timestamp = this.now().toISOString();
      const content: Draft = { ...input.content, id: previous?.id ?? crypto.randomUUID(), profiles: input.content.profiles.map(p => ({ ...p, reviewedBy: actor.userId, reviewedAt: timestamp })), resolutions: input.content.resolutions.map(r => ({ ...r, confirmedBy: actor.userId, confirmedAt: timestamp })) };
      if (new Set(content.resolutions.map(r => r.field)).size !== content.resolutions.length) throw new ServiceError(400, "duplicate-resolution", "Each factual field may have only one recorded resolution.");
      let generation: GenerationMetadata | null = null;
      if (input.generationId) {
        const receipt = await this.deps.store.getGeneration(actor.userId, input.generationId);
        if (!receipt || receipt.sessionId !== session.id || receipt.sourceVersion !== session.version || receipt.metadata.platform !== content.platform || receipt.metadata.angle !== content.angle) throw new ServiceError(400, "generation-mismatch", "The Claude attribution does not match this account, source, and draft format.");
        generation = { ...receipt.metadata, editorialEdited: receipt.editorialHash !== await canonicalHash(content.editorialText) };
      } else if (content.generationMode === "claude" && previous?.generation) {
        if (previous.generation.sourceVersion !== session.version || previous.generation.platform !== content.platform || previous.generation.angle !== content.angle) throw new ServiceError(400, "generation-mismatch", "This draft's Claude provenance uses a different source or format. Generate a fresh draft for the selected context.");
        generation = { ...previous.generation, editorialEdited: previous.generation.originalEditorialHash !== await canonicalHash(content.editorialText) };
      }
      if (content.generationMode === "claude" && !generation) throw new ServiceError(400, "generation-required", "Claude attribution requires a generation receipt from this account.");
      if (content.generationMode === "hand-authored-sample") generation = null;
      const draft: StoredDraft = { id: content.id, revision: (previous?.revision ?? 0) + 1, content, contentHash: await draftVersion(content), approval: null, generation, createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp };
      const issues = await validateDraft(content, session);
      if (!await this.deps.store.saveDraft(actor.userId, draft, previous?.revision ?? null, snapshot.version)) this.conflict();
      return { draft, issues };
    }
    const input = parse(versionedSchema, body); const previous = await this.stored(actor, input);
    const session = await this.session(snapshot, previous.content.sessionId, previous.content.sourceVersion);
    if (action === "approve") {
      const issues = await validateDraft(previous.content, session);
      if (issues.length) throw new ServiceError(422, "review-blocked", "Resolve the review issues before approving this draft.", issues);
      const timestamp = this.now().toISOString(); const approval = await approveDraft(previous.content, session, actor.userId, timestamp);
      const draft = { ...previous, revision: previous.revision + 1, approval, updatedAt: timestamp };
      if (!await this.deps.store.recordApproval(actor.userId, draft, previous.revision, snapshot.version)) this.conflict();
      return { draft };
    }
    if (action === "export") {
      if (!previous.approval || previous.approval.reviewedBy !== actor.userId) throw new ServiceError(422, "approval-required", "Approve this saved draft before exporting.");
      const timestamp = this.now().toISOString();
      let packageData: ExportRecord["package"];
      try {
        const assembled = await assembleExport(previous.content, session, previous.approval, timestamp);
        const svg = posterSvg(assembled.poster);
        packageData = { ...assembled, generation: previous.generation, snapshotVersion: snapshot.version,
          graphic: { filename: `${session.id}-${previous.content.platform}-graphic.svg`, mimeType: "image/svg+xml", svg, sha256: await sha256(svg) } };
      } catch { throw new ServiceError(422, "approval-required", "The approval does not match the current draft and source. Review and approve again."); }
      const record: ExportRecord = { id: crypto.randomUUID(), draftId: previous.id, userId: actor.userId, revision: previous.revision, sourceVersion: session.version, contentHash: previous.contentHash, packageHash: await canonicalHash(packageData), exportedAt: timestamp, package: packageData };
      if (!await this.deps.store.recordExport(record, snapshot.version, previous.approval)) this.conflict();
      return { record: { id: record.id, draftId: record.draftId, revision: record.revision, exportedAt: record.exportedAt, packageHash: record.packageHash }, package: packageData };
    }
    throw new ServiceError(400, "unknown-action", "This action is unavailable.");
  }
}
