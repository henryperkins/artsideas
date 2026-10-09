"use client";

import { AlertCircle, Sparkles } from "lucide-react";
import { copyLength, PLATFORM_LIMITS, posterData, renderCopy, type Draft, type EditorialAngle, type Platform, type Session } from "@/lib/domain/domain";
import { posterSvg } from "./poster-svg";

interface Props {
  draft: Draft; session: Session; providerConfigured: boolean; generationBusy: boolean;
  onChange(updates: Partial<Draft>): void; onGenerate(): void;
}
export default function DraftEditor({ draft, session, providerConfigured, generationBusy, onChange, onGenerate }: Props) {
  const copy = renderCopy(draft, session); const length = copyLength(copy, draft.platform);
  const poster = posterData(draft, session);
  return <div className="draft-grid">
    <section className="copy-editor" aria-label="Post copy editor">
      <h2 className="section-title">Post copy</h2>
      <div className="platform-controls" aria-label="Draft platform">{(["linkedin", "instagram", "facebook", "x"] as Platform[]).map(p => <button type="button" key={p} aria-pressed={draft.platform === p} className={draft.platform === p ? "selected" : ""} onClick={() => onChange({ platform: p, profiles: [] })}>{p === "x" ? "X" : p[0].toUpperCase() + p.slice(1)}</button>)}</div>
      <label className="angle-control"><span>Angle</span><select value={draft.angle} onChange={e => onChange({ angle: e.target.value as EditorialAngle })}><option value="question">Curious question</option><option value="hands-on">Hands-on invitation</option><option value="practical">Practical takeaway</option></select></label>
      <label className="sr-only" htmlFor="editorial-copy">Editable opening and summary</label>
      <textarea id="editorial-copy" className="copy-input" value={draft.editorialText} onChange={e => onChange({ editorialText: e.target.value })} placeholder="Write an opening and short summary…" spellCheck />
      <div className="generation-line"><span>{draft.generationMode === "claude" ? "Claude draft · review before approval" : "Hand-authored sample / edited copy"}{!providerConfigured ? " · Claude not connected" : ""}</span><button className="generate-button" type="button" disabled={!providerConfigured || generationBusy || draft.sourceVersion !== session.version} onClick={onGenerate}><Sparkles size={14} aria-hidden="true"/>{generationBusy ? "Drafting…" : "Draft with Claude"}</button></div>
      <label className="field-label" htmlFor="graphic-alt">Alt text <span className="quiet-label">Visual description</span></label>
      <textarea id="graphic-alt" className="alt-input" value={draft.altText} onChange={e => onChange({ altText: e.target.value })} placeholder="Describe the graphic’s visual treatment…" />
      <p className="field-help">The graphic’s title, speaker, and selected facts are added to the exported alt text.</p>
      <div className="fact-toggles">
        <label className="toggle-label"><input type="checkbox" checked={draft.includeDate} onChange={e => onChange({ includeDate: e.target.checked, ...(!e.target.checked ? { includeTime: false } : {}) })}/><span className="toggle-track" aria-hidden="true"/><span>Include date</span></label>
        <label className="toggle-label"><input type="checkbox" checked={draft.includeTime} onChange={e => onChange({ includeTime: e.target.checked, ...(e.target.checked ? { includeDate: true } : {}) })}/><span className="toggle-track" aria-hidden="true"/><span>Include time</span></label>
        <label className="toggle-label"><input type="checkbox" checked={draft.includeLocation} onChange={e => onChange({ includeLocation: e.target.checked })}/><span className="toggle-track" aria-hidden="true"/><span>Include venue</span></label>
      </div>
      <p className="profile-notice"><AlertCircle size={18} aria-hidden="true"/>{draft.profiles.length ? `${draft.profiles.length} profile link${draft.profiles.length === 1 ? "" : "s"} reviewed for this session.` : "Speaker profile links are unverified."}</p>
      <details className="complete-copy"><summary>Complete post copy <span className={length > PLATFORM_LIMITS[draft.platform] ? "over-limit" : ""}>{length.toLocaleString()} / {PLATFORM_LIMITS[draft.platform].toLocaleString()}</span></summary><pre>{copy}</pre><p className="field-help">Source facts and program links are appended automatically. X uses a 23-character URL allowance.</p></details>
    </section>
    <section className="graphic-column" aria-label="Graphic preview">
      <div className="graphic-heading"><h2 className="section-title">Graphic preview</h2><span>{draft.platform === "instagram" ? "4:5" : "1:1"}</span></div>
      {/* Exact generated SVG must also match the exported artwork; image optimization would change this data URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="poster-preview" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(posterSvg(poster))}`} alt={poster.altText} width={poster.width} height={poster.height}/>
      <label className="template-select"><span className="sr-only">Graphic color</span><select value={draft.posterTemplate} onChange={e => onChange({ posterTemplate: e.target.value as Draft["posterTemplate"] })}><option value="blue">Text-only layout · Cobalt</option><option value="yellow">Text-only layout · Yellow</option><option value="teal">Text-only layout · Teal</option><option value="red">Text-only layout · Red</option></select></label>
    </section>
  </div>;
}
