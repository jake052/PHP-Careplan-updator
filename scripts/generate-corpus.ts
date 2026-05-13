#!/usr/bin/env bun
/**
 * Generate the Feb-May 2026 shift-notes corpus from the January seeds.
 *
 * Runs 4 OpenAI calls in parallel (one per month). Writes the output to
 *   data/notes-corpus/2026-02-generated.md
 *   data/notes-corpus/2026-03-generated.md
 *   data/notes-corpus/2026-04-generated.md
 *   data/notes-corpus/2026-05-partial.md
 *
 * Pre-reqs: .env.local with OPENAI_API_KEY set, LLM_PROVIDER does NOT matter
 * (this script always uses OpenAI directly for corpus generation — corpus
 * is fictional so US endpoints are fine).
 *
 * Run: bun scripts/generate-corpus.ts
 */

import OpenAI from "openai";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const PROJECT_ROOT = join(SCRIPT_DIR, "..");
const DATA_DIR = join(PROJECT_ROOT, "data");

// Person selection: --person=<id> (defaults to "sam" at data/ root for legacy).
const PERSON_ARG = process.argv.find((a) => a.startsWith("--person="));
const PERSON_ID = PERSON_ARG ? PERSON_ARG.slice("--person=".length) : "sam";
const PERSON_DIR = PERSON_ID === "sam" ? DATA_DIR : join(DATA_DIR, "people", PERSON_ID);
const CORPUS_DIR = join(PERSON_DIR, "notes-corpus");

interface MonthSpec {
  label: string;
  outFile: string;
  startId: number;
  count: number;
  dateRange: { from: string; to: string };
  monthIndex: 1 | 2 | 3 | 4; // 1 = first month after seeds, 4 = last (May partial)
}

// Person-agnostic month spec. Pattern signal comes from embedded-patterns.md
// loaded per-person; this script just gives the LLM the slot to fill.
const MONTHS: MonthSpec[] = [
  {
    label: "February 2026",
    outFile: "2026-02-generated.md",
    startId: 21,
    count: 50,
    dateRange: { from: "2026-02-01", to: "2026-02-28" },
    monthIndex: 1,
  },
  {
    label: "March 2026",
    outFile: "2026-03-generated.md",
    startId: 71,
    count: 60,
    dateRange: { from: "2026-03-01", to: "2026-03-31" },
    monthIndex: 2,
  },
  {
    label: "April 2026",
    outFile: "2026-04-generated.md",
    startId: 131,
    count: 70,
    dateRange: { from: "2026-04-01", to: "2026-04-30" },
    monthIndex: 3,
  },
  {
    label: "May 2026 (1st-12th, partial month)",
    outFile: "2026-05-partial.md",
    startId: 201,
    count: 25,
    dateRange: { from: "2026-05-01", to: "2026-05-12" },
    monthIndex: 4,
  },
];

const MONTH_GUIDANCE: Record<MonthSpec["monthIndex"], string> = {
  1: "Month 1 of 4 after the seeds. Patterns that are 'first emergence' in the answer key should appear subtly here for the FIRST time. Patterns labelled 'not yet' should not appear. Patterns that are 'established' by later months can have early signs.",
  2: "Month 2 of 4. Most patterns are now visibly developing. Use the answer-key window dates as a guide — patterns described as emerging this month should LAND clearly. Patterns described as 'established' should be reliably present.",
  3: "Month 3 of 4. This is the month most patterns are at their clearest — incidents, repetitions, contrasts. The team should be noticing and flagging in their notes.",
  4: "Month 4 (partial, 12 days). 'Current state' — the cumulative result of all patterns is now visible. The refresh, run after this month, should be able to identify everything from the answer key.",
};

