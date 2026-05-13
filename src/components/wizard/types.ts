import type { EvidenceEntry, RecommendedAction } from "../../lib/types";

export type WizardStep = "idle" | "generating" | "patterns" | "actions" | "plan" | "signoff";

export type DecisionStatus = "pending" | "accepted" | "edited" | "rejected";

export interface PatternDecision {
  index: number;
  status: DecisionStatus;
  editedClaim: string | null;
  reviewerNote: string;
  decidedAt: string | null;
}

export interface ActionDecision {
  index: number;
  status: DecisionStatus;
  editedAction: string | null;
  editedPriority: "high" | "medium" | "low" | null;
  reviewerNote: string;
  decidedAt: string | null;
}

export interface Signoff {
  reviewerName: string;
  reviewerRole: string;
  reviewerNotes: string;
  signedAt: string | null;
}

export function effectiveClaim(entry: EvidenceEntry, decision: PatternDecision): string {
  return decision.status === "edited" && decision.editedClaim ? decision.editedClaim : entry.claim;
}

export function effectiveAction(
  action: RecommendedAction,
  decision: ActionDecision,
): { action: string; priority: "high" | "medium" | "low" } {
  return {
    action: decision.status === "edited" && decision.editedAction ? decision.editedAction : action.action,
    priority: decision.status === "edited" && decision.editedPriority ? decision.editedPriority : action.priority,
  };
}
