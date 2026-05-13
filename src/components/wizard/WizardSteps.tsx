"use client";

import { useState } from "react";
import type { ActionType, EvidenceEntry, RecommendedAction, RefreshOutput } from "../../lib/types";

const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  observation_only: "Observation only",
  plan_update: "Plan update",
  support_routine_change: "Support routine change",
  clinician_escalation: "Clinician escalation",
  meeting_convene: "Convene a meeting",
};

function actionTypeClasses(t: ActionType): string {
  switch (t) {
    case "observation_only":
      return "border-pampas bg-cream text-stone";
    case "plan_update":
      return "border-pampas bg-cream text-bark";
    case "support_routine_change":
      return "border-sage bg-sage-tint text-bark";
    case "clinician_escalation":
      return "border-alert bg-rose-tint text-bark";
    case "meeting_convene":
      return "border-muted-gold bg-cream text-bark";
  }
}
import { PlanView } from "../PlanView";
import {
  type ActionDecision,
  type DecisionStatus,
  type PatternDecision,
  type Signoff,
  effectiveAction,
  effectiveClaim,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Shared atoms                                                      */
/* ------------------------------------------------------------------ */

function StatusPill({ status }: { status: DecisionStatus }) {
  const label =
    status === "accepted"
      ? "Accepted"
      : status === "edited"
        ? "Edited"
        : status === "rejected"
          ? "Rejected"
          : "Pending";

  const tone =
    status === "accepted"
      ? "border-sage bg-sage-tint text-bark"
      : status === "edited"
        ? "border-muted-gold bg-cream text-bark"
        : status === "rejected"
          ? "border-alert bg-rose-tint text-bark"
          : "border-pampas bg-cream text-stone";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {label}
    </span>
  );
}

