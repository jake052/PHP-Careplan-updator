# Notes corpus: structure and style guide

This corpus represents ~120 days of shift notes recorded for Sam Hartley at Brindley Lodge, January through early May 2026. It is the **input** the care-plan refresh reads to detect the five patterns in `../embedded-patterns.md`.

## File layout

```
notes-corpus/
├── README.md                          ← this file
├── 2026-01-seed-notes.md              ← 20 hand-crafted seed notes (you write/edit)
├── 2026-02-generated.md               ← AI-generated, you spot-check
├── 2026-03-generated.md               ← AI-generated, you spot-check
├── 2026-04-generated.md               ← AI-generated, you spot-check
└── 2026-05-partial.md                 ← First 12 days of May (the "today" cut-off)
```

Total target: ~280-360 notes across the 120 days (2-3 per day on average, with more on event days).

## Note schema

Each note is a single markdown block with a fixed header. The header is what the refresh pipeline parses for evidence-trail attribution.

```markdown
### Note <ID>
- **Date:** YYYY-MM-DD
- **Time:** HH:MM (24h)
- **Writer:** <Support worker name, role abbreviation>
- **Type:** <morning | day | evening | night | family-contact | medical | incident | peer | community>
- **Quality:** <thin | mid | rich>  ← internal tag, omit in production

<Note body, prose, 1-5 paragraphs depending on quality tier>
```

The `Quality` tag is for YOU during dataset construction, so the 30/50/20 distribution stays visible. Strip it in the final corpus the demo reads, or leave it and have the demo ignore it.

## Quality distribution

Target across the full corpus:

- **~30% thin notes.** 1-3 short sentences. Generic ("good day, no concerns"). The problem the refresh is solving — these notes carry minimal evidence but make up nearly a third of the corpus, exactly as in real services.
- **~50% mid notes.** A short paragraph with some specifics but gaps. Mentions what happened but not how Sam felt, what worked, what didn't.
- **~20% rich notes.** Multiple paragraphs. Quotes Sam where possible. Specifies sensory state, communication used, support given, what staff learned. The notes you wish all your staff wrote.

## Writers (4 fictional support workers)

Different voices keep the corpus realistic. The refresh should NOT care about writer; the test is whether it can extract signal regardless of style.

| Writer | Role | Style notes |
|--------|------|-------------|
| **Aisha Patel** | Support Worker (started Oct 2025) | Newer staff. Earnest but tentative. Tends toward mid-quality notes. Occasionally over-uses safety language ("ensured Sam's safety") in a generic way. |
| **Mark Davies** | Senior Support Worker | Long-serving. Direct, efficient, often too brief. Source of most "thin" notes — not because he doesn't notice, but because he writes the way he texts. |
| **Priya Nair** | Deputy Manager | Experienced, observant, person-centred training. Writes most of the "rich" notes. Models good practice. |
| **Tom Anderson** | Support Worker | 2 years in post. Reliable mid-quality. Slightly clinical phrasing. Good with medication notes and seizure logs. |

When AI-generating notes, pick the writer per note and stay in voice. A random walk across the four writers across the day is realistic.

## Embedded pattern timeline

The five patterns from `../embedded-patterns.md` must surface across the corpus. This is the **plot**.

| Pattern | Jan | Feb | Mar | Apr | May |
|---------|-----|-----|-----|-----|-----|
| **1. White noise / rain sounds at bedtime** | First hint (1-2 notes, sleep disruption) | First reliable use (3-4 notes) | Established (5-6 notes) | Routine (4-5 notes) | Routine (2-3 notes) |
| **2. Afternoon seizure clustering** | 1 evening seizure (baseline) | 1 afternoon, 1 morning | 2 afternoon | 2 afternoon | 1 afternoon |
| **3. Reduced supermarket tolerance** | Positive (2-3 notes) | Mixed (3 notes) | Declining (3-4 notes) | Two incidents (5-6 notes) | One avoided (1 note) |
| **4. Mia friendship** | 1 mention only | 3-4 mentions | Established (5-6 notes) | Routine (6-8 notes) | Mia absent one day (1 note) |
| **5. Makaton "more" sign** | Not yet | Not yet | First emergence (2-3 notes) | Multiple contexts (5-6 notes) | Reliable (3 notes) |

Use this table when generating later-month notes so the patterns build at the right cadence. Too fast = unrealistic. Too slow = the refresh won't have enough signal.

## AI generation prompt scaffolding

Once you've hand-written the January seeds, here's the scaffolding for generating February-May. Run it on UK-region inference (Azure OpenAI UK South).

```
You are writing fictional shift notes for a UK supported-living service. Your style guide:
- Read <persona-template.md> and <embedded-patterns.md> in full.
- Read the 20 seed notes in <2026-01-seed-notes.md> to match voice and structure.
- Pick a writer per note from: Aisha Patel, Mark Davies, Priya Nair, Tom Anderson. Stay in voice.
- Quality distribution across the batch: 30% thin, 50% mid, 20% rich. Match the tier descriptions in the corpus README.

For the date range <YYYY-MM-DD> to <YYYY-MM-DD>, generate <N> notes. The notes must collectively advance the embedded-pattern timeline as specified for this month:

<paste the row from the timeline table for this month>

For each note:
- Use the schema in the corpus README (Note ID, Date, Time, Writer, Type, Quality).
- Vary times realistically (morning notes 07:00-10:00, day 10:00-16:00, evening 17:00-21:00, night/wake-up 22:00-07:00).
- Some days have 2-3 notes. Some have 1. A few have 4 (incident or seizure days).
- Do NOT invent new health conditions or family members. Stay within the persona.
- Do NOT have Sam suddenly speak in full sentences. Stay within his ~30-40 word vocabulary.
- Quote Sam directly where appropriate using single quotes: 'train good'.

Output the notes in markdown, one block per note, ready to append to the corpus file.
```

You spot-check every 20th note. Anything that drifts from Sam's persona, you edit before the next batch.

## What this corpus is NOT

- It is **not** training data for a model. The corpus is read-only input to the refresh pipeline at demo time.
- It is **not** a substitute for real anonymised data once you have a paying pilot. v2 of the demo uses Ellie's anonymised actual notes (post-DPA) and re-runs the same five-pattern grading.
- It is **not** "good enough" if Sam never sounds like a real person. If the seed notes read like AI output, the rest of the corpus inherits that flatness and Ellie will dismiss the demo. The 20 seeds are the moat.
