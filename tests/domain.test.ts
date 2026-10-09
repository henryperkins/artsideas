import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalHash, normalizeOfficialFeed, normalizeDate, normalizeTime, plainText,
  validateProfileSyntax, createDraft, updateDraft, rebaseDraft, sessionVersion,
  validateDraft, approveDraft, isApprovalCurrent, assembleExport, posterData, renderCopy,
  copyLength, type Draft, type FactResolution, type OfficialFeed,
} from '../lib/domain/domain.ts';
import { createSeedSnapshot, profileCandidates } from '../lib/domain/seed.ts';

const timestamp = '2026-10-09T20:00:00.000Z';
const snapshot = await createSeedSnapshot();
const simpleSession = snapshot.sessions.find(s => s.title === 'Nobody Asked for This')!;
const disputed = snapshot.sessions.find(s => s.title.startsWith('Why Playing Chess'))!;
function draftFor(session = simpleSession): Draft {
  return createDraft(session, { id: 'draft-1', platform: 'linkedin', angle: 'question', editorialText: 'What could curiosity make possible? A session about creative experimentation.', altText: 'A typographic festival card showing the session title and speaker.' });
}

test('seed includes current program only, keeps missing information explicit, and separates social claims', () => {
  assert.equal(snapshot.sessions.length, 48);
  assert.equal(new Set(snapshot.sessions.map(s => s.id)).size, 48);
  assert.equal(snapshot.sessions.filter(s => s.presentationId !== null).length, 42);
  assert.equal(snapshot.sessions.filter(s => !s.format).length, 14);
  assert.deepEqual(Object.fromEntries(['Wednesday', 'Thursday', 'Friday'].map(day => [day, snapshot.sessions.filter(s => s.day === day).length])), { Wednesday: 14, Thursday: 17, Friday: 17 });
  assert.equal(snapshot.mode, 'seed');
  assert.equal(snapshot.sessions.every(s => s.sourceAbstract === null), true);
  assert.equal(snapshot.sessions.every(s => s.publicDataEvidence[0].url.endsWith('/content.json')), true);
  assert.equal(snapshot.sessions.filter(s => s.summaryKind === 'not-available').length, 6);
  assert.equal(profileCandidates.length, 46);
  assert.equal(profileCandidates.every(p => p.sessionId === null && p.identityStatus === 'unverified'), true);
});

test('real source disagreements retain both dates, times, and locations without choosing one', () => {
  assert.equal(snapshot.sessions.filter(s => s.conflicts.some(c => c.field === 'startTime')).length, 8);
  assert.equal(snapshot.sessions.filter(s => s.conflicts.some(c => c.field === 'date')).length, 1);
  assert.equal(snapshot.sessions.filter(s => s.conflicts.some(c => c.field === 'location')).length, 1);
  const fields = new Set(disputed.conflicts.map(c => c.field));
  assert.deepEqual(fields, new Set(['date', 'startTime', 'location']));
  assert.deepEqual(disputed.conflicts.find(c => c.field === 'date'), { field: 'date', scheduleValue: '2026-11-11', presentationValue: '11/12/2026' });
});

test('source version is independent of retrieval time and changes when selected published context changes', async () => {
  const feed: OfficialFeed = {
    schedule: [{ year: '2026', date: '2026-11-12', day: 'Thursday', time: '12:00 PM', title: 'Current', presentation_id: 1 }, { year: '2025', date: '2025-11-12', day: 'Wednesday', time: '12:00 PM', title: 'Archive' }],
    presentations: [{ id: 1, slug: 'current', content: { rendered: '<p>Published context.</p>' } }, { id: 999, slug: 'archive' }],
  };
  const first = await normalizeOfficialFeed(feed, { fetchedAt: timestamp });
  const later = await normalizeOfficialFeed(feed, { fetchedAt: '2026-10-10T20:00:00Z' });
  assert.equal(first.sessions.length, 1);
  assert.equal(first.version, later.version);
  assert.equal(first.sessions[0].sourceAbstract, 'Published context.');
  const changedFeed = structuredClone(feed);
  changedFeed.presentations![0].content!.rendered = '<p>Changed published context.</p>';
  assert.notEqual(first.version, (await normalizeOfficialFeed(changedFeed, { fetchedAt: timestamp })).version);
  assert.equal(await canonicalHash({ z: 1, a: { x: 2, y: 3 } }), await canonicalHash({ a: { y: 3, x: 2 }, z: 1 }));
});