function DecisionButtons({
  status,
  onAccept,
  onEdit,
  onReject,
  editing,
}: {
  status: DecisionStatus;
  onAccept: () => void;
  onEdit: () => void;
  onReject: () => void;
  editing: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onAccept}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
          status === "accepted"
            ? "border-sage bg-sage text-white"
            : "border-pampas bg-white text-walnut hover:border-sage hover:text-sage"
        }`}
      >
        Accept
      </button>
      <button
        type="button"
        onClick={onEdit}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
          editing || status === "edited"
            ? "border-muted-gold bg-muted-gold text-white"
            : "border-pampas bg-white text-walnut hover:border-muted-gold hover:text-bark"
        }`}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onReject}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
          status === "rejected"
            ? "border-alert bg-alert text-white"
            : "border-pampas bg-white text-walnut hover:border-alert hover:text-alert"
        }`}
      >
        Reject
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1: Patterns                                                  */
/* ------------------------------------------------------------------ */

export function PatternsStep({
  evidenceTrail,
  decisions,
  onChange,
  onCitationClick,
}: {
  evidenceTrail: EvidenceEntry[];
  decisions: PatternDecision[];
  onChange: (next: PatternDecision[]) => void;
  onCitationClick: (noteId: string, date: string) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftClaim, setDraftClaim] = useState<string>("");
  const [draftNote, setDraftNote] = useState<string>("");

  function setDecision(index: number, patch: Partial<PatternDecision>) {
    onChange(decisions.map((d) => (d.index === index ? { ...d, ...patch } : d)));
  }

  function accept(index: number) {
    setDecision(index, { status: "accepted", decidedAt: new Date().toISOString(), editedClaim: null });
    setEditingIndex(null);
  }

  function reject(index: number) {
    setDecision(index, { status: "rejected", decidedAt: new Date().toISOString(), editedClaim: null });
    setEditingIndex(null);
  }

  function startEdit(index: number, current: string) {
    setEditingIndex(index);
    setDraftClaim(current);
    const existing = decisions.find((d) => d.index === index);
    setDraftNote(existing?.reviewerNote ?? "");
  }

  function saveEdit(index: number) {
    setDecision(index, {
      status: "edited",
      editedClaim: draftClaim,
      reviewerNote: draftNote,
      decidedAt: new Date().toISOString(),
    });
    setEditingIndex(null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-pampas bg-white p-5 card-lift">
        <p className="text-sm text-walnut leading-relaxed">
          The AI surfaced <span className="font-medium text-bark">{evidenceTrail.length} patterns</span> from
          the shift notes. Decide which ones go into the refreshed plan. Edit any wording that isn&apos;t
          quite right. Reject anything that doesn&apos;t fit.
        </p>
        <p className="voice mt-3 text-sm">
          You know things the AI doesn&apos;t. Trust your read.
        </p>
      </div>

      <ul className="space-y-4">
        {evidenceTrail.map((entry, i) => {
          const decision = decisions[i];
          const claim = effectiveClaim(entry, decision);
          const isEditing = editingIndex === i;
          return (
            <li
              key={i}
              className="rounded-lg border border-pampas bg-white p-5 card-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusPill status={decision.status} />
                    <span className="text-xs text-stone">
                      {entry.section} · {entry.confidence} confidence
                    </span>
                  </div>

                  {!isEditing ? (
                    <p className="text-bark font-medium leading-snug">{claim}</p>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={draftClaim}
                        onChange={(e) => setDraftClaim(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-muted-gold bg-cream px-3 py-2 text-sm text-bark focus:outline-none focus:ring-2 focus:ring-muted-gold"
                      />
                      <input
                        type="text"
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        placeholder="Optional: why you edited this (for the audit trail)"
                        className="w-full rounded-md border border-pampas bg-white px-3 py-2 text-xs text-walnut focus:outline-none focus:ring-2 focus:ring-muted-gold"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(i)}
                          className="rounded-md border border-muted-gold bg-muted-gold px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                        >
                          Save edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="rounded-md border border-pampas bg-white px-3 py-1.5 text-xs font-medium text-walnut hover:border-stone"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    {entry.sources.map((s, j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => onCitationClick(s.noteId, s.date)}
                        className="rounded-full border border-pampas bg-cream px-2 py-0.5 text-xs font-medium text-bark hover:border-sage hover:text-sage transition"
                        title={s.snippet}
                      >
                        Note {s.noteId}
                      </button>
                    ))}
                  </div>
                </div>

                {!isEditing && (
                  <div className="shrink-0">
                    <DecisionButtons
                      status={decision.status}
                      onAccept={() => accept(i)}
                      onEdit={() => startEdit(i, claim)}
                      onReject={() => reject(i)}
                      editing={false}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2: Actions                                                   */
/* ------------------------------------------------------------------ */

export function ActionsStep({
  recommendedActions,
  decisions,
  onChange,
}: {
  recommendedActions: RecommendedAction[];
  decisions: ActionDecision[];
  onChange: (next: ActionDecision[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftAction, setDraftAction] = useState<string>("");
  const [draftPriority, setDraftPriority] = useState<"high" | "medium" | "low">("medium");

  function setDecision(index: number, patch: Partial<ActionDecision>) {
    onChange(decisions.map((d) => (d.index === index ? { ...d, ...patch } : d)));
  }

  function accept(index: number) {
    setDecision(index, { status: "accepted", decidedAt: new Date().toISOString() });
    setEditingIndex(null);
  }

  function reject(index: number) {
    setDecision(index, { status: "rejected", decidedAt: new Date().toISOString() });
    setEditingIndex(null);
  }

  function startEdit(index: number, action: RecommendedAction, decision: ActionDecision) {
    const eff = effectiveAction(action, decision);
    setEditingIndex(index);
    setDraftAction(eff.action);
    setDraftPriority(eff.priority);
  }

  function saveEdit(index: number) {
    setDecision(index, {
      status: "edited",
      editedAction: draftAction,
      editedPriority: draftPriority,
      decidedAt: new Date().toISOString(),
    });
    setEditingIndex(null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-pampas bg-white p-5 card-lift">
        <p className="text-sm text-walnut leading-relaxed">
          The AI proposed <span className="font-medium text-bark">{recommendedActions.length} actions</span>{" "}
          flowing from those patterns. Accept what makes sense, edit what doesn&apos;t quite read right,
          reject anything you don&apos;t buy.
        </p>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-5">
          <span className="rounded border border-pampas bg-cream px-2 py-1 text-stone">
            <span className="font-semibold uppercase tracking-wider">Observe</span> — nothing to do, just acknowledge
          </span>
          <span className="rounded border border-pampas bg-cream px-2 py-1 text-bark">
            <span className="font-semibold uppercase tracking-wider">Plan update</span> — wording only
          </span>
          <span className="rounded border border-sage bg-sage-tint px-2 py-1 text-bark">
            <span className="font-semibold uppercase tracking-wider">Routine change</span> — RM scope
          </span>
          <span className="rounded border border-alert bg-rose-tint px-2 py-1 text-bark">
            <span className="font-semibold uppercase tracking-wider">Escalate</span> — clinician decides
          </span>
          <span className="rounded border border-muted-gold bg-cream px-2 py-1 text-bark">
            <span className="font-semibold uppercase tracking-wider">Meeting</span> — convene the right people
          </span>
        </div>
        <p className="voice mt-3 text-sm">
          The AI surfaces patterns. Clinical decisions stay with clinicians. Always.
        </p>
      </div>

      <ul className="space-y-4">
        {recommendedActions.map((action, i) => {
          const decision = decisions[i];
          const eff = effectiveAction(action, decision);
          const isEditing = editingIndex === i;
          return (
            <li key={i} className="rounded-lg border border-pampas bg-white p-5 card-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <StatusPill status={decision.status} />
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${actionTypeClasses(action.type)}`}
                      title="The action lane this recommendation falls into. Clinical decisions stay with clinicians."
                    >
                      {ACTION_TYPE_LABEL[action.type]}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        eff.priority === "high"
                          ? "border-alert bg-rose-tint text-bark"
                          : eff.priority === "medium"
                            ? "border-muted-gold bg-cream text-bark"
                            : "border-pampas bg-cream text-stone"
                      }`}
                    >
                      {eff.priority} priority
                    </span>
                  </div>

                  {!isEditing ? (
                    <>
                      <p className="text-bark font-medium leading-snug">{eff.action}</p>
                      <p className="mt-2 text-xs text-walnut leading-relaxed">{action.rationale}</p>
                      {action.type === "clinician_escalation" && action.escalateTo && (
                        <p className="mt-2 text-xs text-bark">
                          <span className="font-semibold uppercase tracking-wider text-stone">
                            Escalate to:
                          </span>{" "}
                          {action.escalateTo}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={draftAction}
                        onChange={(e) => setDraftAction(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-muted-gold bg-cream px-3 py-2 text-sm text-bark focus:outline-none focus:ring-2 focus:ring-muted-gold"
                      />
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-stone">Priority:</span>
                        {(["high", "medium", "low"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setDraftPriority(p)}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                              draftPriority === p
                                ? "border-bark bg-bark text-white"
                                : "border-pampas bg-white text-walnut hover:border-stone"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(i)}
                          className="rounded-md border border-muted-gold bg-muted-gold px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                        >
                          Save edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="rounded-md border border-pampas bg-white px-3 py-1.5 text-xs font-medium text-walnut hover:border-stone"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="shrink-0">
                    <DecisionButtons
                      status={decision.status}
                      onAccept={() => accept(i)}
                      onEdit={() => startEdit(i, action, decision)}
                      onReject={() => reject(i)}
                      editing={false}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3: Plan review                                                */
/* ------------------------------------------------------------------ */

export function PlanStep({
  output,
  patternDecisions,
  actionDecisions,
  onCitationClick,
}: {
  output: RefreshOutput;
  patternDecisions: PatternDecision[];
  actionDecisions: ActionDecision[];
  onCitationClick: (noteId: string, date: string) => void;
}) {
  const acceptedPatterns = patternDecisions.filter(
    (d) => d.status === "accepted" || d.status === "edited",
  ).length;
  const rejectedPatterns = patternDecisions.filter((d) => d.status === "rejected").length;
  const acceptedActions = actionDecisions.filter(
    (d) => d.status === "accepted" || d.status === "edited",
  ).length;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-pampas bg-white p-5 card-lift">
        <p className="text-sm text-walnut leading-relaxed">
          Here&apos;s the AI&apos;s full draft of the refreshed plan. You&apos;ve accepted{" "}
          <span className="font-medium text-bark">
            {acceptedPatterns} of {patternDecisions.length}
          </span>{" "}
          patterns and{" "}
          <span className="font-medium text-bark">
            {acceptedActions} of {actionDecisions.length}
          </span>{" "}
          actions. Read the draft against your decisions.{" "}
          {rejectedPatterns > 0 && (
            <span>
              Rejected items will be flagged in the audit trail and the AI&apos;s next pass will know to
              skip them.
            </span>
          )}
        </p>
        <p className="voice mt-3 text-sm">
          Read it like it&apos;s going to CQC. Because it might.
        </p>
      </div>

      <div className="rounded-lg border border-pampas bg-white p-7 card-lift">
        <h3 className="font-display text-lg font-medium text-bark mb-4 pb-3 border-b border-pampas">
          Draft refreshed care plan
        </h3>
        <PlanView markdown={output.refreshedPlan} onCitationClick={onCitationClick} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 4: Sign-off + audit trail                                     */
/* ------------------------------------------------------------------ */

export function SignoffStep({
  output,
  patternDecisions,
  actionDecisions,
  signoff,
  onSignoffChange,
}: {
  output: RefreshOutput;
  patternDecisions: PatternDecision[];
  actionDecisions: ActionDecision[];
  signoff: Signoff;
  onSignoffChange: (next: Signoff) => void;
}) {
  const update = (patch: Partial<Signoff>) => onSignoffChange({ ...signoff, ...patch });

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-pampas bg-white p-5 card-lift">
        <p className="text-sm text-walnut leading-relaxed">
          The decision log below shows exactly what the AI surfaced and what you decided. This is the
          audit trail your CQC inspector will read. Add any final reviewer notes, then sign off.
        </p>
        <p className="voice mt-3 text-sm">
          AI surfaced. You decided. The trail is yours.
        </p>
      </div>

      <section className="rounded-lg border border-pampas bg-white p-6 card-lift">
        <h3 className="font-display text-base font-medium text-bark mb-4 pb-3 border-b border-pampas">
          Pattern decisions ({patternDecisions.length})
        </h3>
        <ul className="space-y-3">
          {output.evidenceTrail.map((entry, i) => {
            const d = patternDecisions[i];
            const claim = effectiveClaim(entry, d);
            return (
              <li key={i} className="border-l-2 border-pampas pl-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <StatusPill status={d.status} />
                  <span className="text-xs text-stone">
                    {entry.section} · sources: {entry.sources.map((s) => s.noteId).join(", ")}
                  </span>
                </div>
                <div className="text-bark leading-snug">{claim}</div>
                {d.status === "edited" && d.editedClaim !== entry.claim && (
                  <div className="mt-1 text-xs text-stone italic">
                    Original AI claim: <span className="line-through">{entry.claim}</span>
                  </div>
                )}
                {d.reviewerNote && (
                  <div className="mt-1 text-xs text-walnut">Note: {d.reviewerNote}</div>
                )}
                {d.decidedAt && (
                  <div className="mt-0.5 text-[10px] text-stone">
                    Decided {new Date(d.decidedAt).toLocaleString()}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-pampas bg-white p-6 card-lift">
        <h3 className="font-display text-base font-medium text-bark mb-4 pb-3 border-b border-pampas">
          Action decisions ({actionDecisions.length})
        </h3>
        <ul className="space-y-3">
          {output.recommendedActions.map((action, i) => {
            const d = actionDecisions[i];
            const eff = effectiveAction(action, d);
            return (
              <li key={i} className="border-l-2 border-pampas pl-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <StatusPill status={d.status} />
                  <span className="rounded-full border border-pampas bg-cream px-2 py-0.5 text-[10px] uppercase tracking-wider text-walnut">
                    {eff.priority}
                  </span>
                </div>
                <div className="text-bark leading-snug">{eff.action}</div>
                {d.status === "edited" && d.editedAction && d.editedAction !== action.action && (
                  <div className="mt-1 text-xs text-stone italic">
                    Original AI action: <span className="line-through">{action.action}</span>
                  </div>
                )}
                {d.decidedAt && (
                  <div className="mt-0.5 text-[10px] text-stone">
                    Decided {new Date(d.decidedAt).toLocaleString()}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-pampas bg-white p-6 card-lift">
        <h3 className="font-display text-base font-medium text-bark mb-4 pb-3 border-b border-pampas">
          Sign-off
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-stone uppercase tracking-wider mb-1">
              Reviewer name
            </label>
            <input
              type="text"
              value={signoff.reviewerName}
              onChange={(e) => update({ reviewerName: e.target.value })}
              placeholder="e.g. Ellie Manager"
              className="w-full rounded-md border border-pampas bg-white px-3 py-2 text-sm text-bark focus:outline-none focus:ring-2 focus:ring-sage"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone uppercase tracking-wider mb-1">
              Role
            </label>
            <input
              type="text"
              value={signoff.reviewerRole}
              onChange={(e) => update({ reviewerRole: e.target.value })}
              placeholder="Registered Manager"
              className="w-full rounded-md border border-pampas bg-white px-3 py-2 text-sm text-bark focus:outline-none focus:ring-2 focus:ring-sage"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-stone uppercase tracking-wider mb-1">
              Reviewer notes (optional)
            </label>
            <textarea
              value={signoff.reviewerNotes}
              onChange={(e) => update({ reviewerNotes: e.target.value })}
              rows={3}
              placeholder="Anything you want recorded with this refresh."
              className="w-full rounded-md border border-pampas bg-white px-3 py-2 text-sm text-walnut focus:outline-none focus:ring-2 focus:ring-sage"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => update({ signedAt: new Date().toISOString() })}
              disabled={!signoff.reviewerName.trim() || !signoff.reviewerRole.trim() || !!signoff.signedAt}
              className="rounded-md bg-sage px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-bark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signoff.signedAt ? "Signed" : "Sign and lock decisions"}
            </button>
            {signoff.signedAt && (
              <span className="ml-3 text-xs text-walnut">
                Signed by {signoff.reviewerName} ({signoff.reviewerRole}) at{" "}
                {new Date(signoff.signedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
