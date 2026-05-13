#!/usr/bin/env bun
/**
 * Supplement the existing Feb-May corpus with more routine notes.
 *
 * Reads each month file, finds the highest existing note ID, and generates
 * a second batch that picks up from there with routine filler — DAILY
 * ROUTINES, not more pattern hits. The patterns already landed in batch 1;
 * batch 2 increases density without skewing the signal.
 *
 * Writes to:
 *   data/notes-corpus/2026-02-generated-batch2.md
 *   data/notes-corpus/2026-03-generated-batch2.md
 *   data/notes-corpus/2026-04-generated-batch2.md
 *   data/notes-corpus/2026-05-partial-batch2.md
 *
 * Run: bun --env-file=.env.local scripts/generate-corpus-batch2.ts
 */

import OpenAI from "openai";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const PROJECT_ROOT = join(SCRIPT_DIR, "..");
const DATA_DIR = join(PROJECT_ROOT, "data");
const CORPUS_DIR = join(DATA_DIR, "notes-corpus");

interface BatchSpec {
  label: string;
  sourceFile: string;
  outFile: string;
  count: number;
  dateRange: { from: string; to: string };
}

const BATCHES: BatchSpec[] = [
  {
    label: "February 2026 — batch 2 (routine fill)",
    sourceFile: "2026-02-generated.md",
    outFile: "2026-02-generated-batch2.md",
    count: 25,
    dateRange: { from: "2026-02-01", to: "2026-02-28" },
  },
  {
    label: "March 2026 — batch 2 (routine fill)",
    sourceFile: "2026-03-generated.md",
    outFile: "2026-03-generated-batch2.md",
    count: 30,
    dateRange: { from: "2026-03-01", to: "2026-03-31" },
  },
  {
    label: "April 2026 — batch 2 (routine fill)",
    sourceFile: "2026-04-generated.md",
    outFile: "2026-04-generated-batch2.md",
    count: 30,
    dateRange: { from: "2026-04-01", to: "2026-04-30" },
  },
  {
    label: "May 2026 — batch 2 (routine fill)",
    sourceFile: "2026-05-partial.md",
    outFile: "2026-05-partial-batch2.md",
    count: 15,
    dateRange: { from: "2026-05-01", to: "2026-05-12" },
  },
];

