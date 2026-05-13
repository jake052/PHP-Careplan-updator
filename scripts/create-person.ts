#!/usr/bin/env bun
/**
 * Bootstrap a new fictional supported person's full dataset:
 *   - persona-template.md
 *   - outdated-care-plan-template.md
 *   - embedded-patterns.md
 *   - notes-corpus/2026-01-seed-notes.md   (20 hand-crafted seeds)
 *
 * Then run scripts/generate-corpus.ts pointed at the new person to fill
 * Feb-May.
 *
 * Usage:
 *   bun --env-file=.env.local scripts/create-person.ts
 *
 * The brief is hard-coded below — edit the PERSON constant to bootstrap
 * a different person.
 */

import OpenAI from "openai";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const PROJECT_ROOT = join(SCRIPT_DIR, "..");

interface PersonBrief {
  id: string;
  displayName: string;
  preferredName: string;
  age: number;
  pronouns: string;
  service: {
    name: string;
    type: string;
    size: number;
    town: string;
    county: string;
  };
  diagnoses: string[];
  communication: string;
  family: string;
  likes: string[];
  triggers: string[];
  contrast_with_sam: string;
  patterns: Array<{
    name: string;
    description: string;
    window: string;
    target_section: string;
  }>;
  staff_team: string[];
}

