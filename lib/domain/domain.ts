/** Portable domain code. Uses Web Crypto; works in browsers, Workers, and Node 24. */
export type Platform = 'linkedin' | 'instagram' | 'facebook' | 'x';
export type EditorialAngle = 'question' | 'hands-on' | 'practical';
export type FactualField = 'date' | 'startTime' | 'location';
export type PosterTemplate = 'blue' | 'yellow' | 'teal' | 'red';
export interface Evidence { url: string; fieldPath: string; status: 'published' | 'derived-route' }
export interface SourceConflict { field: FactualField; scheduleValue: string; presentationValue: string }
export interface PresenterMetadata { name: string | null; photoUrl: string | null }
export interface Session {
  id: string; inventoryId?: string; title: string; speaker: string | null;
  date: string; day: string; startTime: string; timeDisplay: string; rawTimeRange: string;
  location: string; format: string | null; tag: string | null; presentationId: number | null;
  presentationUrl: string | null; topicSummary: string; summaryKind: 'editorial-paraphrase' | 'not-available';
  sourceAbstract: string | null; summaryProvenance: { kind: 'editorial-paraphrase' | 'published-abstract' | 'not-available'; sourceUrl: string };
  presenter: PresenterMetadata; conflicts: SourceConflict[]; publicDataEvidence: Evidence[];
  version: string;
}
export interface SourceSnapshot {
  schemaVersion: 1; fetchedAt: string; feedUrl: string; feedHash: string; version: string;
  sourceUrl: string; mode: 'live' | 'seed';
  timezone: { value: 'America/Chicago'; status: 'inferred-from-venue' }; sessions: Session[];
}
export interface RawSchedule {
  year: string | number; date: string; day: string; time: string; sort_time?: string;
  raw_time_range?: string; title: string; presenters?: string; location?: string;
  type?: string; tag?: string; presentation_id?: number | null; inventoryId?: string;
}
export interface RawPresentation {
  id: number; slug?: string; title?: { rendered?: string };
  content?: { rendered?: string; protected?: boolean };
  scraped_fields?: { date?: string | null; time?: string | null; location?: string | null; presenter_name?: string | null; presenter_photo_url?: string | null };
}
export interface OfficialFeed { schedule: RawSchedule[]; presentations?: RawPresentation[] }
export interface ProfileCandidate {
  speaker: string; submissionTitle: string; platform: Platform; url: string; sourceUrl: string;
  identityStatus: 'unverified'; sessionId: null;
}
export interface ReviewedProfile {
  sessionId: string; platform: Platform; url: string; handle: string; identityKind: 'person' | 'organization';
  nativeId: string | null; reviewedBy: string; reviewedAt: string;
}
export interface FactResolution {
  field: FactualField; value: string; sourceVersion: string; confirmedBy: string; confirmedAt: string; reason: string;
}
export interface Draft {
  id: string; sessionId: string; sourceVersion: string; platform: Platform; angle: EditorialAngle;
  editorialText: string; altText: string; generationMode: 'hand-authored-sample' | 'claude';
  includeDate: boolean; includeTime: boolean; includeLocation: boolean;
  posterTemplate: PosterTemplate; photoUrl: string | null; destination: string | null;
  profiles: ReviewedProfile[]; resolutions: FactResolution[];
}
export interface Approval {
  draftId: string; draftVersion: string; sessionId: string; sourceVersion: string;
  platform: Platform; reviewedBy: string; reviewedAt: string; omittedDisputedFields: FactualField[];
}
export interface ValidationIssue { code: string; message: string; field?: string }
export interface PosterData {
  width: number; height: number; template: PosterTemplate; paper: '#f3eddc'; ink: '#1a1a1a'; accent: string;
  festival: string; title: string; speaker: string | null; details: string[]; photoUrl: string | null; altText: string;
}
export interface ExportPackage {
  schemaVersion: 1; sessionId: string; sourceVersion: string; draftVersion: string; platform: Platform;
  copy: string; altText: string; sourceUrl: string; evidence: Evidence[]; poster: PosterData;
  review: Approval; createdAt: string; generationMode: Draft['generationMode']; destination: string | null;
}