test('normalization rejects invalid calendars/times and renders untrusted markup as plain text', async () => {
  assert.equal(normalizeDate('11/12/2026'), '2026-11-12');
  assert.equal(normalizeDate('2026-02-30'), null);
  assert.equal(normalizeTime('12:00 AM'), '00:00');
  assert.equal(normalizeTime('12:00 PM'), '12:00');
  assert.equal(normalizeTime('25:00'), null);
  assert.equal(normalizeTime('0:30 PM'), null);
  assert.equal(plainText('<p>Arts &amp; Ideas</p><script>sendSecrets()</script>'), 'Arts & Ideas');
  await assert.rejects(normalizeOfficialFeed({ schedule: [{ year: 2026, date: '2026-02-30', day: 'Monday', time: '3:30 PM', title: 'Bad input' }] }, { fetchedAt: timestamp }), /Invalid schedule facts/);
});

test('a disputed session can be approved when affected fields are deliberately omitted', async () => {
  const draft = draftFor(disputed);
  assert.deepEqual(await validateDraft(draft, disputed), []);
  const approval = await approveDraft(draft, disputed, 'Organizer', timestamp);
  assert.deepEqual(new Set(approval.omittedDisputedFields), new Set(['date', 'startTime', 'location']));
  const output = await assembleExport(draft, disputed, approval, timestamp);
  assert.equal(output.copy.includes('8:40'), false);
  assert.equal(output.copy.includes('714 Governor'), false);
  assert.deepEqual(output.poster.details, []);
});

test('timed or located promotion requires explicit organizer decisions bound to this source', async () => {
  const draft = updateDraft(draftFor(disputed), { includeDate: true, includeTime: true, includeLocation: true });
  await assert.rejects(approveDraft(draft, disputed, 'Organizer', timestamp), /Confirm the conflicting/);
  const resolutions = disputed.conflicts.map(conflict => ({ field: conflict.field, value: conflict.presentationValue, sourceVersion: disputed.version, confirmedBy: 'Program organizer', confirmedAt: timestamp, reason: 'Confirmed against organizer running order.' }));
  const resolved = updateDraft(draft, { resolutions });
  assert.deepEqual(await validateDraft(resolved, disputed), []);
  const copy = renderCopy(resolved, disputed);
  assert.match(copy, /November 12, 2026/);
  assert.match(copy, /5:30 PM/);
  assert.match(copy, /Education Center/);
  const approval = await approveDraft(resolved, disputed, 'Organizer', timestamp);
  const output = await assembleExport(resolved, disputed, approval, timestamp);
  assert.match(output.altText, /November 12, 2026/);
  assert.match(output.altText, /5:30 PM/);
  assert.match(output.altText, /Education Center/);
  assert.equal(output.altText, output.poster.altText);
  const staleResolution = updateDraft(resolved, { resolutions: resolutions.map(r => ({ ...r, sourceVersion: 'previous-source' })) });
  await assert.rejects(approveDraft(staleResolution, disputed, 'Organizer', timestamp), /Confirm the conflicting/);
});

test('invalid resolutions keep previews readable and cannot be approved even when the field is omitted', async () => {
  for (const value of ['tomorrow', '2026-02-30']) {
    const resolution = { field: 'date' as const, value, sourceVersion: disputed.version, confirmedBy: 'Organizer', confirmedAt: timestamp, reason: 'Organizer decision.' };
    const draft = updateDraft(draftFor(disputed), { includeDate: true, resolutions: [resolution] });
    assert.doesNotThrow(() => renderCopy(draft, disputed));
    assert.doesNotThrow(() => posterData(draft, disputed));
    assert.match(renderCopy(draft, disputed), /November 11, 2026/);
    assert.ok((await validateDraft(draft, disputed)).some(i => i.code === 'invalid-resolution'));
    await assert.rejects(approveDraft(draft, disputed, 'Organizer', timestamp));
    const omitted = updateDraft(draft, { includeDate: false });
    assert.ok((await validateDraft(omitted, disputed)).some(i => i.code === 'invalid-resolution'));
    await assert.rejects(approveDraft(omitted, disputed, 'Organizer', timestamp));
  }
});