const NOTE_SCHEMA = {
  type: "object",
  properties: {
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Zero-padded 3-digit, e.g. '021'" },
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM 24-hour" },
          writer: {
            type: "string",
            description:
              "One of: 'Aisha Patel, SW' / 'Mark Davies, Sr SW' / 'Priya Nair, DM' / 'Tom Anderson, SW' (optionally add ' (waking night)' on night-shift notes)",
          },
          type: {
            type: "string",
            enum: [
              "morning",
              "day",
              "evening",
              "night",
              "family-contact",
              "medical",
              "incident",
              "peer",
              "community",
            ],
          },
          quality: { type: "string", enum: ["thin", "mid", "rich"] },
          body: { type: "string" },
        },
        required: ["id", "date", "time", "writer", "type", "quality", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["notes"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You write fictional shift notes for a UK supported-living service. You are continuing an existing corpus written about a specific fictional supported person whose persona, recent-life pattern brief, and January seed notes are provided below.

NON-NEGOTIABLE RULES:

1. **Stay strictly within the persona.** Do NOT invent new diagnoses, family members, addresses, schools, or biographical facts not present in the persona document. Use only the supported person's name as given.

2. **Honour the communication style described in the persona.** If they communicate verbally with a limited vocabulary, do not put them in full sentences. If they are selectively mute and use a whiteboard, do not have them spontaneously speak to staff. If they sign Makaton, use the signs in the persona.

3. **Writers come from the persona's staff team only.** Pick writers from the named staff listed in the persona, matching the voice/quality tendencies the persona describes for each. Do not invent writers.

4. **Quality distribution across the batch: roughly 30% thin, 50% mid, 20% rich.**
   - Thin: 1-3 short sentences. Generic-feeling. Minimal signal.
   - Mid: a short paragraph with some specifics but gaps.
   - Rich: multiple paragraphs. Quote the person where appropriate. Specifies sensory state, communication used, what staff learned.

5. **Pattern signals follow the embedded-patterns document below.** That document describes when each pattern emerges, what evidence it needs, and how to seed the right number of notes per month. Match that cadence. Do not invent patterns; do not skip the ones for this month.

6. **Times are realistic for the type:**
   - morning: 07:00-10:00
   - day: 10:00-16:00
   - evening: 17:00-21:00
   - night: 21:30-07:00
   - medical: any time; if event-driven, exact timestamp matters
   - incident: any time; usually day or evening

7. Note IDs are zero-padded 3-digit strings, sequential from the starting ID, no gaps.

8. **Output is JSON matching the schema. Nothing outside the JSON.**`;

function buildUserPrompt(
  month: MonthSpec,
  displayName: string,
  personaSummary: string,
  embeddedPatterns: string,
  styleSamples: string,
  writers: string[],
): string {
  return [
    `## SUPPORTED PERSON: ${displayName}`,
    "",
    `## STAFF WRITERS — use ONLY these exact strings in the "writer" field`,
    writers.map((w) => `- ${w}`).join("\n"),
    "",
    `Do NOT invent additional writers. Do NOT use writers from any other supported person you might be familiar with. Pick from the list above for every single note.`,
    "",
    `## PERSONA (full profile — the baseline picture before recent patterns emerged)`,
    personaSummary,
    "",
    `## EMBEDDED PATTERNS (the recent-life signals the corpus must carry)`,
    embeddedPatterns,
    "",
    `## STYLE REFERENCE — January seed notes (match this voice exactly)`,
    styleSamples,
    "",
    `## GENERATION SPEC`,
    `Month: **${month.label}**`,
    `Date range: ${month.dateRange.from} to ${month.dateRange.to}`,
    `Target note count: ${month.count}`,
    `Starting note ID: ${String(month.startId).padStart(3, "0")}`,
    "",
    `Month role in the pattern timeline: ${MONTH_GUIDANCE[month.monthIndex]}`,
    "",
    `Cross-reference each of the 5 patterns in the embedded-patterns document above and seed the right amount of signal for THIS month. If a pattern is "not yet" for this month, do not introduce it. If a pattern is "first emergence" this month, seed it subtly in 1-3 notes. If a pattern is "established" or "routine" this month, seed it more visibly in 3-6 notes. If a pattern peaks this month, seed it densely with contrast.`,
    "",
    `## REMINDER`,
    `Output JSON: "notes" array of exactly ${month.count} note objects. IDs zero-padded 3-digit strings, sequential from ${String(month.startId).padStart(3, "0")}. Voice must match the seeds. Use only staff names from the persona. Pattern signals must match the embedded-patterns document.`,
  ].join("\n");
}

function noteToMarkdown(n: {
  id: string;
  date: string;
  time: string;
  writer: string;
  type: string;
  quality: string;
  body: string;
}): string {
  return [
    `### Note ${n.id}`,
    `- **Date:** ${n.date}`,
    `- **Time:** ${n.time}`,
    `- **Writer:** ${n.writer}`,
    `- **Type:** ${n.type}`,
    `- **Quality:** ${n.quality}`,
    "",
    n.body.trim(),
    "",
    "---",
    "",
  ].join("\n");
}

async function generateMonth(
  client: OpenAI,
  model: string,
  month: MonthSpec,
  displayName: string,
  personaSummary: string,
  embeddedPatterns: string,
  styleSamples: string,
  writers: string[],
): Promise<{ month: string; count: number; outFile: string }> {
  const userPrompt = buildUserPrompt(month, displayName, personaSummary, embeddedPatterns, styleSamples, writers);

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "month_notes", strict: true, schema: NOTE_SCHEMA },
    },
    temperature: 0.75,
    max_tokens: 16000,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error(`Empty response for ${month.label}`);
  const parsed = JSON.parse(raw) as {
    notes: Array<Parameters<typeof noteToMarkdown>[0]>;
  };

  const header = [
    `# Generated notes — ${month.label}`,
    "",
    `> AI-generated from the January seed style guide and the pattern timeline.`,
    `> Spot-check every 20th note and edit anything that drifts from Sam's voice.`,
    "",
    "---",
    "",
  ].join("\n");

  const body = parsed.notes.map(noteToMarkdown).join("\n");
  await writeFile(join(CORPUS_DIR, month.outFile), header + body);

  return { month: month.label, count: parsed.notes.length, outFile: month.outFile };
}

