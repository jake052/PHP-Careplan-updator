import { getLlmClient } from "./llm";
import { type Dataset, formatNotesForPrompt } from "./dataset";
import { RefreshOutput } from "./types";

const SYSTEM_PROMPT = `You are a senior UK registered manager refreshing a care plan for a person in a small learning-disability and autism supported-living service. You have:

- The supported person's persona profile.
- Their CURRENT (stale) care plan, last updated 14 months ago.
- ~120 days of shift notes recorded by frontline support workers.

Your job is to produce a refreshed care plan grounded in the shift notes, AND a machine-readable evidence trail linking every load-bearing claim to specific source notes.

REQUIREMENTS:

1. The refreshed plan must cover all sections of the outdated plan, refreshed with the last 90-120 days of notes. Add new sections (e.g. sensory preferences, new friendships) where the notes justify them.

2. Surface significant patterns visible in the notes but absent from the outdated plan: clinical pattern changes (e.g. seizure timing), new sensory preferences, new peer relationships, new communication skills, reduced tolerances. Be specific. Cite source notes inline using the exact format \`[Note NNN, YYYY-MM-DD]\`.

3. Apply UK regulatory framing: CQC "Right Support, Right Care, Right Culture" for LD/autism services, Mental Capacity Act 2005 references where relevant, NICE NG93 (autism) / NG142 (LD) language where appropriate.

4. For every load-bearing claim, attach a confidence rating in the evidence trail: HIGH (multiple consistent notes), MEDIUM (single rich note or pattern across thin notes), LOW (suggestive but not conclusive). Be honest.

5. Do NOT invent diagnoses, family members, addresses, or details not present in the inputs. If a section of the plan cannot be refreshed because the notes lack signal, say so explicitly.

═══════════════════════════════════════════════════════════════
SCOPE OF PRACTICE — CRITICAL. READ TWICE.
═══════════════════════════════════════════════════════════════

You are NOT a clinician. PHP is software, not a medical device. The supported person's clinical care is the responsibility of their GP, neurologist, dietitian, SALT, OT, psychiatrist, or other appropriately qualified professionals. Your job is to SURFACE patterns; their job is to DECIDE clinical action.

Every recommendedAction MUST fall into one of these five lanes, set in the action's "type" field:

A. **observation_only** — Acknowledge a positive or stable pattern. No action required. Use when notes evidence something working well that should be reflected in the plan as currently positive. Example: *"Sam's bedtime rain-sound routine is settling him reliably; continue and review at next plan refresh."*

B. **plan_update** — Update plan wording only. Pure documentation. The pattern is already being managed; the plan just needs to catch up. Example: *"Add Sam's new friendship with Mia at day service to the Social and Emotional Wellbeing section."*

C. **support_routine_change** — A change to the daily/weekly routine that the registered manager can authorise within their scope. Example: *"Replace the weekly large-supermarket shop with a fortnightly Co-op visit and delivery between."* NEVER includes medication, diet restrictions, clinical interventions, or anything requiring clinical authority.

D. **clinician_escalation** — A pattern that warrants raising with an appropriate clinical professional for THEM to decide. Phrasing must be neutral: *"worth raising with [their GP / neurologist / dietitian / SALT / OT / community LD nurse / dentist] at the next review"*. Set the \`escalateTo\` field to the role of the appropriate professional. NEVER recommend a specific clinical action; only the escalation. Example: *"Worth raising the afternoon seizure clustering with Sam's GP at his next routine review, for their clinical assessment."* — NOT *"Conduct a medication timing review."*

E. **meeting_convene** — Arrange a meeting (best interests, PATH, MDT, family meeting). The meeting is the action; the outcome is for the meeting to decide. Example: *"Convene a best-interests meeting with Sam's mum to discuss formalising the new bedtime sensory routine."*

ABSOLUTE PROHIBITIONS:
- Do NOT recommend medication changes, additions, withdrawals, or timing adjustments. Ever. Not even with "discuss" framing.
- Do NOT recommend dietary restrictions, eliminations, or supplements.
- Do NOT make clinical inferences (e.g. "Sam may be developing X condition", "this looks like Y").
- Do NOT prescribe interventions a clinician would prescribe.
- Do NOT recommend mental health interventions, talking therapies, or psychiatric review framing beyond escalation.

If a pattern in the evidence is clinical in nature (seizure pattern, suspected sensitivity, weight change, sleep disturbance, behavioural change suggesting medical cause), the action is ALWAYS \`clinician_escalation\`. The rationale should describe the observable pattern (what the notes show); it must NOT speculate about cause or recommend specific clinical action.

The recommendedAction rationale must be observation-grounded ("notes show X across N entries between dates Y-Z") and clinically silent ("the appropriate professional will determine cause and any action").

═══════════════════════════════════════════════════════════════

OUTPUT FORMAT: a single JSON object matching the schema. Markdown only inside the refreshedPlan string. No prose outside the JSON.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    refreshedPlan: {
      type: "string",
      description:
        "The full refreshed care plan as markdown with inline [Note NNN, YYYY-MM-DD] citations.",
    },
    evidenceTrail: {
      type: "array",
      minItems: 5,
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          section: { type: "string" },
          sources: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                noteId: { type: "string" },
                date: { type: "string" },
                snippet: { type: "string" },
              },
              required: ["noteId", "date", "snippet"],
              additionalProperties: false,
            },
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["claim", "section", "sources", "confidence"],
        additionalProperties: false,
      },
    },
    recommendedActions: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          rationale: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          type: {
            type: "string",
            enum: [
              "observation_only",
              "plan_update",
              "support_routine_change",
              "clinician_escalation",
              "meeting_convene",
            ],
          },
          escalateTo: {
            type: ["string", "null"],
            description:
              "When type is 'clinician_escalation', the role of the professional (GP, neurologist, dietitian, SALT, OT, community LD nurse, dentist, psychiatrist). Null otherwise.",
          },
        },
        required: ["action", "rationale", "priority", "type", "escalateTo"],
        additionalProperties: false,
      },
    },
  },
  required: ["refreshedPlan", "evidenceTrail", "recommendedActions"],
  additionalProperties: false,
} as const;

export async function runRefresh(
  dataset: Dataset,
  opts: { liveNoteIds?: string[] } = {},
) {
  const { client, model, provider } = getLlmClient();

  const liveIds = new Set(opts.liveNoteIds ?? []);
  const historicNotes = dataset.notes.filter((n) => !liveIds.has(n.id));
  const liveNotes = dataset.notes.filter((n) => liveIds.has(n.id));

  const liveCitations = liveNotes
    .map((n) => `[Note ${n.id}, ${n.date}]`)
    .join(" / ");
  const liveIdList = liveNotes.map((n) => `"${n.id}"`).join(", ");
  const liveSection =
    liveNotes.length > 0
      ? [
          "## TODAY'S CAPTURES — fresh signal, must be cited",
          `These note(s) were recorded today by a frontline support worker. Their IDs are ${liveIdList} — these IDs are valid and exist in the dataset.\n\nHARD REQUIREMENTS (will fail validation if missed):\n  1. The literal string ${liveCitations} MUST appear at least once inside refreshedPlan markdown.\n  2. evidenceTrail MUST contain at least one entry whose sources[].noteId equals one of these IDs (${liveIdList}).\n\nUse the live note(s) to evidence patterns connecting today's signal to the historic 5-month trend. Do not substitute a similar-content historic note ID for a live ID; cite the live ID by its number.`,
          formatNotesForPrompt(liveNotes),
        ].join("\n\n")
      : "";

  const userPrompt = [
    "## PERSONA",
    dataset.persona,
    "## OUTDATED CARE PLAN (last refreshed 14 months ago)",
    dataset.outdatedPlan,
    "## HISTORIC SHIFT NOTES (most recent ~120 days)",
    formatNotesForPrompt(historicNotes),
    liveSection,
    "Refresh the care plan now, surfacing every significant pattern visible in the notes. Cite [Note NNN, YYYY-MM-DD] inline. Return JSON matching the schema.",
  ]
    .filter((s) => s.length > 0)
    .join("\n\n");

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "refresh_output",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Azure OpenAI returned an empty response.");
  }

  const parsed = RefreshOutput.parse(JSON.parse(raw));
  return { ...parsed, provider };
}
