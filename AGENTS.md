<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Reference documents

Two specs in the workspace-level `PHP-Docs/Technical/` describe this module in depth — read before substantial work:

- **`../PHP-Docs/Technical/php_git_care_plan_spec.md`** — the git-style versioned care plan output: rendering from the person schema, the diff engine, version history, integration points. This module is the implementation target.
- **`../PHP-Docs/Technical/php_care_notes_and_plan_ingestion_spec.md`** — covers care notes primarily but also the plan ingestion design that feeds this module.

Cross-cutting refs (technical architecture, fusion model, UI spec) are listed in the workspace-level `../CLAUDE.md` § Reference documents.

## Live-events hook (PHP-Demo integration, additive)

This module exposes a read-only `?eventsUrl=<url>` query parameter on `/`, `/api/refresh`, and `/api/note`. When present, the URL is fetched server-side and its `{ events: [...] }` payload is mapped into `CorpusNote`s and merged into the dataset before the refresh runs (and before single-note lookups resolve).

- **Where the merge happens:** `src/lib/live-events.ts` (`fetchLiveNotes`) + `src/lib/dataset.ts` (`mergeExtraNotes`).
- **Guard:** `eventsUrl` is restricted to loopback hosts (`localhost` / `127.0.0.1` / `::1`) by default — SSRF guard. To accept events from a separate deployment (e.g. PHP-Demo on Vercel), set `EVENTS_URL_ALLOWED_HOSTS` to a comma-separated list of additional hostnames at deploy time (e.g. `EVENTS_URL_ALLOWED_HOSTS="php-demo-xyz.vercel.app"`). Loopback is always permitted. The env var is read per-request, so changing it on Vercel takes effect without redeploying this module.
- **Standalone behaviour unchanged:** with no `?eventsUrl=` param the module behaves exactly as before. The hook is purely additive.
- **ID assignment:** live events are mapped to corpus IDs `(existing.length + 1)`, `(+2)`, … so the LLM can cite them as `[Note NNN, YYYY-MM-DD]` and the evidence panel's `/api/note?id=NNN&eventsUrl=…` round-trips to the same source.
- **Prompt nudge:** when live notes are merged, `runRefresh()` appends a sentence to the user prompt asking the LLM to look for patterns linking the live capture to historic notes.

Don't extend this hook with anything that mutates the upstream event store. Read-only by design.