function truncatePersonaForPrompt(persona: string): string {
  // Strip the dataset-builder marker blocks (NEEDS YOUR VOICE notes etc) and
  // keep the substantive content. Token budget: ~3-4k tokens.
  return persona
    .replace(/^> \*\*TEMPLATE NOTES.*?\*\*[^\n]*\n+/m, "")
    .replace(/> \*\*THIS[^\n]+VOICE[^\n]+\*\*[^\n]+(\n>[^\n]*)*/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function sampleSeeds(seeds: string): string {
  const blocks = seeds.split(/^### Note /m).slice(1);
  const pick = [1, 4, 6, 9, 13, 16, 20].filter((i) => i <= blocks.length);
  return pick.map((i) => `### Note ${blocks[i - 1]}`).join("\n");
}

function extractWriters(seeds: string): string[] {
  const matches = seeds.matchAll(/^- \*\*Writer:\*\*\s*(.+)$/gm);
  const set = new Set<string>();
  for (const m of matches) set.add(m[1].trim());
  return Array.from(set);
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "OPENAI_API_KEY not set. Make sure .env.local has it and run with `bun --env-file=.env.local scripts/generate-corpus.ts`.",
    );
    process.exit(1);
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  console.log(`Using model: ${model}`);

  console.log(`Person: ${PERSON_ID} (loading from ${PERSON_DIR})`);
  const [persona, patterns, seeds] = await Promise.all([
    readFile(join(PERSON_DIR, "persona-template.md"), "utf8"),
    readFile(join(PERSON_DIR, "embedded-patterns.md"), "utf8"),
    readFile(join(CORPUS_DIR, "2026-01-seed-notes.md"), "utf8"),
  ]);

  const personaSummary = truncatePersonaForPrompt(persona);
  const styleSamples = sampleSeeds(seeds);
  const writers = extractWriters(seeds);
  const displayName =
    persona.match(/^#\s+About me\s+[—–-]\s+(.+)$/m)?.[1]?.trim() ?? PERSON_ID;

  console.log(`Display name: ${displayName}`);
  console.log(`Writers from seeds (${writers.length}): ${writers.join(", ")}`);

  if (writers.length === 0) {
    throw new Error(
      `No writers found in seed notes at ${join(CORPUS_DIR, "2026-01-seed-notes.md")}. Cannot generate without a writer pool.`,
    );
  }

  const client = new OpenAI({ apiKey });

  console.log("\nGenerating 4 months in parallel… (~60-90 sec)\n");
  const t0 = Date.now();

  const results = await Promise.allSettled(
    MONTHS.map((m) =>
      generateMonth(client, model, m, displayName, personaSummary, patterns, styleSamples, writers).then((r) => {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  [+${elapsed}s] ${r.month}: ${r.count} notes → ${r.outFile}`);
        return r;
      }),
    ),
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`\n${failures.length} month(s) failed:`);
    for (const f of failures) {
      if (f.status === "rejected") console.error(`  - ${f.reason}`);
    }
    process.exit(1);
  }

  const total = results
    .filter((r) => r.status === "fulfilled")
    .reduce((acc, r) => (r.status === "fulfilled" ? acc + r.value.count : acc), 0);

  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s. Generated ${total} notes.`);
}

await main();