test('a resolution cannot override undisputed published facts or hide stale, duplicate, or unsupported decisions', async () => {
  const nonconflict = updateDraft(draftFor(), { includeDate: true, resolutions: [{ field: 'date', value: '2026-11-13', sourceVersion: simpleSession.version, confirmedBy: 'Organizer', confirmedAt: timestamp, reason: 'Attempted override.' }] });
  assert.match(renderCopy(nonconflict, simpleSession), /November 11, 2026/);
  assert.ok((await validateDraft(nonconflict, simpleSession)).some(i => i.code === 'non-conflict-resolution'));
  await assert.rejects(approveDraft(nonconflict, simpleSession, 'Organizer', timestamp));
  const valid = { field: 'date' as const, value: '2026-11-12', sourceVersion: disputed.version, confirmedBy: 'Organizer', confirmedAt: timestamp, reason: 'Confirmed decision.' };
  for (const resolutions of [[{ ...valid, sourceVersion: 'old-source' }], [valid, valid], [{ ...valid, field: 'unsupported' } as unknown as FactResolution]]) {
    const draft = updateDraft(draftFor(disputed), { resolutions });
    assert.ok((await validateDraft(draft, disputed)).some(i => ['invalid-resolution', 'duplicate-resolution'].includes(i.code)));
    await assert.rejects(approveDraft(draft, disputed, 'Organizer', timestamp));
  }
});

test('omission flags cannot bypass review by putting disputed dates/times/locations in free text', async () => {
  for (const updates of [{ editorialText: 'Join us November 11 at 8:40 PM.' }, { altText: 'Chess, Wednesday, 8:40 PM.' }, { editorialText: 'Meet at 714 Governor Nichols St.' }]) {
    const draft = updateDraft(draftFor(disputed), updates);
    assert.ok((await validateDraft(draft, disputed)).some(i => ['editorial-fact-bypass', 'omitted-fact-bypass'].includes(i.code)));
    await assert.rejects(approveDraft(draft, disputed, 'Organizer', timestamp));
  }
});

test('free creative text cannot inject unreviewed account tags, links, or HTML into an approved package', async () => {
  for (const text of ['Join @unreviewed for details.', 'Visit https://wrong.example for details.', 'See www.wrong.example.', '<a href="/elsewhere">More</a>', 'Contact unknown@example.com.']) {
    for (const field of ['editorialText', 'altText']) {
      const draft = updateDraft(draftFor(), { [field]: text });
      assert.ok((await validateDraft(draft, simpleSession)).some(i => i.code === 'editorial-link-bypass'));
      await assert.rejects(approveDraft(draft, simpleSession, 'Organizer', timestamp));
    }
  }
  assert.deepEqual(await validateDraft(updateDraft(draftFor(), { editorialText: 'Ask what a hands-on creative experiment could teach us.' }), simpleSession), []);
});

test('every consequential draft edit invalidates the previous approval and export', async () => {
  const draft = draftFor(); const approval = await approveDraft(draft, simpleSession, 'Organizer', timestamp);
  assert.equal(await isApprovalCurrent(approval, draft, simpleSession), true);
  const edits: Partial<Draft>[] = [
    { editorialText: 'A different editorial opening.' }, { altText: 'Changed graphic description.' },
    { posterTemplate: 'red' }, { photoUrl: simpleSession.presenter.photoUrl },
    { destination: 'festival-linkedin' }, { includeDate: true }, { angle: 'practical' },
    { profiles: [{ sessionId: simpleSession.id, platform: 'linkedin', url: 'https://www.linkedin.com/in/speaker/', handle: 'speaker', identityKind: 'person', nativeId: null, reviewedBy: 'Organizer', reviewedAt: timestamp }] },
  ];
  for (const edit of edits) {
    const changed = updateDraft(draft, edit);
    if (JSON.stringify(changed) === JSON.stringify(draft)) continue;
    assert.equal(await isApprovalCurrent(approval, changed, simpleSession), false, JSON.stringify(edit));
    await assert.rejects(assembleExport(changed, simpleSession, approval, timestamp), /approve the current draft/);
  }
});