const PERSON: PersonBrief = {
  id: "maya",
  displayName: "Maya Okafor",
  preferredName: "Maya",
  age: 24,
  pronouns: "she/her",
  service: {
    name: "Linden House",
    type: "small supported living",
    size: 5,
    town: "Sheffield",
    county: "South Yorkshire",
  },
  diagnoses: [
    "Autism Spectrum Condition (Level 1, no learning disability)",
    "Generalised Anxiety Disorder",
    "Selective Mutism (speaks fluently at home with family; whispers occasionally with one key worker; communicates with staff via a whiteboard and a notes app on her phone)",
    "IBS",
  ],
  communication:
    "Speaks fluently and at length with her mum, dad, and older sister at home. Does NOT speak to staff in 95% of interactions. Communicates with staff via: a small whiteboard kept in her room, a notes app on her iPhone (preferred), and occasional whispered single words with one specific staff member (her keyworker). When stressed, she writes one-word answers or stops writing entirely.",
  family:
    "Mum Grace (works in pharmacy, primary contact), Dad Stephen (separated from Grace, sees Maya monthly), older sister Ada (27, lives in Manchester, weekly FaceTime). Family cat Pepper lives with Mum.",
  likes: [
    "Drawing (mostly botanical pencil sketches; she has filled 14 sketchbooks)",
    "Audiobooks (Becky Chambers, Ursula Le Guin)",
    "Oat milk lattes from one specific cafe (Tamper, on Sellers Wheel)",
    "The small garden at Linden House",
    "Her cat Pepper (visits at Mum's twice a month)",
  ],
  triggers: [
    "Open-plan loud spaces",
    "Surprise schedule changes",
    "Group meals — Maya eats in her room",
    "Loud male voices in particular",
    "Unscheduled visitors",
    "Phone calls (she will not answer the phone; she will text or use a notes app)",
  ],
  contrast_with_sam:
    "Where Sam communicates with limited speech + Makaton + a communication book, Maya is selectively mute — she can speak but chooses not to with staff. Her cognitive ability is intact; her difficulty is anxiety-driven and social. Pattern signals are about EMERGING trust with a new staff member, REDUCING meltdown frequency (opposite direction from Sam's escalating seizures), and self-regulation through gardening + drawing (a different mechanism from Sam's white-noise audio).",
  patterns: [
    {
      name: "Pattern 1: New trust with a specific staff member",
      description:
        "Maya has started whispering single words to Joel, a support worker who started in February 2026. By April she has whispered short two-word phrases. This is the first new staff member Maya has whispered to in 14 months at Linden House. The refreshed plan should name Joel specifically and propose a structured trust-building approach that other staff can learn from.",
      window: "First whisper: late February. Two-word phrases: April. Established trust: May.",
      target_section: "Communication & Social Connection — recommend a structured trust-building approach formalised in the plan, and note that Joel should be considered Maya's primary keyworker for routine support transitions.",
    },
    {
      name: "Pattern 2: Reducing meltdown frequency",
      description:
        "Maya's meltdowns (always private, internal, never aggressive — she withdraws to her room, may cry or self-harm via skin-picking) have reduced from approximately 3-4 per month in late 2025 to approximately 1 per month in the last 90 days. The reduction is linked to: a new sensory regulation routine (weighted blanket + audiobook before bed), better PRN use (Diazepam 2mg used proactively when she signals anxiety on her whiteboard rather than reactively after a meltdown), and the addition of gardening time.",
      window: "Reduction visible from March onwards.",
      target_section: "Positive Behaviour Support — refresh the PBS section with the specific reduction data and recommend continuing the proactive PRN protocol.",
    },
    {
      name: "Pattern 3: New food sensitivity emerging — dairy",
      description:
        "Maya has experienced increasing IBS symptoms over the last 60 days. Staff have noticed they correlate with dairy intake (specifically her cherished oat milk lattes from Tamper appear fine; lattes from elsewhere with cow's milk trigger symptoms within 1-2 hours). Maya has also stopped requesting cheese on her toast. This is a NEW sensitivity that needs a GP review and possible dietary referral.",
      window: "Pattern visible from March; clearest by April-May.",
      target_section: "Health — refresh the health section to flag the suspected dairy intolerance and recommend a GP review with a dietary diary attached.",
    },
    {
      name: "Pattern 4: Gardening + drawing as a self-regulation routine",
      description:
        "Maya has spent increasing time in the small garden at Linden House. She has begun bringing her sketchbook out and drawing what she sees — leaves, the bird feeder, a snail. Staff have observed that 30-60 minutes of garden + draw time reliably regulates her after a stressful day-service session. This is a self-discovered coping strategy that should be formalised in the plan.",
      window: "First emerged February; routine by April.",
      target_section: "Daily living + PBS — propose a SMART goal around protected garden time and explore whether Maya might enjoy a community gardening group as an outcome.",
    },
    {
      name: "Pattern 5: Clear preference for solo evening time",
      description:
        "Maya has been consistently writing on her whiteboard or texting via the notes app asking for the small lounge to herself between 19:00 and 21:00. Staff have informally accommodated this for the past 60 days with positive results (no meltdowns on evenings when she gets her solo time; one meltdown on the single evening it was disrupted by a new housemate's noise). The team have been doing the right thing informally; the refreshed plan should formalise it so it survives staff turnover.",
      window: "Pattern visible from March onwards.",
      target_section: "Daily routines + Social wellbeing — formalise the solo evening lounge time as a documented preference with a clear staff protocol.",
    },
  ],
  staff_team: [
    "Karen Whitfield, Registered Manager (RM) — long-standing, calm, primary point of escalation",
    "Joel Reeves, Support Worker (SW) — started February 2026, age 26, soft-spoken male voice; Maya has whispered to him (significant)",
    "Priya Tan, Support Worker (SW) — 3 years at Linden, Maya's current key worker, no whispered words yet but Maya texts her freely",
    "Helen Mort, Deputy Manager (DM) — observant, writes the richest notes",
    "Dani Adesina, Support Worker (SW) — newer, 4 months in post, still learning Maya's preferences",
  ],
};

interface GenerationSpec {
  outputFile: string;
  description: string;
  systemPrompt: string;
  userPromptBuilder: (person: PersonBrief) => string;
}