const NOTE_SCHEMA = {
  type: "object",
  properties: {
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          writer: { type: "string" },
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

const SYSTEM_PROMPT = `You are filling in routine shift notes for a UK supported-living service. The corpus already contains the significant pattern signals for this month — your job is NOT to add more clinical events, friendships, sensory preferences, or communication milestones. Your job is to add the BORING ROUTINE DAYS that real services have between the notable events.

NON-NEGOTIABLE RULES:

1. Stay strictly within Sam's persona. Verbal vocabulary ~30-40 words. No new diagnoses, family, addresses, schools.

2. Writers, in voice:
   - **Aisha Patel, SW** — newer (Oct 2025). Earnest, tentative. Usually 'mid'.
   - **Mark Davies, Sr SW** — long-serving senior. Terse. Source of most 'thin' notes.
   - **Priya Nair, DM** — deputy manager. Observant, person-centred. Most 'rich' notes.
   - **Tom Anderson, SW** — 2 years. Reliable mid. Best on medical.

3. Quality distribution: ~40% thin, 50% mid, 10% rich. Heavier on the routine end because these are routine notes.

4. DO NOT introduce or escalate the following patterns — they are already established in batch 1:
   - White noise / rain sounds at bedtime (you can mention briefly in passing: "rain sounds at bedtime as usual" or "settled with iPad"). Do NOT have Sam "discover" this — it's already routine.
   - Afternoon seizure clustering. NO new seizure logs in this batch. Sam can be "quiet after yesterday's seizure" but no new seizures.
   - Supermarket tolerance decline. NO new supermarket incidents. Can mention a routine shopping trip went OK or a delivery happened.
   - Mia friendship. Routine mentions OK ("sat with Mia at lunch") but no new milestones in the friendship.
   - "More" sign emergence. Routine use OK ("Sam signed 'more' for second helping") but no new contexts.

5. Add ROUTINE CONTENT instead:
   - Standard morning routines (medication, breakfast, dressing)
   - Day-service activities (cooking, art, music, gardening) on weekdays
   - Tuesday swimming, Wednesday/Friday train station visits
   - Saturday pub lunches, Sunday Anna visits
   - Wednesday evening Owen FaceTime calls
   - Evening winding-down, watching Thomas, iPad time
   - Brief thin notes from waking-night staff
   - Personal care notes (shower days are every third day)
   - Variety of weekday-vs-weekend rhythms

6. Times realistic for the type (morning 07-10, day 10-16, evening 17-21, night 21:30-07).

7. Note IDs are zero-padded 3-digit strings, sequential from the starting ID provided.

8. Output is JSON matching the schema. NOTHING outside the JSON.`;

function buildUserPrompt(
  batch: BatchSpec,
  startId: number,
  personaSummary: string,
  styleSamples: string,
  existingDatesSummary: string,
): string {
  return [
    `## PERSONA (Sam Hartley)`,
    personaSummary,
    "",
    `## STYLE REFERENCE — January seeds (match this voice)`,
    styleSamples,
    "",
    `## EXISTING ${batch.label.split(" — ")[0]} COVERAGE`,
    "Dates already covered in batch 1:",
    existingDatesSummary,
    "",
    "Your batch should cover OTHER DATES in this month that aren't yet represented, or add a second/third routine note to dates that only have one note. The aim is denser day-by-day coverage of routine life.",
    "",
    `## GENERATION SPEC`,
    `Month: ${batch.label}`,
    `Date range: ${batch.dateRange.from} to ${batch.dateRange.to}`,
    `Target count: ${batch.count}`,
    `Starting note ID: ${String(startId).padStart(3, "0")}`,
    "",
    `Generate ${batch.count} ROUTINE filler notes covering days/times not heavily represented in batch 1. NO new pattern signals. Match voice exactly.`,
    "",
    `Output JSON with a "notes" array of exactly ${batch.count} note objects.`,
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

interface ParsedExistingNote {
  id: number;
  date: string;
}

function parseExistingNotes(markdown: string): ParsedExistingNote[] {
  const blocks = markdown.split(/^### Note /m).slice(1);
  const out: ParsedExistingNote[] = [];
  for (const block of blocks) {
    const idMatch = block.match(/^(\d+)/);
    const dateMatch = block.match(/- \*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/);
    if (idMatch && dateMatch) {
      out.push({ id: parseInt(idMatch[1], 10), date: dateMatch[1] });
    }
  }
  return out;
}

function summariseDates(existing: ParsedExistingNote[]): string {
  const dateCounts = new Map<string, number>();
  for (const n of existing) {
    dateCounts.set(n.date, (dateCounts.get(n.date) ?? 0) + 1);
  }
  return Array.from(dateCounts.entries())
    .sort()
    .map(([d, c]) => `${d} (${c} notes)`)
    .join(", ");
}

async function generateBatch(
  client: OpenAI,
  model: string,
  batch: BatchSpec,
  personaSummary: string,
  styleSamples: string,
): Promise<{ label: string; count: number; outFile: string }> {
  const existingPath = join(CORPUS_DIR, batch.sourceFile);
  const existingMd = await readFile(existingPath, "utf8");
  const existing = parseExistingNotes(existingMd);
  if (existing.length === 0) {
    throw new Error(`No existing notes found in ${batch.sourceFile}`);
  }
  const maxId = existing.reduce((m, n) => Math.max(m, n.id), 0);
  const startId = maxId + 1;
  const datesSummary = summariseDates(existing);

  const userPrompt = buildUserPrompt(batch, startId, personaSummary, styleSamples, datesSummary);

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
  if (!raw) throw new Error(`Empty response for ${batch.label}`);
  const parsed = JSON.parse(raw) as {
    notes: Array<Parameters<typeof noteToMarkdown>[0]>;
  };

  const header = [
    `# Generated notes — ${batch.label}`,
    "",
    `> AI-generated routine filler. No new pattern signals; the patterns landed in batch 1.`,
    `> Spot-check every 20th note and edit anything that drifts from Sam's voice.`,
    "",
    "---",
    "",
  ].join("\n");

  const body = parsed.notes.map(noteToMarkdown).join("\n");
  await writeFile(join(CORPUS_DIR, batch.outFile), header + body);

  return { label: batch.label, count: parsed.notes.length, outFile: batch.outFile };
}

function truncatePersonaForPrompt(persona: string): string {
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

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "OPENAI_API_KEY not set. Run with `bun --env-file=.env.local scripts/generate-corpus-batch2.ts`.",
    );
    process.exit(1);
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  console.log(`Using model: ${model}`);

  const [persona, seeds] = await Promise.all([
    readFile(join(DATA_DIR, "persona-template.md"), "utf8"),
    readFile(join(CORPUS_DIR, "2026-01-seed-notes.md"), "utf8"),
  ]);

  const personaSummary = truncatePersonaForPrompt(persona);
  const styleSamples = sampleSeeds(seeds);

  const client = new OpenAI({ apiKey });

  console.log("Generating batch-2 supplements for 4 months in parallel…\n");
  const t0 = Date.now();

  const results = await Promise.allSettled(
    BATCHES.map((b) =>
      generateBatch(client, model, b, personaSummary, styleSamples).then((r) => {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  [+${elapsed}s] ${r.label}: ${r.count} notes → ${r.outFile}`);
        return r;
      }),
    ),
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`\n${failures.length} batch(es) failed:`);
    for (const f of failures) {
      if (f.status === "rejected") console.error(`  - ${f.reason}`);
    }
    process.exit(1);
  }

  const total = results
    .filter((r) => r.status === "fulfilled")
    .reduce((acc, r) => (r.status === "fulfilled" ? acc + r.value.count : acc), 0);

  console.log(
    `\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s. Added ${total} routine notes.`,
  );
}

await main();
