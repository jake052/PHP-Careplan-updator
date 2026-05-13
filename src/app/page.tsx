"use client";

import { useEffect, useMemo, useState } from "react";
import { PlanView } from "../components/PlanView";
import { EvidencePanel } from "../components/EvidencePanel";
import {
  PatternsStep,
  ActionsStep,
  PlanStep,
  SignoffStep,
} from "../components/wizard/WizardSteps";
import type {
  ActionDecision,
  PatternDecision,
  Signoff,
  WizardStep,
} from "../components/wizard/types";
import type { RefreshOutput } from "../lib/types";

type Provider = "azure" | "openai";

interface PersonSummary {
  id: string;
  displayName: string;
  notesCount: number;
}

type RefreshResponse =
  | {
      ok: true;
      result: RefreshOutput & { provider: Provider };
      meta: {
        personId: string;
        notesIngested: number;
        noteIdsAvailable: string[];
        provider: Provider;
      };
    }
  | { ok: false; error: string };

const STEPS: Array<{ id: WizardStep; label: string; n: number }> = [
  { id: "patterns", label: "Patterns", n: 1 },
  { id: "actions", label: "Actions", n: 2 },
  { id: "plan", label: "Plan review", n: 3 },
  { id: "signoff", label: "Sign-off", n: 4 },
];

function emptyPatternDecision(index: number): PatternDecision {
  return {
    index,
    status: "pending",
    editedClaim: null,
    reviewerNote: "",
    decidedAt: null,
  };
}

function emptyActionDecision(index: number): ActionDecision {
  return {
    index,
    status: "pending",
    editedAction: null,
    editedPriority: null,
    reviewerNote: "",
    decidedAt: null,
  };
}

function emptySignoff(): Signoff {
  return { reviewerName: "", reviewerRole: "", reviewerNotes: "", signedAt: null };
}

function readUrlParams(): { person: string | null; eventsUrl: string | null } {
  if (typeof window === "undefined") return { person: null, eventsUrl: null };
  const params = new URLSearchParams(window.location.search);
  return {
    person: params.get("person"),
    eventsUrl: params.get("eventsUrl"),
  };
}

