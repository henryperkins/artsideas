import seed from '../../data/noai-2026-seed.json' with { type: 'json' };
import candidates from '../../data/profile-candidates.json' with { type: 'json' };
import { normalizeOfficialFeed, type OfficialFeed, type ProfileCandidate, type SourceSnapshot } from './domain.ts';

/** Seed is a real dated source snapshot, with brief editorial summaries; never a simulated live fetch. */
export function createSeedSnapshot(): Promise<SourceSnapshot> {
  return normalizeOfficialFeed(seed.feed as OfficialFeed, {
    fetchedAt: seed.capturedAt, feedUrl: seed.feedUrl, rawFeedHash: seed.feedHash,
    topicSummaries: seed.topicSummaries, mode: 'seed',
  });
}
export const sourceTopicSummaries: Record<string, string> = seed.topicSummaries;
/** No candidate is implicitly mapped to a session or approved for tagging. */
export const profileCandidates = candidates as ProfileCandidate[];
