"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { canonicalJson, isApprovalCurrent, rebaseDraft, validateDraft, type Draft, type ExportPackage, type Session, type SourceSnapshot, type ValidationIssue } from "@/lib/domain/domain";
import { createSeedSnapshot } from "@/lib/domain/seed";
import type { GenerationMetadata, StoredDraft } from "@/lib/server/types";
import ProgramRail from "./program-rail";
import DraftEditor from "./editor";
import { ReviewPanel, SourceDetails } from "./source-review";
import { capturedAt, downloadFile, fullDate, request, sampleDraft } from "./helpers";

type Tab = "draft" | "source" | "review";
type RecordedPackage = ExportPackage & { graphic: { filename: string; mimeType: string; svg: string; sha256: string } };
interface LocalDraft { content: Draft; generationId?: string }
interface WorkspaceResponse { snapshot: SourceSnapshot; drafts: StoredDraft[]; provider: { configured: boolean } }

export default function DispatchWorkspace() {
  const [snapshot, setSnapshot] = useState<SourceSnapshot | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<StoredDraft[]>([]);
  const [locals, setLocals] = useState<Record<string, LocalDraft>>({});
  const localsRef = useRef(locals);
  useEffect(() => { localsRef.current = locals; }, [locals]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("draft");
  const [search, setSearch] = useState(""); const [day, setDay] = useState(""); const [theme, setTheme] = useState("");
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ key: string; issues: ValidationIssue[]; approval: boolean }>({ key: "", issues: [], approval: false });
  const [exported, setExported] = useState<{ package: RecordedPackage; at: string } | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await request<WorkspaceResponse>("/api/workspace");
      setSnapshot(response.snapshot); setSavedDrafts(response.drafts); setProviderConfigured(response.provider.configured); setServerReady(true);
      const first = response.snapshot.sessions.find(s => /Analog Intelligence/i.test(s.title)) ?? response.snapshot.sessions[0];
      setActiveId(current => current ?? first?.id ?? null);
      setLocals(current => {
        const next = { ...current };
        for (const s of response.snapshot.sessions) {
          if (next[s.id]) continue;
          const stored = response.drafts.find(d => d.content.sessionId === s.id);
          if (stored) next[s.id] = { content: stored.content };
        }
        if (first && !next[first.id]) next[first.id] = { content: sampleDraft(first) };
        return next;
      });
    } catch (cause) {
      setServerReady(false);
      setError(`${cause instanceof Error ? cause.message : "The saved workspace could not be loaded."} You can inspect the captured program; saving and approval will resume when the workspace connects.`);
      const seed = await createSeedSnapshot();
      setSnapshot(current => current ?? seed);
      const first = seed.sessions.find(s => /Analog Intelligence/i.test(s.title)) ?? seed.sessions[0];
      if (first) { setActiveId(current => current ?? first.id); setLocals(current => current[first.id] ? current : { ...current, [first.id]: { content: sampleDraft(first) } }); }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(loadWorkspace); }, [loadWorkspace]);

  const session = snapshot?.sessions.find(s => s.id === activeId) ?? null;
  const local = activeId ? locals[activeId] : undefined;
  const draft = local?.content ?? null;
  const stored = draft ? savedDrafts.find(d => d.id === draft.id) ?? null : null;
  const dirty = !!draft && (!stored || canonicalJson(stored.content) !== canonicalJson(draft));
  const stale = !!draft && !!session && draft.sourceVersion !== session.version;
  const validationKey = draft && session ? canonicalJson({ draft, source: session.version, approval: stored?.approval ?? null }) : "";
  const issues = validation.key === validationKey ? validation.issues : [{ code: "checking", message: "Checking this revision against the source…" }];
  const approvalCurrent = validation.key === validationKey && validation.approval && !dirty;
  useEffect(() => {
    let current = true;
    if (!draft || !session) return;
    void Promise.all([validateDraft(draft, session), isApprovalCurrent(stored?.approval ?? null, draft, session)]).then(([checkedIssues, approval]) => { if (current) setValidation({ key: validationKey, issues: checkedIssues, approval }); }).catch(() => { if (current) setValidation({ key: validationKey, issues: [{ code: "validation-unavailable", message: "Source validation is unavailable. Reload the workspace before approving." }], approval: false }); });
    return () => { current = false; };
  }, [draft, session, stored, validationKey]);

  function chooseSession(next: Session) {
    if (busy) return;
    setActiveId(next.id); setTab("draft"); setError(null); setNotice(null); setExported(null);
    setLocals(current => {
      if (current[next.id]) return current;
      const previous = savedDrafts.find(d => d.content.sessionId === next.id);
      return { ...current, [next.id]: { content: previous?.content ?? sampleDraft(next) } };
    });
  }
  function changeDraft(updates: Partial<Draft>) {
    if (!session || !draft || busy) return;
    const contextChanged = updates.platform !== undefined && updates.platform !== draft.platform || updates.angle !== undefined && updates.angle !== draft.angle;
    setLocals(current => ({ ...current, [session.id]: { ...current[session.id], content: { ...draft, ...updates, ...(contextChanged ? { generationMode: "hand-authored-sample" as const } : {}) }, ...(contextChanged ? { generationId: undefined } : {}) } }));
    setExported(null); setNotice(null);
  }
  function acceptStored(next: StoredDraft, sessionId: string) {
    setSavedDrafts(current => [next, ...current.filter(d => d.id !== next.id)]);
    setLocals(current => ({ ...current, [sessionId]: { content: next.content } }));
  }
  async function save() {
    if (!draft || !session || busy) return;
    setBusy("save"); setError(null); setNotice(null);
    try {
      const response = await request<{ draft: StoredDraft; issues: ValidationIssue[] }>("/api/drafts/save", { content: draft, ...(stored ? { id: stored.id, expectedVersion: stored.revision } : {}), ...(local?.generationId ? { generationId: local.generationId } : {}) });
      acceptStored(response.draft, session.id); setNotice(`Draft saved · revision ${response.draft.revision}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The draft could not be saved."); }
    finally { setBusy(null); }
  }
  async function approve() {
    if (!stored || !session || dirty || busy) return;
    setBusy("approve"); setError(null); setNotice(null);
    try { const response = await request<{ draft: StoredDraft }>("/api/drafts/approve", { id: stored.id, expectedVersion: stored.revision }); acceptStored(response.draft, session.id); setNotice("Draft approved. The current revision is ready to export."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Approval failed."); }
    finally { setBusy(null); }
  }
  async function exportDraft() {
    if (!stored || !approvalCurrent || busy) return;
    setBusy("export"); setError(null); setNotice(null);
    try {
      const response = await request<{ package: RecordedPackage; record: { exportedAt: string } }>("/api/drafts/export", { id: stored.id, expectedVersion: stored.revision });
      setExported({ package: response.package, at: response.record.exportedAt });
      setNotice("Export recorded. Download the approved files below.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
    finally { setBusy(null); }
  }
  async function generate() {
    if (!draft || !session || !providerConfigured || busy || stale) return;
    const before = canonicalJson(draft); setBusy("generate"); setError(null); setNotice(null);
    try {
      const response = await request<{ editorialText: string; generationId: string; provenance: GenerationMetadata }>("/api/drafts/generate", { sessionId: session.id, sourceVersion: session.version, platform: draft.platform, angle: draft.angle });
      if (canonicalJson(localsRef.current[session.id]?.content) !== before) { setNotice("Claude returned a draft after you changed the editor. Your edits were preserved; generate again to use the current settings."); return; }
      setLocals(current => ({ ...current, [session.id]: { content: { ...draft, editorialText: response.editorialText, generationMode: "claude" }, generationId: response.generationId } }));
      setExported(null); setNotice("Claude draft received. Review the creative claims before saving and approving.");
    } catch (cause) { setError(`${cause instanceof Error ? cause.message : "Claude generation failed."} Your existing copy has been preserved.`); }
    finally { setBusy(null); }
  }
  async function refresh() {
    if (busy || !serverReady) return;
    setBusy("refresh"); setError(null); setNotice(null);
    try {
      const response = await request<{ snapshot: SourceSnapshot }>("/api/source/refresh", {});
      const changed = snapshot?.version !== response.snapshot.version; setSnapshot(response.snapshot);
      if (changed) setExported(null);
      if (activeId && !response.snapshot.sessions.some(s => s.id === activeId)) { const first = response.snapshot.sessions[0]; if (first) { setActiveId(first.id); setLocals(current => current[first.id] ? current : { ...current, [first.id]: { content: sampleDraft(first) } }); setTab("draft"); setExported(null); } }
      setNotice(changed ? "Program refreshed. Drafts with changed source facts need a new source review and approval." : "Program refreshed. Published session facts are unchanged.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The program could not be refreshed. The previous snapshot remains available."); }
    finally { setBusy(null); }
  }
  function reviewUpdatedSource() {
    if (!draft || !session || busy) return;
    const next = rebaseDraft(draft, session);
    setLocals(current => ({ ...current, [session.id]: { content: { ...next, generationMode: "hand-authored-sample", includeDate: draft.includeDate && !session.conflicts.some(c => c.field === "date"), includeTime: draft.includeTime && !session.conflicts.some(c => c.field === "startTime" || c.field === "date"), includeLocation: draft.includeLocation && !session.conflicts.some(c => c.field === "location") } } }));
    setExported(null); setTab("source"); setNotice("Draft linked to the current source. Prior conflict confirmations were cleared. Review the copy and facts, then save and approve again.");
  }
  const statuses = useMemo(() => Object.fromEntries(Object.entries(locals).map(([id, value]) => {
    const saved = savedDrafts.find(s => s.id === value.content.id);
    const currentSession = snapshot?.sessions.find(s => s.id === id);
    return [id, !saved || canonicalJson(value.content) !== canonicalJson(saved.content) ? "Unsaved draft" : saved.approval && saved.approval.sourceVersion === currentSession?.version ? "Approved" : "Saved draft"];
  })), [locals, savedDrafts, snapshot]);
  const timingConflicts = snapshot?.sessions.filter(s => s.conflicts.some(c => c.field === "startTime")).length ?? 0;
  const otherConflicts = snapshot?.sessions.filter(s => s.conflicts.some(c => c.field === "date" || c.field === "location")).length ?? 0;
  const status = stale ? "Source changed" : dirty ? stored ? "Unsaved changes" : "Unsaved sample" : approvalCurrent ? "Approved" : "Saved · needs review";
  function moveTab(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || busy) return;
    event.preventDefault();
    const tabs: Tab[] = ["draft", "source", "review"];
    const next = event.key === "Home" ? "draft" : event.key === "End" ? "review" : tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % tabs.length];
    setTab(next); document.getElementById(`tab-${next}`)?.focus();
  }

  return <main className="dispatch-app">
    <header className="app-header"><div className="brand">Arts &amp; Ideas Dispatch</div><p>November 11–13, 2026 · New Orleans</p><button type="button" className="button secondary refresh-button" disabled={!!busy || loading || !serverReady} onClick={refresh}><RefreshCw size={16} className={busy === "refresh" ? "spinning" : ""} aria-hidden="true"/>{busy === "refresh" ? "Refreshing…" : "Refresh program"}</button></header>
    {loading && !snapshot ? <div className="initial-loading" role="status"><h1>Opening the program</h1><p>Loading the official source snapshot and your saved drafts…</p></div> : snapshot ? <div className="workspace-shell">
      <ProgramRail sessions={snapshot.sessions} activeId={activeId} search={search} day={day} theme={theme} onSearch={setSearch} onDay={setDay} onTheme={setTheme} onSelect={chooseSession} draftStatuses={statuses} disabled={!!busy}/>
      <article className="editor-workspace">
        {error && <div className="message error-message" role="alert"><AlertTriangle size={19}/><div>{error}{!serverReady && <button className="text-button" type="button" onClick={() => void loadWorkspace()} disabled={loading}>{loading ? "Connecting…" : "Retry connection"}</button>}</div></div>}
        {notice && <div className="message notice-message" role="status"><CheckCircle2 size={18}/><span>{notice}</span></div>}
        {session && draft ? <>
          <header className="session-heading"><h1>{session.title}</h1><p>{session.speaker ?? "Festival event"} · {fullDate(session.date)}{session.format ? ` · ${session.format}` : ""}</p></header>
          <div className="editor-tabs" role="tablist" aria-label="Promotion workspace" onKeyDown={moveTab}><button id="tab-draft" type="button" role="tab" aria-selected={tab === "draft"} aria-controls="panel-draft" disabled={!!busy} tabIndex={tab === "draft" ? 0 : -1} onClick={() => setTab("draft")}>Draft</button><button id="tab-source" type="button" role="tab" aria-selected={tab === "source"} aria-controls="panel-source" disabled={!!busy} tabIndex={tab === "source" ? 0 : -1} onClick={() => setTab("source")}>Source details{session.conflicts.length ? <span className="tab-count">{session.conflicts.length}</span> : null}</button><button id="tab-review" type="button" role="tab" aria-selected={tab === "review"} aria-controls="panel-review" disabled={!!busy} tabIndex={tab === "review" ? 0 : -1} onClick={() => setTab("review")}>Review{issues.length ? <span className="tab-count">{issues.length}</span> : null}</button><span className={`draft-status ${approvalCurrent ? "approved" : ""}`}>{status}</span></div>
          {stale && <div className="stale-warning"><strong>This draft was written against an older source.</strong><p>Review the current source before reusing its opening, profile links, or selected facts.</p><button type="button" className="button secondary small" disabled={!!busy} onClick={reviewUpdatedSource}>Review against updated source</button></div>}
          <fieldset className="editor-fields" disabled={!!busy}>
          {tab === "draft" && <div id="panel-draft" role="tabpanel" aria-labelledby="tab-draft"><DraftEditor draft={draft} session={session} providerConfigured={providerConfigured} generationBusy={busy === "generate"} onChange={changeDraft} onGenerate={generate}/></div>}
          {tab === "source" && <div id="panel-source" role="tabpanel" aria-labelledby="tab-source"><SourceDetails key={`${session.id}-${session.version}`} session={session} snapshot={snapshot} draft={draft} onChange={changeDraft}/></div>}
          {tab === "review" && <div id="panel-review" role="tabpanel" aria-labelledby="tab-review"><ReviewPanel key={`${draft.id}-${draft.platform}`} draft={draft} session={session} stored={stored} issues={issues} dirty={dirty} onChange={changeDraft}/></div>}
          </fieldset>
          <div className="action-bar"><div className="action-buttons"><button className="button primary" type="button" disabled={!!busy || !serverReady || !stored || dirty || issues.length > 0 || approvalCurrent} onClick={approve}>{busy === "approve" ? "Approving…" : approvalCurrent ? "Approved" : "Approve draft"}</button><button className="button secondary" type="button" disabled={!!busy || !serverReady || !dirty || stale} onClick={save}>{busy === "save" ? "Saving…" : "Save draft"}</button><button className="button export-button" type="button" disabled={!!busy || !serverReady || !approvalCurrent} onClick={exportDraft}><Download size={17}/>{busy === "export" ? "Preparing…" : "Export package"}</button></div><p>{dirty ? "Save this revision, then review and approve it." : approvalCurrent ? `Approved by ${stored?.approval?.reviewedBy ?? "reviewer"}. Any edit requires new approval.` : issues.length ? "Resolve the review items before approval." : "Export is available after approval."}</p></div>
          {exported && <section className="export-downloads"><h2 className="section-title">Approved export</h2><p>Recorded {capturedAt(exported.at)}. Download each file for this revision.</p><div>{[{ label: "Post copy", suffix: "copy.txt", value: exported.package.copy, type: "text/plain;charset=utf-8" }, { label: "Graphic SVG", suffix: "graphic.svg", value: exported.package.graphic.svg, type: exported.package.graphic.mimeType }, { label: "Alt text", suffix: "alt.txt", value: exported.package.altText, type: "text/plain;charset=utf-8" }, { label: "Source & review", suffix: "review.json", value: JSON.stringify(exported.package, null, 2), type: "application/json" }].map(file => <button key={file.suffix} type="button" className="button secondary small" onClick={() => downloadFile(`${exported.package.sessionId}-${exported.package.platform}-${file.suffix}`, file.value, file.type)}><Download size={15}/>{file.label}</button>)}</div></section>}
        </> : <div className="empty-editor"><h1>Choose a session</h1><p>Select a program entry to draft a promotion.</p></div>}
        <footer className="program-health"><AlertTriangle size={22}/><div><strong>{timingConflicts} timing conflicts in the program</strong><p>{otherConflicts ? `${otherConflicts} session also has date or venue differences. ` : ""}Review source details before including a session’s time.</p><span>{snapshot.mode === "seed" ? "Captured official program" : "Refreshed official program"} · {capturedAt(snapshot.fetchedAt)}</span></div></footer>
      </article>
    </div> : <div className="initial-loading" role="alert"><h1>The program could not be loaded</h1><button className="button secondary" onClick={() => void loadWorkspace()}>Try again</button></div>}
  </main>;
}
