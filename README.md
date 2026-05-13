# People Helping People — Care Plan Refresh Demo

The demo for the 14-day sprint. Loads an anonymised fictional persona, an outdated care plan, and a corpus of shift notes, then runs an LLM refresh pipeline that produces a refreshed plan with click-through evidence traceability.

## What's in the box

```
php-demo/
├── data/                          # The fictional dataset (Sam Hartley)
│   ├── persona-template.md
│   ├── outdated-care-plan-template.md
│   ├── embedded-patterns.md       # Grading rubric for the demo
│   └── notes-corpus/
│       └── 2026-01-seed-notes.md  # 20 hand-crafted seed notes
├── src/
│   ├── lib/
│   │   ├── dataset.ts             # Parses the markdown dataset into typed records
│   │   ├── llm.ts                 # Azure OpenAI UK South client
│   │   ├── refresh.ts             # The refresh pipeline (system + JSON schema)
│   │   └── types.ts               # Zod schemas for the output shape
│   ├── app/
│   │   ├── page.tsx               # Demo UI
│   │   └── api/
│   │       ├── refresh/route.ts   # POST: runs the refresh
│   │       └── note/route.ts      # GET: returns a single note for evidence panel
│   └── components/
│       ├── PlanView.tsx           # Renders markdown with clickable [Note NNN] citations
│       └── EvidencePanel.tsx      # Side panel showing the cited source note
└── .env.local.example
```

## Prerequisites

- **Node 22+** and **bun** (already installed if you scaffolded this with the team script).
- For demos: **Azure OpenAI account with a UK South deployment.** This is the UK-residency requirement from the design doc — not negotiable. Default OpenAI/Anthropic US endpoints do not satisfy buyer expectations for UK care data.

## Two run modes

### Mode A — Local testing (OpenAI US, fast path, ~2 minutes setup)

For verifying the pipeline works against the fictional Sam dataset only. The fictional persona means there is no GDPR or data-residency concern, so OpenAI US is acceptable.

```bash
cd /Users/jakebuck/php-demo
cp .env.local.example .env.local
# edit .env.local: set LLM_PROVIDER="openai" and paste your OPENAI_API_KEY
bun run dev
```

The UI shows a flashing red **"OpenAI US — Test mode"** badge in the header. That badge exists so you cannot screen-share this mode to a real provider without noticing.

### Mode B — Demo-ready (Azure UK South, ~30 minutes setup)

Required before showing the demo to Ellie, Sarah, or any real RM. Even informally.



## Azure setup (one-time, ~30 minutes)

1. Sign in to portal.azure.com, create a new Azure OpenAI resource in **UK South region**.
2. Inside that resource, go to **Azure AI Foundry → Deployments** and deploy `gpt-4o` (or `gpt-4.1` if available). Note the **deployment name** you choose.
3. From the resource overview, copy your **endpoint** (looks like `https://your-resource.openai.azure.com`) and your **API key**.
4. Confirm in the portal that the data residency is UK South. Screenshot it for your compliance pack.

## Local setup

```bash
cd /Users/jakebuck/php-demo
cp .env.local.example .env.local
# Edit .env.local with your Azure endpoint, key, deployment name
bun run dev
```

Open http://localhost:3000. Click **Run refresh**. Wait ~30-90 seconds. The refreshed plan renders with clickable `Note NNN` citations; clicking one opens a side panel showing the source shift note.

## Grading the output

Open `data/embedded-patterns.md` side-by-side with the refreshed plan. Check each of the five patterns:

1. **White noise / rain sounds at bedtime** — does the refreshed plan name this specifically, link it to bedtime, and cite ≥3 source notes?
2. **Afternoon seizure clustering** — does the refreshed plan name the afternoon window, count the seizures, and recommend a medication-timing review?
3. **Reduced supermarket tolerance** — does the refreshed plan name the declining trend with January-to-April contrast and a specific environmental adjustment?
4. **Mia friendship** — is Mia named with citations to ≥3 notes, with a concrete supported-activity recommendation?
5. **Makaton "more" sign** — does the refreshed plan name "more" specifically, in ≥2 contexts, with a measurable goal?

**Note:** the seed dataset currently covers only January 2026 (20 notes). For patterns 2, 3, 5 to surface fully, you need the February-May AI-generated corpus described in `data/notes-corpus/README.md`. Pattern 1 (white-noise hint) and Pattern 4 (Mia introduction) are visible in the January seeds alone — those two will land on the first run, the rest will partially land or miss until the corpus is extended.

## Iterating

- The refresh prompt is in `src/lib/refresh.ts` (`SYSTEM_PROMPT`). If the output is missing a pattern even when the notes contain signal, tighten the prompt here.
- The output schema is enforced by Azure OpenAI structured outputs (`response_format: json_schema, strict: true`). If you change the shape, also update `src/lib/types.ts`.
- Temperature is `0.2` to keep refreshes consistent across runs. Bump to `0.4` if outputs feel too samey across iterations.

## Compliance posture

- **All inference runs on Azure OpenAI UK South.** Configured via `.env.local`. No fallback to US endpoints.
- **The dataset is fully fictional.** No real person is referenced anywhere in `data/`. Safe to share, screenshot, present.
- **No persistence.** The refresh result is held in browser memory only — nothing is written to disk or sent to third-party services beyond Azure OpenAI.
- **Before any live pilot:** add the DPA, audit trail logging, and access controls described in the design doc compliance pack section. This demo is not pilot-ready as-is; it is sales-presentation-ready.

## Known limits (deliberate, for the 14-day sprint)

- No auth.
- No persistence — re-running discards previous results.
- No multi-tenant or per-provider isolation.
- No formal observability (logs only).
- Single-person demo. Multi-person batch is post-pilot work.

All of these are intentional. The demo's job is to earn the meeting, not to be the production product.