const SPECS: GenerationSpec[] = [
  {
    outputFile: "persona-template.md",
    description: "Persona profile",
    systemPrompt: `You write fictional supported-living personas for a UK care-sector AI demo. Output a single markdown document that follows EXACTLY this section structure:

# About me — <full name>

## One-page read
(2-3 paragraphs introducing the person.)

## My life so far
(Brief biographical narrative, ~250-400 words. Include education, family changes, moves, key transitions.)

## What is important to me now
(Bulleted list using "X said \"...\" (mm/yy)" format. 6-8 items. Include the person's own voice and family/staff observations.)

## My dreams and aspirations
(Generic outdated goals AND a draft of refreshed SMART goals the refresh might propose, grounded in the patterns brief.)

## How I communicate
### Communication passport
### How <Name> will communicate with you
### How you should communicate with <Name>
### If <Name> does X, do Y
(Markdown table with at least 5 rows. Include real frontline operational reads.)
### What helps <Name>
### Things to avoid

## About my health
### Health overview
### Mental health
### My medication schedule
(Markdown table. Include realistic UK meds for the diagnoses in the brief.)

## My life
### Daily routines
(Morning / day / evening / night — specific times.)
### Weekly routines
(Markdown table by day.)
### Personal care
### Eating and drinking
### Active support plans
(Step-by-step protocols for 2-3 key activities.)
### Social and emotional wellbeing
### Finances
### My family, friends and network
(Markdown table.)

### Positive Behaviour Support
**When <Name> is happy:** ...
**When <Name> is moving off baseline:** ...
**When <Name> is in crisis:** ...
**Recovering from crisis:** ...

RULES:
- Stay strictly within the brief provided. Do NOT invent diagnoses or family beyond what's specified.
- Use UK English throughout (organisation, behaviour, supermarket, mum).
- Include UK care-sector specifics: CQC awareness, MAR sheet, PBS, BPS, SALT, OT references where relevant.
- Person-first language. Respectful, plain-spoken. No "inspirational" tone. No "empowerment" or "vulnerability" performative language.
- Specific, not generic. Real placenames, real prescription names, realistic times.`,
    userPromptBuilder: (p) =>
      `Generate the persona document for:

NAME: ${p.displayName} (preferred: ${p.preferredName})
AGE: ${p.age}
PRONOUNS: ${p.pronouns}
SERVICE: ${p.service.name}, a ${p.service.size}-person ${p.service.type} service in ${p.service.town}, ${p.service.county}.
DIAGNOSES: ${p.diagnoses.join("; ")}
COMMUNICATION: ${p.communication}
FAMILY: ${p.family}
LIKES: ${p.likes.join("; ")}
TRIGGERS: ${p.triggers.join("; ")}
STAFF TEAM: ${p.staff_team.join("; ")}

IMPORTANT: This persona will be paired with embedded patterns about her recent life. The patterns are:
${p.patterns.map((pat) => `- ${pat.name}: ${pat.description}`).join("\n")}

The persona should reflect the BASELINE for these patterns — i.e. what Maya was like BEFORE the recent changes. So:
- The "How <Name> will communicate" section should describe baseline (no whispering to Joel yet — but you can hint at the keyworker structure).
- The PBS section should describe baseline (meltdown frequency at 3-4/month, not the reduced state).
- The health section should NOT yet mention dairy sensitivity.
- The daily routines should NOT yet mention protected garden time or solo evening time as formalised.
- The dreams and aspirations should have outdated 2024 goals + draft refreshed SMART goals (which the refresh might propose later) covering all 5 patterns.

Output a single markdown document. No preamble. Start with "# About me — ${p.displayName}".`,
  },
  {
    outputFile: "outdated-care-plan-template.md",
    description: "Outdated stale care plan",
    systemPrompt: `You write deliberately stale, generic, vague UK care plans for a fictional supported-living demo. The plan should LOOK COMPLETE but be obviously stale — generic language, no measurable goals, no recent pattern signals, dated section structure. The point is for an AI refresh to have OBVIOUS room to improve.

Use this fixed structure (10 sections, exactly):

# Care plan: <full name>

**Service user:** ...
**Date of plan:** ... *(last reviewed N months ago)*
**Author:** ...
**Next review due:** ... *(overdue if applicable)*
**Version:** ...

## Section 1 — Person-centred summary
(One generic paragraph. Mention diagnoses + service. Do NOT mention any of the recent patterns.)

## Section 2 — Goals and aspirations
(Markdown table with vague unmeasurable goals like "develop social skills" or "engage more in the community". No SMART criteria. No dates.)

## Section 3 — Communication
(Stub paragraph. Reference comms style at a generic level. No specific recent vocabulary, no specific staff names.)

## Section 4 — Health
(Generic. Mention diagnoses but no recent changes.)

## Section 5 — Daily living
(Single paragraph, no detail.)

## Section 6 — Risk assessments
(Markdown table, 3 rows max.)

## Section 7 — Mental Capacity & Best Interests
(Single paragraph.)

## Section 8 — Positive Behaviour Support
(Single paragraph, generic.)

## Section 9 — Family and external network
(Single paragraph.)

## Section 10 — Sign-off
(Three sign-off lines: staff, family, service user.)

RULES:
- Plan was "last reviewed" approximately 14 months ago.
- Use UK English. UK care sector terminology.
- Generic on PURPOSE. No specifics that the recent shift notes corpus would surface in a refresh.
- No mention of the 5 patterns in the brief.
- Sign-off uses realistic UK initials.`,
    userPromptBuilder: (p) =>
      `Generate the OUTDATED care plan for:

NAME: ${p.displayName} (preferred: ${p.preferredName})
AGE: ${p.age}
SERVICE: ${p.service.name}, ${p.service.town}, ${p.service.county}
DIAGNOSES: ${p.diagnoses.join("; ")}
FAMILY: ${p.family}

The plan was last reviewed 14 months ago by ${p.staff_team[0]}.

Output ONLY the markdown plan, no preamble or commentary.`,
  },
  {
    outputFile: "embedded-patterns.md",
    description: "Embedded patterns answer key",
    systemPrompt: `You write the "answer key" document for a UK care-plan refresh demo. The document lists the patterns the refresh should surface, with for each:

- The pattern statement
- Window of emergence (when in the notes corpus it becomes visible)
- Evidence trail (approximate count of notes that carry the signal)
- Refreshed-plan target (where in the plan the pattern should land + suggested wording)
- Verification (binary pass/fail the tester can check)

Then end with a "How to use this file when grading the demo" section and a 5-row grading table template.

Use the structure of an existing answer-key document. Be specific. Use UK care language.`,
    userPromptBuilder: (p) =>
      `Write the embedded patterns document for ${p.displayName}.

Brief:
${p.patterns.map((pat, i) => `\nPattern ${i + 1}: ${pat.name}\nDescription: ${pat.description}\nWindow: ${pat.window}\nWhere in refreshed plan: ${pat.target_section}`).join("\n")}

Reference the service: ${p.service.name}, ${p.service.size}-person ${p.service.type}, ${p.service.town}.
Reference the staff team where relevant: ${p.staff_team.join("; ")}.

Output ONLY the markdown document, no preamble.

Start with: # Embedded patterns: the demo's answer key (${p.displayName})`,
  },
  {
    outputFile: "notes-corpus/2026-01-seed-notes.md",
    description: "January 2026 seed notes (20)",
    systemPrompt: `You write fictional shift notes for a UK supported-living service. Output a single markdown document containing exactly 20 seed notes for January 2026, used as the voice anchor for later AI-generated batches.

Each note has this exact structure:

### Note <ID>
- **Date:** YYYY-MM-DD
- **Time:** HH:MM
- **Writer:** <name, role abbreviation>
- **Type:** <morning | day | evening | night | family-contact | medical | incident | peer | community>
- **Quality:** <thin | mid | rich>

<Note body — 1-5 paragraphs depending on quality tier>

---

Rules:
- 20 notes total, IDs 001 through 020 (zero-padded).
- Dates spread across Jan 2-21, 2026.
- Quality distribution: ~6 thin, ~10 mid, ~4 rich.
- Use 4 different writers from the brief.
- Stay STRICTLY in the persona — do not invent details outside the brief.
- The 20 seed notes establish BASELINE behaviour. Hint at 1-2 patterns subtly but do not establish them yet (patterns emerge across Feb-May in later batches).
- UK English, UK care-sector specifics.

After the 20 notes, append a "## Notes for the dataset builder" section explaining where pattern signal is seeded.`,
    userPromptBuilder: (p) =>
      `Write 20 seed shift notes for ${p.preferredName} (${p.displayName}), January 2026.

Persona brief:
- Age ${p.age}, ${p.pronouns}, at ${p.service.name} (${p.service.size}-person service, ${p.service.town})
- Diagnoses: ${p.diagnoses.join("; ")}
- Communication: ${p.communication}
- Family: ${p.family}
- Likes: ${p.likes.join("; ")}
- Triggers: ${p.triggers.join("; ")}

Staff writers (vary across notes):
${p.staff_team.map((s) => `- ${s}`).join("\n")}

These 20 January seeds establish BASELINE. Subtly hint at:
- The new SW Joel being present at the service from late February — so in late January there might be ONE note mentioning he's started shadow shifts, no whispering yet.
- Maya's current meltdown frequency at the higher (pre-reduction) baseline — include 1-2 incident notes.
- Routine garden visits but not yet the formalised regulation pattern.
- A typical evening pattern where Maya retreats to her room or asks for the lounge.

DO NOT yet introduce:
- Joel and Maya whispering (that emerges late February)
- Dairy sensitivity (emerges March)
- Formalised solo evening lounge time
- The reduction in meltdowns

Output the markdown directly. Start with: # Seed notes — January 2026`,
  },
];