test('source changes invalidate approvals even when a stale draft hash is retained', async () => {
  const draft = draftFor(); const approval = await approveDraft(draft, simpleSession, 'Organizer', timestamp);
  const changed = { ...simpleSession, title: 'Updated published title' };
  assert.ok((await validateDraft(draft, changed)).some(i => i.code === 'source-integrity'));
  changed.version = await sessionVersion(changed);
  assert.equal(await isApprovalCurrent(approval, draft, changed), false);
  await assert.rejects(assembleExport(draft, changed, approval, timestamp));
  const rebased = rebaseDraft(draft, changed);
  assert.deepEqual(rebased.resolutions, []);
  const newApproval = await approveDraft(rebased, changed, 'Organizer', timestamp);
  assert.equal(await isApprovalCurrent(newApproval, rebased, changed), true);
});

test('observed malformed profiles and wrong-platform links never become valid tag candidates', () => {
  assert.equal(validateProfileSyntax('x', 'https://noai.fyi').valid, false);
  assert.equal(validateProfileSyntax('facebook', 'https://www.instagram.com/robgaudet').valid, false);
  assert.equal(validateProfileSyntax('linkedin', 'https://www.linkedin.com/feed/').valid, false);
  assert.equal(validateProfileSyntax('x', 'https://x.com/speaker/status/123').valid, false);
  assert.equal(validateProfileSyntax('instagram', 'https://www.instagram.com/p/abcd').valid, false);
  assert.equal(validateProfileSyntax('x', 'https://x.com.evil.test/speaker').valid, false);
  assert.equal(validateProfileSyntax('x', 'https://attacker@x.com/speaker').valid, false);
  assert.equal(validateProfileSyntax('x', 'javascript:alert(1)').valid, false);
  assert.deepEqual(validateProfileSyntax('linkedin', 'https://www.linkedin.com/company/the-ella-project/?trk=source'), { valid: true, canonicalUrl: 'https://www.linkedin.com/company/the-ella-project/', handle: 'the-ella-project', identityKind: 'organization' });
  assert.deepEqual(validateProfileSyntax('x', 'https://twitter.com/NoaiFyi?utm_source=feed'), { valid: true, canonicalUrl: 'https://x.com/NoaiFyi', handle: 'NoaiFyi', identityKind: 'unknown' });
});

test('reviewed profiles need explicit session, platform, actor and organization classification', async () => {
  const profile = { sessionId: simpleSession.id, platform: 'linkedin' as const, url: 'https://www.linkedin.com/company/example/', handle: 'example', identityKind: 'person' as const, nativeId: null, reviewedBy: 'Organizer', reviewedAt: timestamp };
  assert.ok((await validateDraft(updateDraft(draftFor(), { profiles: [profile] }), simpleSession)).some(i => i.code === 'profile-identity-kind'));
  const wrongSession = { ...profile, identityKind: 'organization' as const, sessionId: disputed.id };
  assert.ok((await validateDraft(updateDraft(draftFor(), { profiles: [wrongSession] }), simpleSession)).some(i => i.code === 'unreviewed-profile'));
  const approvedProfile = { ...profile, identityKind: 'organization' as const };
  const valid = updateDraft(draftFor(), { profiles: [approvedProfile] });
  assert.deepEqual(await validateDraft(valid, simpleSession), []);
  assert.match(renderCopy(valid, simpleSession), /https:\/\/www.linkedin.com\/company\/example\//);
});

test('export requires actual approval, includes review identity and versions, and poster data is deterministic', async () => {
  const draft = draftFor();
  await assert.rejects(assembleExport(draft, simpleSession, null, timestamp));
  const approval = await approveDraft(draft, simpleSession, 'Organizer', timestamp);
  const first = await assembleExport(draft, simpleSession, approval, timestamp);
  const second = await assembleExport(structuredClone(draft), simpleSession, approval, timestamp);
  assert.deepEqual(first, second);
  assert.equal(first.review.reviewedBy, 'Organizer');
  assert.equal(first.sourceVersion, simpleSession.version);
  assert.equal(first.generationMode, 'hand-authored-sample');
  assert.deepEqual(first.poster, posterData(draft, simpleSession));
  assert.equal(first.poster.title, simpleSession.title);
  assert.equal(first.sourceUrl, simpleSession.presentationUrl);
});

test('platform budget includes deterministic factual copy and uses a conservative wide-character X count', async () => {
  assert.equal(copyLength('https://example.com/very/long/path', 'x'), 23);
  assert.equal(copyLength('中文', 'x'), 4);
  const draft = updateDraft(draftFor(), { platform: 'x', editorialText: 'A'.repeat(280) });
  assert.ok((await validateDraft(draft, simpleSession)).some(i => i.code === 'platform-length'));
});