export default function Page() {
  const [{ initialPerson, eventsUrl }] = useState(() => {
    const { person, eventsUrl } = readUrlParams();
    return { initialPerson: person ?? "sam", eventsUrl };
  });
  const [personId, setPersonId] = useState<string>(initialPerson);
  const [people, setPeople] = useState<PersonSummary[]>([]);

  const apiSuffix = eventsUrl
    ? `&eventsUrl=${encodeURIComponent(eventsUrl)}`
    : "";

  const [step, setStep] = useState<WizardStep>("idle");
  const [output, setOutput] = useState<RefreshOutput | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [notesIngested, setNotesIngested] = useState<number | null>(null);
  const [outdatedPlan, setOutdatedPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [patternDecisions, setPatternDecisions] = useState<PatternDecision[]>([]);
  const [actionDecisions, setActionDecisions] = useState<ActionDecision[]>([]);
  const [signoff, setSignoff] = useState<Signoff>(emptySignoff());

  const [activeCitation, setActiveCitation] = useState<{ noteId: string; date: string } | null>(
    null,
  );

  /* ----- load outdated plan + people list whenever personId changes ----- */
  useEffect(() => {
    setStep("idle");
    setOutput(null);
    setProvider(null);
    setError(null);
    setPatternDecisions([]);
    setActionDecisions([]);
    setSignoff(emptySignoff());
    setActiveCitation(null);

    fetch(`/api/refresh?person=${encodeURIComponent(personId)}${apiSuffix}`)
      .then((res) => res.json())
      .then(
        (body: {
          ok: boolean;
          outdatedPlan: string;
          notesIngested: number;
          people?: PersonSummary[];
        }) => {
          if (body.ok) {
            setOutdatedPlan(body.outdatedPlan);
            setNotesIngested(body.notesIngested);
            if (body.people) setPeople(body.people);
          }
        },
      )
      .catch(() => {
        /* non-fatal */
      });
  }, [personId, apiSuffix]);

  async function startRefresh() {
    setStep("generating");
    setError(null);

    try {
      const res = await fetch(
        `/api/refresh?person=${encodeURIComponent(personId)}${apiSuffix}`,
        { method: "POST" },
      );
      const body = (await res.json()) as RefreshResponse;
      if (!body.ok) throw new Error(body.error);

      setOutput(body.result);
      setProvider(body.meta.provider);
      setNotesIngested(body.meta.notesIngested);
      setPatternDecisions(body.result.evidenceTrail.map((_, i) => emptyPatternDecision(i)));
      setActionDecisions(body.result.recommendedActions.map((_, i) => emptyActionDecision(i)));
      setStep("patterns");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("idle");
    }
  }

  function resetWizard() {
    setStep("idle");
    setOutput(null);
    setPatternDecisions([]);
    setActionDecisions([]);
    setSignoff(emptySignoff());
    setActiveCitation(null);
  }

  /* ----- step navigation ----- */
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const canGoNext = step === "patterns"
    ? patternDecisions.every((d) => d.status !== "pending")
    : step === "actions"
      ? actionDecisions.every((d) => d.status !== "pending")
      : step === "plan"
        ? true
        : false;

  const pendingPatterns = patternDecisions.filter((d) => d.status === "pending").length;
  const pendingActions = actionDecisions.filter((d) => d.status === "pending").length;

  function goNext() {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }

  /* ----- bulk accept helpers ----- */
  function acceptAllPatterns() {
    const ts = new Date().toISOString();
    setPatternDecisions(
      patternDecisions.map((d) =>
        d.status === "pending" ? { ...d, status: "accepted", decidedAt: ts } : d,
      ),
    );
  }
  function acceptAllActions() {
    const ts = new Date().toISOString();
    setActionDecisions(
      actionDecisions.map((d) =>
        d.status === "pending" ? { ...d, status: "accepted", decidedAt: ts } : d,
      ),
    );
  }

  /* ----- decision counts for the header ----- */
  const decisionSummary = useMemo(() => {
    if (!output) return null;
    const pAccepted = patternDecisions.filter((d) => d.status === "accepted" || d.status === "edited").length;
    const aAccepted = actionDecisions.filter((d) => d.status === "accepted" || d.status === "edited").length;
    return {
      patterns: `${pAccepted}/${output.evidenceTrail.length} patterns kept`,
      actions: `${aAccepted}/${output.recommendedActions.length} actions kept`,
    };
  }, [output, patternDecisions, actionDecisions]);

  /* ============================================================ */
  /*  Render                                                      */
  /* ============================================================ */
  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-pampas bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 pt-6 pb-4">
          <div className="min-w-0">
            <div className="font-display text-2xl font-semibold text-bark leading-tight">
              People Helping People
            </div>
            <div className="mt-1 h-[2px] w-7 bg-sage" aria-hidden="true" />
            <p className="mt-3 voice text-base leading-snug">
              Ask better questions. Get better records.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {people.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-stone">
                <span className="uppercase tracking-wider font-medium">Person</span>
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                  disabled={step !== "idle" && step !== "generating"}
                  className="rounded-md border border-pampas bg-white px-3 py-1.5 text-sm font-medium text-bark hover:border-sage focus:outline-none focus:ring-2 focus:ring-sage disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} ({p.notesCount} notes)
                    </option>
                  ))}
                </select>
              </label>
            )}

            {provider && (
              <div
                className={`hidden sm:flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${
                  provider === "azure"
                    ? "border-sage bg-sage-tint text-bark"
                    : "border-alert bg-rose-tint text-bark animate-pulse"
                }`}
                title={
                  provider === "azure"
                    ? "Azure OpenAI UK South — safe to demo"
                    : "OpenAI US — local testing only, do not screen-share to a real provider"
                }
              >
                <span
                  className={`h-2 w-2 rounded-full ${provider === "azure" ? "bg-sage" : "bg-alert"}`}
                />
                {provider === "azure" ? "Azure UK South" : "OpenAI US — Test mode"}
              </div>
            )}
          </div>
        </div>

        {/* Step indicator */}
        {step !== "idle" && step !== "generating" && (
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 pb-5">
            <ol className="flex items-center gap-1 sm:gap-3 text-xs">
              {STEPS.map((s, i) => {
                const reached = stepIndex >= i;
                const current = stepIndex === i;
                return (
                  <li key={s.id} className="flex items-center gap-1 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => reached && setStep(s.id)}
                      disabled={!reached}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 transition ${
                        current
                          ? "bg-bark text-white"
                          : reached
                            ? "text-walnut hover:text-bark"
                            : "text-stone cursor-not-allowed"
                      }`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                          current
                            ? "bg-sage text-white"
                            : reached
                              ? "bg-sage-tint text-bark"
                              : "bg-pampas text-stone"
                        }`}
                      >
                        {s.n}
                      </span>
                      <span className="font-medium uppercase tracking-wider">{s.label}</span>
                    </button>
                    {i < STEPS.length - 1 && <span className="h-px w-4 bg-pampas hidden sm:block" />}
                  </li>
                );
              })}
            </ol>
            {decisionSummary && (
              <div className="hidden sm:flex text-xs text-stone gap-3">
                <span>{decisionSummary.patterns}</span>
                <span>·</span>
                <span>{decisionSummary.actions}</span>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-md border border-alert bg-rose-tint px-4 py-3 text-sm text-bark">
            <strong className="font-semibold">Something broke.</strong> {error}
          </div>
        )}

        {/* IDLE: show the outdated plan + "Start refresh" CTA */}
        {step === "idle" && (
          <div className="space-y-5">
            <div className="rounded-lg border border-pampas bg-white p-5 card-lift">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-medium text-bark">
                    Current care plan
                  </h2>
                  <p className="mt-1 text-sm text-stone">
                    What the team is working from today. Last reviewed 14 months ago.{" "}
                    {notesIngested != null && (
                      <>
                        {notesIngested} shift notes have been recorded since.
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startRefresh}
                  disabled={!outdatedPlan}
                  className="shrink-0 rounded-md bg-sage px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-bark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start refresh
                </button>
              </div>
              <p className="voice mt-4 text-sm">
                We&apos;ll surface what changed. You decide what stays.
              </p>
            </div>

            <div className="rounded-lg border border-pampas bg-white p-7 card-lift">
              <PlanView
                markdown={outdatedPlan ?? "Loading plan…"}
                onCitationClick={() => undefined}
              />
            </div>
          </div>
        )}

        {/* GENERATING */}
        {step === "generating" && (
          <div className="rounded-lg border border-pampas bg-white p-12 text-center card-lift">
            <h2 className="font-display text-xl font-medium text-bark">
              Reading the shift notes…
            </h2>
            <p className="mt-2 text-sm text-walnut">
              Surfacing patterns, grounding claims in source notes, drafting suggestions for you to
              decide on. Usually 25–60 seconds.
            </p>
            <p className="voice mt-4 text-sm">
              We don&apos;t write the plan. We surface what changed; you decide.
            </p>
          </div>
        )}

        {/* PATTERNS */}
        {step === "patterns" && output && (
          <PatternsStep
            evidenceTrail={output.evidenceTrail}
            decisions={patternDecisions}
            onChange={setPatternDecisions}
            onCitationClick={(noteId, date) => setActiveCitation({ noteId, date })}
          />
        )}

        {/* ACTIONS */}
        {step === "actions" && output && (
          <ActionsStep
            recommendedActions={output.recommendedActions}
            decisions={actionDecisions}
            onChange={setActionDecisions}
          />
        )}

        {/* PLAN REVIEW */}
        {step === "plan" && output && (
          <PlanStep
            output={output}
            patternDecisions={patternDecisions}
            actionDecisions={actionDecisions}
            onCitationClick={(noteId, date) => setActiveCitation({ noteId, date })}
          />
        )}

        {/* SIGN-OFF */}
        {step === "signoff" && output && (
          <SignoffStep
            output={output}
            patternDecisions={patternDecisions}
            actionDecisions={actionDecisions}
            signoff={signoff}
            onSignoffChange={setSignoff}
          />
        )}

        {/* Footer nav (between steps, not on idle/generating) */}
        {step !== "idle" && step !== "generating" && (
          <div className="mt-8 flex items-center justify-between border-t border-pampas pt-5">
            <button
              type="button"
              onClick={stepIndex > 0 ? goBack : resetWizard}
              className="rounded-md border border-pampas bg-white px-4 py-2 text-sm font-medium text-walnut transition hover:border-stone hover:text-bark"
            >
              {stepIndex > 0 ? "Back" : "Cancel"}
            </button>

            <div className="flex items-center gap-3">
              {step === "patterns" && pendingPatterns > 0 && (
                <button
                  type="button"
                  onClick={acceptAllPatterns}
                  className="text-xs text-stone hover:text-bark transition underline-offset-2 hover:underline"
                >
                  Accept all {pendingPatterns} remaining
                </button>
              )}
              {step === "actions" && pendingActions > 0 && (
                <button
                  type="button"
                  onClick={acceptAllActions}
                  className="text-xs text-stone hover:text-bark transition underline-offset-2 hover:underline"
                >
                  Accept all {pendingActions} remaining
                </button>
              )}

              {step !== "signoff" ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canGoNext}
                  className="rounded-md bg-sage px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-bark disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    !canGoNext
                      ? step === "patterns"
                        ? `${pendingPatterns} pattern(s) still pending`
                        : step === "actions"
                          ? `${pendingActions} action(s) still pending`
                          : ""
                      : ""
                  }
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetWizard}
                  className="rounded-md border border-pampas bg-white px-5 py-2 text-sm font-medium text-walnut hover:border-stone"
                >
                  Start a new refresh
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <EvidencePanel
        noteId={activeCitation?.noteId ?? null}
        date={activeCitation?.date ?? null}
        personId={personId}
        eventsUrl={eventsUrl}
        onClose={() => setActiveCitation(null)}
      />
    </main>
  );
}
