import { z } from "zod";

export const SourceCitation = z.object({
  noteId: z.string().describe("e.g. '001' from the corpus note header"),
  date: z.string().describe("YYYY-MM-DD"),
  snippet: z.string().describe("verbatim snippet from the note that backs this claim"),
});

export const EvidenceEntry = z.object({
  claim: z.string().describe("the specific claim from the refreshed plan"),
  section: z.string().describe("which section of the refreshed plan this claim lives in"),
  sources: z.array(SourceCitation).min(1),
  confidence: z.enum(["high", "medium", "low"]),
});

export const ActionType = z.enum([
  "observation_only",
  "plan_update",
  "support_routine_change",
  "clinician_escalation",
  "meeting_convene",
]);

export const RecommendedAction = z.object({
  action: z.string(),
  rationale: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  type: ActionType,
  escalateTo: z
    .string()
    .nullable()
    .describe(
      "Set only when type is 'clinician_escalation'. The role of the appropriate professional, e.g. 'GP', 'neurologist', 'dietitian', 'SALT', 'OT', 'community LD nurse'. Null otherwise.",
    ),
});

export const RefreshOutput = z.object({
  refreshedPlan: z
    .string()
    .describe("the full refreshed care plan in markdown with inline [Note NNN] citations"),
  evidenceTrail: z.array(EvidenceEntry).min(5),
  recommendedActions: z.array(RecommendedAction).min(1),
});

export type SourceCitation = z.infer<typeof SourceCitation>;
export type EvidenceEntry = z.infer<typeof EvidenceEntry>;
export type RecommendedAction = z.infer<typeof RecommendedAction>;
export type RefreshOutput = z.infer<typeof RefreshOutput>;
export type ActionType = z.infer<typeof ActionType>;