export const PROGRAM_URL = 'https://fest.philosophers.group/';
export const DATA_URL = `${PROGRAM_URL}content.json`;
export const FESTIVAL_NAME = 'New Orleans Arts & Ideas Festival';
export const PLATFORM_LIMITS: Record<Platform, number> = { linkedin: 3000, instagram: 2200, facebook: 63206, x: 280 };

/** Stable serialization excludes object key order; array ordering remains meaningful. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}
export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function canonicalHash(value: unknown): Promise<string> { return sha256(canonicalJson(value)); }
export function sessionVersion(session: Omit<Session, 'version'> | Session): Promise<string> {
  const { version: _version, ...facts } = session as Session;
  void _version;
  return canonicalHash(facts);
}
export function draftVersion(draft: Draft): Promise<string> { return canonicalHash(draft); }

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };
export function plainText(value: string): string {
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity.startsWith('#')) {
      const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    }
    return entities[entity.toLowerCase()] ?? whole;
  }).replace(/\s+/g, ' ').trim();
}
export function normalizeDate(value: string): string | null {
  const iso = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value.trim());
  const us = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/.exec(value.trim());
  const normalized = iso ? value.trim() : us ? `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}` : null;
  if (!normalized) return null;
  const d = new Date(`${normalized}T12:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === normalized ? normalized : null;
}
export function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(value.trim());
  if (!match) return null;
  let h = Number(match[1]); const m = Number(match[2]);
  if (m > 59 || (match[3] ? h < 1 || h > 12 : h > 23)) return null;
  if (match[3]) h = h % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function displayTime(value: string): string {
  const normalized = normalizeTime(value); if (!normalized) return value;
  const [h, m] = normalized.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
function sourcePhoto(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const u = new URL(value, PROGRAM_URL); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
}

export async function normalizeOfficialFeed(feed: OfficialFeed, options: {
  fetchedAt: string; feedUrl?: string; year?: number; rawFeedHash?: string;
  mode?: 'live' | 'seed';
  topicSummaries?: Record<string, string>;
}): Promise<SourceSnapshot> {
  if (!Array.isArray(feed.schedule)) throw new Error('Official feed has no schedule array.');
  const year = options.year ?? 2026; const feedUrl = options.feedUrl ?? DATA_URL;
  const presentations = new Map((feed.presentations ?? []).map(p => [p.id, p]));
  const sessions = await Promise.all(feed.schedule.filter(row => String(row.year) === String(year)).map(async (row, index): Promise<Session> => {
    const date = normalizeDate(row.date); const startTime = normalizeTime(row.sort_time ?? row.time);
    if (!date || !startTime || !plainText(row.title)) throw new Error(`Invalid schedule facts in row ${index}.`);
    const p = row.presentation_id ? presentations.get(row.presentation_id) : undefined;
    const fields = p?.scraped_fields; const conflicts: SourceConflict[] = [];
    if (fields?.date && normalizeDate(fields.date) !== date) conflicts.push({ field: 'date', scheduleValue: row.date, presentationValue: fields.date });
    if (fields?.time && normalizeTime(fields.time) !== startTime) conflicts.push({ field: 'startTime', scheduleValue: row.time, presentationValue: fields.time });
    if (fields?.location && plainText(fields.location).toLowerCase() !== plainText(row.location ?? '').toLowerCase()) conflicts.push({ field: 'location', scheduleValue: row.location ?? '', presentationValue: fields.location });
    const id = p ? `noai-${year}-p${p.id}` : `noai-${year}-event-${plainText(row.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const presentationUrl = p?.slug ? `${PROGRAM_URL}p/${encodeURIComponent(p.slug)}/` : null;
    const topicSummary = options.topicSummaries?.[id] ?? options.topicSummaries?.[String(p?.id)] ?? '';
    const sourceAbstract = p?.content?.protected ? null : plainText(p?.content?.rendered ?? '').slice(0, 20_000) || null;
    const facts: Omit<Session, 'version'> = {
      id, ...(row.inventoryId ? { inventoryId: row.inventoryId } : {}), title: plainText(row.title), speaker: plainText(row.presenters ?? '') || null,
      date, day: plainText(row.day), startTime, timeDisplay: displayTime(startTime), rawTimeRange: row.raw_time_range ?? '',
      location: plainText(row.location ?? ''), format: plainText(row.type ?? '') || null, tag: plainText(row.tag ?? '') || null,
      presentationId: p?.id ?? null, presentationUrl, topicSummary, summaryKind: topicSummary ? 'editorial-paraphrase' : 'not-available',
      sourceAbstract, summaryProvenance: { kind: sourceAbstract ? 'published-abstract' : topicSummary ? 'editorial-paraphrase' : 'not-available', sourceUrl: presentationUrl ?? feedUrl },
      presenter: { name: plainText(fields?.presenter_name ?? '') || null, photoUrl: sourcePhoto(fields?.presenter_photo_url) }, conflicts,
      publicDataEvidence: [ { url: feedUrl, fieldPath: `schedule[${feed.schedule.indexOf(row)}]`, status: 'published' }, ...(presentationUrl ? [{ url: presentationUrl, fieldPath: `presentations[id=${p!.id}]`, status: 'derived-route' as const }] : []) ],
    };
    return { ...facts, version: await sessionVersion(facts) };
  }));
  if (new Set(sessions.map(s => s.id)).size !== sessions.length) throw new Error('Schedule identities are ambiguous: repeated presentation or event IDs.');
  const version = await canonicalHash(sessions.map(s => ({ id: s.id, version: s.version })).sort((a, b) => a.id.localeCompare(b.id)));
  return { schemaVersion: 1, fetchedAt: options.fetchedAt, feedUrl, sourceUrl: feedUrl, mode: options.mode ?? 'live', feedHash: options.rawFeedHash ?? await canonicalHash(feed), version, timezone: { value: 'America/Chicago', status: 'inferred-from-venue' }, sessions };
}

export type ProfileSyntax = { valid: true; canonicalUrl: string; handle: string; identityKind: 'person' | 'organization' | 'unknown' } | { valid: false; reason: string };
export function validateProfileSyntax(platform: Platform, input: string): ProfileSyntax {
  let u: URL; try { u = new URL(input); } catch { return { valid: false, reason: 'Use an absolute HTTPS profile URL.' }; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return { valid: false, reason: 'Profile URLs require HTTPS without credentials or a custom port.' };
  const host = u.hostname.toLowerCase().replace(/^www\./, ''); const segments = u.pathname.split('/').filter(Boolean);
  const reject = (reason: string): ProfileSyntax => ({ valid: false, reason });
  if (platform === 'linkedin') {
    if (host !== 'linkedin.com' || segments.length !== 2 || !['in', 'company'].includes(segments[0]) || !/^[a-z0-9_-]+$/i.test(segments[1])) return reject('LinkedIn needs an /in/ personal profile or /company/ organization profile; /feed/ is not a profile.');
    return { valid: true, canonicalUrl: `https://www.linkedin.com/${segments[0]}/${segments[1]}/`, handle: segments[1], identityKind: segments[0] === 'in' ? 'person' : 'organization' };
  }
  if (platform === 'facebook' && host === 'facebook.com' && u.pathname === '/profile.php' && /^\d+$/.test(u.searchParams.get('id') ?? '')) return { valid: true, canonicalUrl: `https://www.facebook.com/profile.php?id=${u.searchParams.get('id')}`, handle: u.searchParams.get('id')!, identityKind: 'unknown' };
  const hosts: Record<Exclude<Platform, 'linkedin'>, string[]> = { x: ['x.com', 'twitter.com'], instagram: ['instagram.com'], facebook: ['facebook.com'] };
  if (!hosts[platform].includes(host)) return reject(`The URL host is not a ${platform} profile host.`);
  const reserved: Record<Exclude<Platform, 'linkedin'>, string[]> = { x: ['home', 'search', 'explore', 'intent', 'i', 'messages', 'settings', 'login', 'signup'], instagram: ['p', 'reel', 'reels', 'explore', 'accounts', 'direct', 'stories'], facebook: ['groups', 'events', 'watch', 'marketplace', 'share', 'login', 'home.php', 'profile.php', 'pages', 'photo', 'photos', 'reel', 'reels'] };
  if (segments.length !== 1 || reserved[platform].includes((segments[0] ?? '').toLowerCase())) return reject('Use a profile link, rather than a feed, post, login page, or other route.');
  const regex = platform === 'x' ? /^[a-z0-9_]{1,15}$/i : platform === 'instagram' ? /^[a-z0-9._]{1,30}$/i : /^[a-z0-9.]{1,50}$/i;
  if (!regex.test(segments[0])) return reject('The profile handle has invalid characters or length.');
  const canonicalHost = platform === 'x' ? 'x.com' : `www.${platform}.com`;
  return { valid: true, canonicalUrl: `https://${canonicalHost}/${segments[0]}`, handle: segments[0], identityKind: 'unknown' };
}

export function createDraft(session: Session, input: Pick<Draft, 'id' | 'platform' | 'angle' | 'editorialText' | 'altText'> & Partial<Omit<Draft, 'sessionId' | 'sourceVersion'>>): Draft {
  return { id: input.id, sessionId: session.id, sourceVersion: session.version, platform: input.platform, angle: input.angle,
    editorialText: input.editorialText, altText: input.altText, generationMode: input.generationMode ?? 'hand-authored-sample',
    includeDate: input.includeDate ?? false, includeTime: input.includeTime ?? false, includeLocation: input.includeLocation ?? false,
    posterTemplate: input.posterTemplate ?? 'blue', photoUrl: input.photoUrl ?? null, destination: input.destination ?? null,
    profiles: input.profiles ?? [], resolutions: input.resolutions ?? [] };
}
export function updateDraft(draft: Draft, updates: Partial<Omit<Draft, 'id' | 'sessionId' | 'sourceVersion'>>): Draft { return { ...draft, ...updates }; }
export function rebaseDraft(draft: Draft, session: Session): Draft {
  if (draft.sessionId !== session.id) throw new Error('Cannot rebase onto a different session.');
  return { ...draft, sourceVersion: session.version, resolutions: [] };
}
function fieldIncluded(draft: Draft, field: FactualField): boolean { return field === 'date' ? draft.includeDate : field === 'startTime' ? draft.includeTime : draft.includeLocation; }
function normalizedField(field: FactualField, value: string): string | null { return field === 'date' ? normalizeDate(value) : field === 'startTime' ? normalizeTime(value) : plainText(value) || null; }
function validResolution(resolution: FactResolution, session: Session): boolean {
  return ['date', 'startTime', 'location'].includes(resolution.field)
    && session.conflicts.some(conflict => conflict.field === resolution.field)
    && resolution.sourceVersion === session.version
    && typeof resolution.value === 'string' && normalizedField(resolution.field, resolution.value) !== null
    && typeof resolution.confirmedBy === 'string' && !!resolution.confirmedBy.trim()
    && typeof resolution.reason === 'string' && !!resolution.reason.trim()
    && typeof resolution.confirmedAt === 'string' && !Number.isNaN(Date.parse(resolution.confirmedAt));
}
function effectiveFact(draft: Draft, session: Session, field: FactualField): string {
  const matches = draft.resolutions.filter(r => r.field === field);
  const r = matches.length === 1 && validResolution(matches[0], session) ? matches[0] : null;
  // In-progress invalid decisions cannot break preview or override undisputed published facts.
  return r ? normalizedField(field, r.value)! : session[field];
}
function formattedDate(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)); }
export function renderCopy(draft: Draft, session: Session): string {
  const facts = [session.title, session.speaker, FESTIVAL_NAME, draft.includeDate ? formattedDate(effectiveFact(draft, session, 'date')) : null,
    draft.includeTime ? `${displayTime(effectiveFact(draft, session, 'startTime'))} · New Orleans local time` : null,
    draft.includeLocation ? effectiveFact(draft, session, 'location') : null].filter(Boolean).join('\n');
  // Profile URLs are explicit links. Native mention payloads belong to future publishing adapters.
  const tags = draft.profiles.map(p => p.url).join('\n');
  return [draft.editorialText.trim(), facts, tags, `Explore the program: ${session.presentationUrl ?? PROGRAM_URL}`].filter(Boolean).join('\n\n');
}
/** X reserves 23 characters per URL and conservatively weights wide Unicode characters twice. */
export function copyLength(copy: string, platform: Platform): number {
  const counted = platform === 'x' ? copy.replace(/https?:\/\/[^\s]+/g, 'x'.repeat(23)) : copy;
  if (platform !== 'x') return [...counted].length;
  return [...counted].reduce((count, character) => {
    const cp = character.codePointAt(0)!;
    return count + (cp <= 0x10ff || cp >= 0x2000 && cp <= 0x200d || cp >= 0x2010 && cp <= 0x201f || cp >= 0x2032 && cp <= 0x2037 ? 1 : 2);
  }, 0);
}
function posterDetails(draft: Draft, session: Session): string[] {
  return [draft.includeDate ? formattedDate(effectiveFact(draft, session, 'date')) : '', draft.includeTime ? `${displayTime(effectiveFact(draft, session, 'startTime'))} · New Orleans local time` : '', draft.includeLocation ? effectiveFact(draft, session, 'location') : ''].filter(Boolean);
}
/** Editable visual description plus the exact text shown by the deterministic poster. */
export function renderAltText(draft: Draft, session: Session): string {
  return [draft.altText.trim(), `Poster for ${FESTIVAL_NAME}.`, `Session: ${session.title}.`, session.speaker ? `Speaker: ${session.speaker}.` : '', ...posterDetails(draft, session).map(detail => `${detail}.`)].filter(Boolean).join(' ');
}
export function posterData(draft: Draft, session: Session): PosterData {
  const colors: Record<PosterTemplate, string> = { blue: '#2250d6', yellow: '#f4b714', teal: '#1a9a9a', red: '#e0261e' };
  const details = posterDetails(draft, session);
  return { width: 1080, height: draft.platform === 'instagram' ? 1350 : 1080, template: draft.posterTemplate, paper: '#f3eddc', ink: '#1a1a1a', accent: colors[draft.posterTemplate], festival: FESTIVAL_NAME, title: session.title, speaker: session.speaker, details, photoUrl: draft.photoUrl, altText: renderAltText(draft, session) };
}
export async function validateDraft(draft: Draft, session: Session): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const add = (code: string, message: string, field?: string) => issues.push({ code, message, ...(field ? { field } : {}) });
  if (session.id !== draft.sessionId) add('session-mismatch', 'The draft belongs to a different session.');
  if (session.version !== await sessionVersion(session)) add('source-integrity', 'The source changed without a new version. Refresh the source.');
  if (session.version !== draft.sourceVersion) add('stale-source', 'The published session has changed. Review this draft against the current source.');
  if (!draft.id.trim() || !draft.editorialText.trim()) add('empty-draft', 'Write an opening or summary before approval.');
  if (!draft.altText.trim()) add('missing-alt', 'Add alternative text for the graphic.');
  if (draft.includeTime && !draft.includeDate) add('time-without-date', 'A timed promotion must include its date.');
  // Date/time facts are rendered separately. This closes the obvious manual-text bypass of omission controls.
  const freeText = `${draft.editorialText}\n${draft.altText}`;
  if (/https?:\/\/|\bwww\.|@[\p{L}\p{N}_]|<\/?[a-z][^>]*>/iu.test(freeText)) add('editorial-link-bypass', 'Keep links, account tags, and HTML out of the opening and visual description; use the reviewed profile and program-link fields.');
  if (/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|november|nov\.?\s+\d)\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(?:AM|PM)\b/i.test(freeText)) add('editorial-fact-bypass', 'Use the date and time controls for factual details; keep the opening and alt text focused on the subject.');
  for (const resolution of draft.resolutions) {
    if (!validResolution(resolution, session)) add('invalid-resolution', 'Every decision must resolve a current conflicting field with a valid value, named organizer, reason, and timestamp.', resolution.field);
    if (['date', 'startTime', 'location'].includes(resolution.field) && !session.conflicts.some(conflict => conflict.field === resolution.field)) add('non-conflict-resolution', 'A conflict decision cannot override an undisputed published field.', resolution.field);
  }
  if (new Set(draft.resolutions.map(resolution => resolution.field)).size !== draft.resolutions.length) add('duplicate-resolution', 'Record only one organizer decision for each disputed field.', 'resolutions');
  for (const conflict of session.conflicts) {
    if (!fieldIncluded(draft, conflict.field)) {
      if (conflict.field === 'location' && [conflict.scheduleValue, conflict.presentationValue].some(value => value && freeText.toLowerCase().includes(value.toLowerCase()))) add('omitted-fact-bypass', 'A disputed location appears in text despite being omitted from the factual details.', conflict.field);
      continue;
    }
    const resolution = draft.resolutions.find(r => r.field === conflict.field);
    if (!resolution || !validResolution(resolution, session)) add('unresolved-conflict', `Confirm the conflicting ${conflict.field} with an organizer, or omit that field.`, conflict.field);
  }
  for (const profile of draft.profiles) {
    const syntax = validateProfileSyntax(profile.platform, profile.url);
    if (!syntax.valid || profile.sessionId !== session.id || profile.platform !== draft.platform || !profile.reviewedBy.trim() || Number.isNaN(Date.parse(profile.reviewedAt)) || (syntax.valid && syntax.handle !== profile.handle)) add('unreviewed-profile', 'Profile links need an explicit session and identity review on the selected platform.', 'profiles');
    if (syntax.valid && syntax.identityKind !== 'unknown' && syntax.identityKind !== profile.identityKind) add('profile-identity-kind', 'An organizational profile cannot be treated as a personal identity.', 'profiles');
  }
  if (draft.photoUrl && draft.photoUrl !== session.presenter.photoUrl) add('unsupplied-photo', 'Select a photograph supplied in the current source, or use the text-only template.');
  const length = copyLength(renderCopy(draft, session), draft.platform);
  if (length > PLATFORM_LIMITS[draft.platform]) add('platform-length', `The complete copy uses ${length} characters; ${draft.platform} permits ${PLATFORM_LIMITS[draft.platform]} in this drafting format.`);
  return issues;
}
export class DraftValidationError extends Error {
  issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) { super(issues.map(i => i.message).join(' ')); this.name = 'DraftValidationError'; this.issues = issues; }
}
export async function approveDraft(draft: Draft, session: Session, reviewedBy: string, reviewedAt: string): Promise<Approval> {
  const issues = await validateDraft(draft, session);
  if (!reviewedBy.trim() || Number.isNaN(Date.parse(reviewedAt))) issues.push({ code: 'missing-review-actor', message: 'Approval needs a named reviewer and a valid timestamp.' });
  if (issues.length) throw new DraftValidationError(issues);
  return { draftId: draft.id, draftVersion: await draftVersion(draft), sessionId: session.id, sourceVersion: session.version, platform: draft.platform, reviewedBy: reviewedBy.trim(), reviewedAt, omittedDisputedFields: [...new Set(session.conflicts.filter(c => !fieldIncluded(draft, c.field)).map(c => c.field))] };
}
export async function isApprovalCurrent(approval: Approval | null, draft: Draft, session: Session): Promise<boolean> {
  return !!approval && approval.draftId === draft.id && approval.sessionId === session.id && approval.platform === draft.platform && approval.sourceVersion === session.version && approval.draftVersion === await draftVersion(draft) && !!approval.reviewedBy.trim() && !Number.isNaN(Date.parse(approval.reviewedAt)) && (await validateDraft(draft, session)).length === 0;
}
export async function assembleExport(draft: Draft, session: Session, approval: Approval | null, createdAt: string): Promise<ExportPackage> {
  if (!await isApprovalCurrent(approval, draft, session)) throw new DraftValidationError([{ code: 'approval-required', message: 'Review and approve the current draft and source before exporting.' }]);
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('Export needs a valid timestamp.');
  return { schemaVersion: 1, sessionId: session.id, sourceVersion: session.version, draftVersion: await draftVersion(draft), platform: draft.platform, copy: renderCopy(draft, session), altText: renderAltText(draft, session), sourceUrl: session.presentationUrl ?? PROGRAM_URL, evidence: session.publicDataEvidence, poster: posterData(draft, session), review: approval!, createdAt, generationMode: draft.generationMode, destination: draft.destination };
}
