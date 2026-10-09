import type { Approval, Draft, EditorialAngle, ExportPackage, Platform, SourceSnapshot } from "../domain/domain.ts";

export interface Actor { userId: string; displayName: string }
export interface GenerationMetadata {
  receiptId: string; provider: "anthropic"; model: string; requestId: string | null; messageId: string;
  inputTokens: number | null; outputTokens: number | null; generatedAt: string;
  sourceVersion: string; snapshotVersion: string; platform: Platform; angle: EditorialAngle;
  originalEditorialHash: string; editorialEdited: boolean;
  grounding: "official-abstract" | "editorial-paraphrase" | "schedule-only";
}
export interface GenerationReceipt {
  id: string; userId: string; sessionId: string; sourceVersion: string; editorialHash: string; metadata: GenerationMetadata;
}
export interface StoredDraft {
  id: string; revision: number; content: Draft; contentHash: string; approval: Approval | null;
  generation: GenerationMetadata | null; createdAt: string; updatedAt: string;
}
export interface ExportRecord {
  id: string; draftId: string; userId: string; revision: number; sourceVersion: string;
  contentHash: string; packageHash: string; exportedAt: string;
  package: ExportPackage & { generation: GenerationMetadata | null; snapshotVersion: string;
    graphic: { filename: string; mimeType: "image/svg+xml"; svg: string; sha256: string } };
}
export interface DispatchStore {
  currentSnapshot(): Promise<SourceSnapshot | null>;
  putSnapshot(snapshot: SourceSnapshot, initializeOnly?: boolean): Promise<void>;
  listDrafts(userId: string): Promise<StoredDraft[]>;
  getDraft(userId: string, id: string): Promise<StoredDraft | null>;
  saveDraft(userId: string, draft: StoredDraft, expectedVersion: number | null, snapshotVersion: string): Promise<boolean>;
  recordApproval(userId: string, draft: StoredDraft, expectedVersion: number, snapshotVersion: string): Promise<boolean>;
  recordExport(record: ExportRecord, snapshotVersion: string, approval: Approval): Promise<boolean>;
  takeLimit(userId: string, operation: "generate" | "refresh", minute: number, max: number): Promise<boolean>;
  saveGeneration(receipt: GenerationReceipt): Promise<void>;
  getGeneration(userId: string, id: string): Promise<GenerationReceipt | null>;
}