async function generateOne(
  client: OpenAI,
  model: string,
  spec: GenerationSpec,
  person: PersonBrief,
  outputDir: string,
): Promise<{ file: string; chars: number }> {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: spec.systemPrompt },
      { role: "user", content: spec.userPromptBuilder(person) },
    ],
    temperature: 0.6,
    max_tokens: 16000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`Empty response for ${spec.description}`);
  }

  const cleaned = content.replace(/^```markdown\n?/, "").replace(/\n?```$/, "");

  const outPath = join(outputDir, spec.outputFile);
  await mkdir(join(outPath, ".."), { recursive: true });
  await writeFile(outPath, cleaned);
  return { file: spec.outputFile, chars: cleaned.length };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY not set. Run with `bun --env-file=.env.local scripts/create-person.ts`.");
    process.exit(1);
  }
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  console.log(`Using model: ${model}`);
  console.log(`Creating person: ${PERSON.displayName} (id: ${PERSON.id})`);

  const outputDir = join(PROJECT_ROOT, "data", "people", PERSON.id);
  await mkdir(outputDir, { recursive: true });

  const client = new OpenAI({ apiKey });

  console.log("\nGenerating 4 documents in parallel…");
  const t0 = Date.now();

  const results = await Promise.allSettled(
    SPECS.map((spec) =>
      generateOne(client, model, spec, PERSON, outputDir).then((r) => {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  [+${elapsed}s] ${spec.description}: ${r.chars} chars → ${r.file}`);
        return r;
      }),
    ),
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`\n${failures.length} document(s) failed:`);
    for (const f of failures) {
      if (f.status === "rejected") console.error(`  - ${f.reason}`);
    }
    process.exit(1);
  }

  console.log(
    `\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s. Person ${PERSON.id} bootstrapped at data/people/${PERSON.id}/`,
  );
  console.log(`\nNext: run \`bun --env-file=.env.local scripts/generate-corpus.ts --person=${PERSON.id}\` to fill Feb-May.`);
}

await main();
