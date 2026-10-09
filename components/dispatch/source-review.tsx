"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Check, X } from "lucide-react";
import { profileCandidates } from "@/lib/domain/seed";
import { normalizeDate, normalizeTime, validateProfileSyntax, type Draft, type FactualField, type Session, type SourceSnapshot, type ValidationIssue } from "@/lib/domain/domain";
import type { StoredDraft } from "@/lib/server/types";
import { capturedAt, fullDate } from "./helpers";

const labels: Record<FactualField, string> = { date: "Date", startTime: "Start time", location: "Venue" };
export function SourceDetails({ session, snapshot, draft, onChange }: { session: Session; snapshot: SourceSnapshot; draft: Draft; onChange(updates: Partial<Draft>): void }) {
  return <section className="source-details">
    <div className="source-summary"><h2 className="section-title">Editorial summary</h2><p>{session.topicSummary || "This entry has no short editorial summary. Read the official program before drafting a description."}</p><p className="field-help">Handwritten research summary. Review it against the current published description.</p><a href={session.presentationUrl ?? "https://fest.philosophers.group/"} target="_blank" rel="noopener noreferrer">Read official program <ExternalLink size={15}/></a></div>
    <div className="published-description"><h2 className="section-title">Published description</h2>{session.sourceAbstract ? <p>{session.sourceAbstract}</p> : <p>The captured source has no published description for this entry. Open the official program before adding claims about its content.</p>}</div>
    <dl className="source-facts"><div><dt>Title</dt><dd>{session.title}</dd></div><div><dt>Speaker</dt><dd>{session.speaker ?? "No named speaker"}</dd></div><div><dt>Schedule date</dt><dd>{fullDate(session.date)}, 2026</dd></div><div><dt>Schedule time</dt><dd>{session.timeDisplay}</dd></div><div><dt>Schedule venue</dt><dd>{session.location || "Not supplied"}</dd></div><div><dt>Format</dt><dd>{session.format ?? "Not supplied"}</dd></div></dl>
    {session.conflicts.length > 0 && <div className="conflict-section"><h2 className="section-title"><AlertTriangle size={20}/> Conflicting published facts</h2><p>Omit a disputed field, or record an organizer confirmation before using it.</p>{session.conflicts.map(conflict => <ConflictResolver key={conflict.field} conflict={conflict} session={session} draft={draft} onChange={onChange}/>)}</div>}
    <div className="source-provenance"><h2 className="section-title">Source record</h2><p>{snapshot.mode === "seed" ? "Captured official feed · initial snapshot" : "Refreshed official feed"} · {capturedAt(snapshot.fetchedAt)}</p><p>Local time: America/Chicago, inferred from the New Orleans venue. Confirm before timed scheduling.</p><a href={snapshot.feedUrl} target="_blank" rel="noopener noreferrer">Official source feed <ExternalLink size={15}/></a><p className="hash-note">Session version <code>{session.version.slice(0, 16)}</code></p></div>
  </section>;
}
function ConflictResolver({ conflict, session, draft, onChange }: { conflict: Session["conflicts"][number]; session: Session; draft: Draft; onChange(updates: Partial<Draft>): void }) {
  const existing = draft.resolutions.find(r => r.field === conflict.field && r.sourceVersion === session.version);
  const [value, setValue] = useState(existing?.value ?? conflict.scheduleValue);
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const normalized = conflict.field === "date" ? normalizeDate(value) : conflict.field === "startTime" ? normalizeTime(value) : value.trim();
  const included = conflict.field === "date" ? draft.includeDate : conflict.field === "startTime" ? draft.includeTime : draft.includeLocation;
  function resolve() {
    if (!normalized || !confirmed || !reason.trim()) return;
    const resolution = { field: conflict.field, value: normalized, sourceVersion: session.version, confirmedBy: "Pending authenticated review", confirmedAt: new Date().toISOString(), reason: reason.trim() };
    onChange({ resolutions: [...draft.resolutions.filter(r => r.field !== conflict.field), resolution], ...(conflict.field === "date" ? { includeDate: true } : conflict.field === "startTime" ? { includeTime: true, includeDate: true } : { includeLocation: true }) });
  }
  return <div className="conflict-record"><div className="conflict-title"><h3>{labels[conflict.field]}</h3><span>{existing ? "Confirmation recorded" : included ? "Needs confirmation" : "Omitted"}</span></div><dl><div><dt>Schedule says</dt><dd>{conflict.scheduleValue}</dd></div><div><dt>Session metadata says</dt><dd>{conflict.presentationValue}</dd></div></dl>
    {existing ? <div className="resolution-saved"><p><Check size={16}/> Confirmed value: <strong>{existing.value}</strong></p><p>{existing.reason}</p><button type="button" className="text-button" onClick={() => onChange({ resolutions: draft.resolutions.filter(r => r.field !== conflict.field), ...(conflict.field === "date" ? { includeDate: false, includeTime: false } : conflict.field === "startTime" ? { includeTime: false } : { includeLocation: false }) })}>Remove confirmation and omit field</button></div> : <details><summary>Record organizer confirmation</summary><label>Confirmed value<input value={value} onChange={e => { setValue(e.target.value); setConfirmed(false); }}/></label>{value && !normalized && <p className="inline-error">{conflict.field === "date" ? "Use a valid date such as 2026-11-12 or 11/12/2026." : "Use a valid start time such as 17:30 or 5:30 PM."}</p>}<label>Evidence or confirmation note<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Who confirmed it, and where can the organizer check?" /></label><label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I confirmed this value with a festival organizer.</label><button type="button" className="button secondary small" disabled={!confirmed || !reason.trim() || !normalized} onClick={resolve}>Use confirmed value</button></details>}
  </div>;
}

export function ReviewPanel({ draft, session, stored, issues, dirty, onChange }: { draft: Draft; session: Session; stored: StoredDraft | null; issues: ValidationIssue[]; dirty: boolean; onChange(updates: Partial<Draft>): void }) {
  return <section className="review-panel"><h2 className="section-title">Review this promotion</h2><p>Check the opening, complete copy, graphic, and alt text. Approval applies to this saved revision and its source.</p>
    <div className="review-status"><strong>{issues.length ? `${issues.length} item${issues.length === 1 ? "" : "s"} need attention` : "Ready for your review"}</strong>{issues.length ? <ul>{issues.map((issue, i) => <li key={`${issue.code}-${i}`}>{issue.message}</li>)}</ul> : <p>Source checks pass. Review the creative claims against the official description.</p>}{dirty && <p>Save your edits before approval.</p>}</div>
    {stored?.approval && <div className="approval-record"><h3>Previous approval</h3><p>{stored.approval.reviewedBy} · {capturedAt(stored.approval.reviewedAt)}</p><p>Revision {stored.revision}{dirty || draft.sourceVersion !== session.version ? " · no longer current for these edits" : ""}</p></div>}
    <ProfileReview draft={draft} session={session} onChange={onChange}/>
    <div className="review-note"><h3>Export package</h3><p>Approved copy, graphic, alt text, and a source and review record. Profile URLs are explicit links; platform tagging and social publishing are separate steps.</p></div>
  </section>;
}
function ProfileReview({ draft, session, onChange }: { draft: Draft; session: Session; onChange(updates: Partial<Draft>): void }) {
  const [url, setUrl] = useState(""); const [identityKind, setIdentityKind] = useState<"person" | "organization">("person"); const [confirmed, setConfirmed] = useState(false);
  const syntax = url ? validateProfileSyntax(draft.platform, url) : null;
  const candidates = profileCandidates.filter(p => p.platform === draft.platform);
  function addProfile() {
    if (!syntax?.valid || !confirmed) return;
    onChange({ profiles: [...draft.profiles.filter(p => p.url !== syntax.canonicalUrl), { sessionId: session.id, platform: draft.platform, url: syntax.canonicalUrl, handle: syntax.handle, identityKind, nativeId: null, reviewedBy: "Pending authenticated review", reviewedAt: new Date().toISOString() }] });
    setUrl(""); setConfirmed(false);
  }
  return <div className="profile-review"><h3>Speaker profile links</h3><p>Optional. Submission links are candidates, and may represent a person or an organization. Confirm the identity and its connection to this session.</p>
    {draft.profiles.map(profile => <div key={profile.url} className="reviewed-profile"><a href={profile.url} target="_blank" rel="noopener noreferrer">{profile.url}</a><span>{profile.identityKind === "person" ? "Person" : "Organization"}</span><button type="button" aria-label={`Remove profile ${profile.handle}`} onClick={() => onChange({ profiles: draft.profiles.filter(p => p.url !== profile.url) })}><X size={17}/></button></div>)}
    <details><summary>Review and add a profile link</summary>{candidates.length > 0 && <label>Unverified submission candidates<select value="" onChange={e => { setUrl(e.target.value); setConfirmed(false); }}><option value="">Choose a candidate to inspect…</option>{candidates.map((p, i) => <option key={`${p.url}-${i}`} value={p.url}>{p.speaker} · {p.url}</option>)}</select></label>}
      <label>{draft.platform === "x" ? "X" : draft.platform[0].toUpperCase() + draft.platform.slice(1)} profile URL<input type="url" value={url} onChange={e => { setUrl(e.target.value); setConfirmed(false); }} placeholder="https://…"/></label>
      {syntax && !syntax.valid && <p className="inline-error">{syntax.reason}</p>}
      <label>Identity<select value={identityKind} onChange={e => { setIdentityKind(e.target.value as "person" | "organization"); setConfirmed(false); }}><option value="person">Person</option><option value="organization">Organization</option></select></label>
      <label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I inspected this profile and confirmed its connection to {session.speaker ?? "this session"}.</label>
      <button className="button secondary small" type="button" disabled={!confirmed || !syntax?.valid} onClick={addProfile}>Add reviewed link</button>
    </details>
  </div>;
}
