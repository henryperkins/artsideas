import { DATA_URL, normalizeOfficialFeed, sha256, type OfficialFeed, type SourceSnapshot } from "../domain/domain.ts";
import { sourceTopicSummaries } from "../domain/seed.ts";
import { ServiceError } from "./errors.ts";
import { readBoundedText } from "./http.ts";

/** The upstream URL is fixed. No client URLs, redirects, or arbitrary fetches are accepted. */
export async function refreshOfficialSource(fetcher: typeof fetch = fetch, now = new Date(), timeoutMs = 10000): Promise<SourceSnapshot> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(DATA_URL, { signal: controller.signal, redirect: "error", headers: { Accept: "application/json" } });
    if (!response.ok) throw new ServiceError(503, "source-unavailable", "The official program is unavailable. The saved source remains unchanged.");
    const text = await readBoundedText(response, 5 * 1024 * 1024);
    let feed: OfficialFeed;
    try { feed = JSON.parse(text); } catch { throw new ServiceError(502, "source-malformed", "The official program did not return valid JSON. The saved source remains unchanged."); }
    const snapshot = await normalizeOfficialFeed(feed, { fetchedAt: now.toISOString(), feedUrl: DATA_URL, year: 2026, mode: "live", rawFeedHash: await sha256(text), topicSummaries: sourceTopicSummaries });
    if (!snapshot.sessions.length || snapshot.sessions.length > 1000 || snapshot.sessions.some(s => !s.date.startsWith("2026-"))) throw new ServiceError(502, "source-malformed", "The official feed does not contain a valid 2026 program. The saved source remains unchanged.");
    return snapshot;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (controller.signal.aborted) throw new ServiceError(504, "source-timeout", "The official program took too long to respond. The saved source remains unchanged.");
    throw new ServiceError(503, "source-unavailable", "The official program could not be refreshed. The saved source remains unchanged.");
  } finally { clearTimeout(timer); }
}
