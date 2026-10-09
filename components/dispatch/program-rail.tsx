"use client";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Session } from "@/lib/domain/domain";
import { shortDate } from "./helpers";

interface Props {
  sessions: Session[]; activeId: string | null; search: string; day: string; theme: string;
  onSearch(value: string): void; onDay(value: string): void; onTheme(value: string): void; onSelect(session: Session): void;
  draftStatuses: Record<string, string>; disabled: boolean;
}
export default function ProgramRail({ sessions, activeId, search, day, theme, onSearch, onDay, onTheme, onSelect, draftStatuses, disabled }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const list = listRef.current; const selected = selectedRef.current;
    if (!list || !selected) return;
    const offset = selected.offsetTop;
    if (offset < list.scrollTop || offset + selected.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = Math.max(0, offset - 15);
  }, [activeId, search, day, theme]);
  const themes = [...new Set(sessions.map(s => s.tag).filter((v): v is string => !!v))].sort();
  const filtered = sessions.filter(s => (!day || s.date === day) && (!theme || s.tag === theme) && `${s.title} ${s.speaker ?? ""} ${s.topicSummary}`.toLowerCase().includes(search.toLowerCase().trim()));
  const days = [{ date: "", label: "All" }, { date: "2026-11-11", label: "Wed 11" }, { date: "2026-11-12", label: "Thu 12" }, { date: "2026-11-13", label: "Fri 13" }];
  return <aside className="program-rail" aria-label="Festival program">
    <div className="rail-controls">
      <h2>Program</h2>
      <p className="session-count">{sessions.length} sessions</p>
      <label className="search-field"><Search size={21} strokeWidth={1.7} aria-hidden="true"/><span className="sr-only">Find a talk or speaker</span><input value={search} onChange={e => onSearch(e.target.value)} placeholder="Find a talk or speaker" /></label>
      <div className="day-filters" aria-label="Filter program day">{days.map(d => <button key={d.label} type="button" className={day === d.date ? "selected" : ""} aria-pressed={day === d.date} onClick={() => onDay(d.date)}>{d.label}</button>)}</div>
      {themes.length > 0 && <label className="theme-filter"><span className="sr-only">Filter program theme</span><select value={theme} onChange={e => onTheme(e.target.value)}><option value="">All themes</option>{themes.map(t => <option key={t}>{t}</option>)}</select></label>}
      {filtered.length !== sessions.length && <p className="filter-result" aria-live="polite">{filtered.length} matching sessions <button type="button" onClick={() => { onSearch(""); onDay(""); onTheme(""); }}>Clear</button></p>}
    </div>
    <div className="program-list" ref={listRef}>
      {filtered.map(s => <button key={s.id} type="button" ref={s.id === activeId ? selectedRef : null} className={`program-row ${s.id === activeId ? "active" : ""}`} aria-pressed={s.id === activeId} disabled={disabled} onClick={() => onSelect(s)}>
        <strong>{s.title}</strong><span>{s.speaker ?? "Festival event"}</span><span className="program-meta">{shortDate(s.date)}{s.format ? ` · ${s.format}` : ""}</span>
        {draftStatuses[s.id] && <span className="row-draft-status">{draftStatuses[s.id]}</span>}
      </button>)}
      {!filtered.length && <p className="empty-program">No sessions match these filters. Try a title, speaker, or another day.</p>}
    </div>
  </aside>;
}
