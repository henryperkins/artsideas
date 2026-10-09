# Arts & Ideas Dispatch

Private drafting, review, and export workspace for the 2026 New Orleans Arts & Ideas Festival. Real official-source importer, 48-entry captured seed, source disagreement review, server-owned facts, durable user-scoped drafts, approvals bound to versions, and standalone SVG/copy/alt-text/provenance exports.

Claude generation uses the Anthropic Messages API. Configure `ANTHROPIC_API_KEY` as a Sites server secret and `ANTHROPIC_MODEL` as an explicit compatible model ID. Credentials are never entered into this app's browser or embedded into its source. Without both settings, the interface shows hand-authored sample mode. Generation receipts preserve provider/source metadata and identify later edits. Actual social publishing and native mention adapters are outside this milestone.

The hosting boundary is the private Sites authenticated ingress. This app relies on the platform's authenticated visitor headers; do not deploy it as a standalone unauthenticated Worker.

## Local setup

Use Node.js 24 and pnpm 11.25.0, pinned in `package.json`. With Corepack installed, run `corepack enable` to make the pinned pnpm available.

```sh
pnpm install --frozen-lockfile
pnpm run db:setup
pnpm run dev
```

Open [the local sign-in route](http://localhost:5173/signin-with-chatgpt?return_to=%2F) once to enter the development workspace. It supplies a mock local identity, so no ChatGPT credentials are needed. Use `localhost` or `127.0.0.1`; development sign-in is restricted to loopback connections. The workspace then supports saving, review, and export against a local SQLite database.

`db:setup` applies pending migrations and can be rerun safely. `wrangler.local.json` is only for local database setup; its placeholder database ID matches the Vite development binding. Database state lives in ignored `.wrangler/state/` files. The built `start` command expects the Sites authenticated ingress and does not supply development sign-in.

Claude generation is optional. To enable it locally, create an ignored `.dev.vars` file with `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`, then restart the development server. Use an explicitly compatible model ID. Without these settings, the app runs in hand-authored sample mode.

## Validation

```sh
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
```

The domain, server and real SQLite adapter tests cover source conflicts and integrity, user scoping, revision checks, approval invalidation, recorded exports, request bounds and provider failures. The deterministic poster tests cover complete reviewed facts, dimensions, escaped markup, long Unicode text and embedded fonts.

D1 schema is maintained in `db/schema.ts`; SQL and schema metadata are in `drizzle/`. Site hosting applies generated migrations before deploying the Worker. Do not mix seed data into migrations.

The print-desk interface uses official festival colors and locally served Inter / Inter Tight fonts. Font licenses are included in `public/fonts/`. The generated visual concept informed the composition; the poster itself is deterministic SVG, not generated text in an image.

Managed Linux browser QA requires control-browser. It was unavailable during the initial build, so browser interaction validation is not represented by the automated checks or build.

Private Slack provenance URLs from the original export have been redacted for this public repository. Profile observations remain unverified review candidates; the redacted provenance cannot be used as public evidence.
