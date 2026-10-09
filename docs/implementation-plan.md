# Arts & Ideas Dispatch implementation plan

Approved scope: a private organizer drafting, review, and export workspace using the real 2026 program. No social posting adapter in this milestone. Claude generation requires a server-side key and explicitly selected model; hand-authored samples remain clearly labeled.

## Files and responsibilities

1. `data/noai-2026-seed.json`, `data/profile-candidates.json`, `lib/domain/domain.ts`, `lib/domain/seed.ts`: normalize the current program; retain schedule and abstract disagreements; keep profile candidates unmapped; calculate source and draft hashes; validate, approve, and export with provenance. Verify real 48-row inventory and draft invalidation behavior in `tests/domain.test.ts`.
2. `db/schema.ts`, `lib/server/*`, `app/api/*`: authenticated, user-scoped durable drafts, source snapshots, approval and export records, optimistic revisions, generation receipts and rate limits. Official-feed refresh is bounded and preserves the previous snapshot on failure. Claude receives only server-owned source facts and returns bounded creative fields. Verify services and provider failure modes in `tests/server.test.ts`.
3. `app/page.tsx`, `app/globals.css`, `components/dispatch/*`: searchable program, day/theme filters, draft/source/review views, platform and angle controls, factual inclusion and resolution controls, profile identity review, editable copy/alt text, deterministic graphic preview, save/approve/export. Any edit disables export until approval of the saved revision. All unavailable/loading/error/empty states are explicit.
4. `components/dispatch/poster-svg.ts`: exact, escaped, deterministic standalone SVG export derived from the same poster data as the preview. Check long text, escaped markup, source facts, and dimensions in `tests/poster.test.ts`.
5. `.openai/hosting.json`, `drizzle/*`, `cloudflare-env.d.ts`, metadata: D1 binding, generated migration and declarations. Inspect generated SQL. Run all domain/server/poster tests, TypeScript checks, lint and production build. Independent code review before packaging and private Sites deployment.

## Verification and release

- Test the important authorization, source-integrity, approval, concurrent-update, provider-failure, and export behaviors. Do not claim live Claude behavior without credentials or live social publishing.
- Preserve the Sites starter's Vinext/Workers integration and native source/deployment workflow.
- Managed Linux browser QA requires the advertised control-browser capability. It is unavailable in this session; skip browser QA without substituting a manually started server or Playwright. Record this limit honestly.
- Use the native source workflow to commit/push the complete app and package the build, then deploy privately. A terminal successful deployment status is evidence of deployment, not browser interaction coverage.

## Decision ledger

- User approved the research/build brief and instructed “Approved, proceed.” Private implementation and preview deployment are authorized; no repeat confirmation checkpoint.
- Use America/Chicago as venue-inferred display context; no timed scheduling adapter is implemented.
- Eight start-time conflicts include one date and one location conflict. Disputed fields are omitted by default and need organizer resolution to appear in export.
- Profile URLs from submissions remain separate unverified candidates. Native network identifiers and tag payloads are deferred to account adapters.
- Source version changes invalidate previous approval. Approval binds actual authenticated actor, current source, saved draft, platform and all reviewed metadata.
- UI follows the generated print-desk concept, using official festival palette and typography; no invented logo or synthetic speaker portraits.

## Release evidence

- Source normalization includes all 48 entries and 42 current abstracts; normalized live snapshot is about 86 KB. The captured seed is explicitly distinguished from a live refresh.
- Fresh automated suite: 38 passing tests across domain, real SQLite query execution, service/provider boundaries, and deterministic graphics. TypeScript and full repository lint pass.
- Independent release review identified and verified fixes for the generation route, pending-save edit loss, keyboard tabs, invalid resolution dates, nonconflicting fact overrides, stale exports, unreviewed prose links/tags, and generation attribution.
- Actual poster rasterization revealed a font substitution clipping risk. Wrapping now reserves the maximum local display/fallback glyph widths, and SVG text widths are constrained. The rendered verification poster fits its full title and facts; footer and detail regions retain separate space.
- Exports now serialize the exact SVG on the server and record its hash with the full package hash before reporting a prepared export. A download is initiated by the organizer; the database does not assert that a browser saved it to disk.
- No browser interaction QA or live Claude call was performed. These are explicit remaining verification limits.
