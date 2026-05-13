import { NextResponse } from "next/server";
import { listPeople, loadDataset, mergeExtraNotes, type CorpusNote } from "../../../lib/dataset";
import { runRefresh } from "../../../lib/refresh";
import { fetchLiveNotes, nextSafeId } from "../../../lib/live-events";

export const runtime = "nodejs";
export const maxDuration = 300;

function getPersonId(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("person") ?? "sam";
}

function getEventsUrl(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("eventsUrl");
}

async function loadLiveNotes(
  eventsUrl: string | null,
  existing: CorpusNote[],
): Promise<CorpusNote[]> {
  if (!eventsUrl) return [];
  try {
    return await fetchLiveNotes(eventsUrl, nextSafeId(existing));
  } catch (err) {
    console.warn("[/api/refresh] live events fetch failed:", err);
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const personId = getPersonId(request);
    const eventsUrl = getEventsUrl(request);
    const dataset = await loadDataset(personId);
    const liveNotes = await loadLiveNotes(eventsUrl, dataset.notes);
    const mergedDataset = {
      ...dataset,
      notes: mergeExtraNotes(dataset.notes, liveNotes),
    };
    const result = await runRefresh(mergedDataset, {
      liveNoteIds: liveNotes.map((n) => n.id),
    });

    return NextResponse.json({
      ok: true,
      result,
      meta: {
        personId,
        notesIngested: mergedDataset.notes.length,
        liveNotesIngested: liveNotes.length,
        liveNoteIds: liveNotes.map((n) => n.id),
        noteIdsAvailable: mergedDataset.notes.map((n) => n.id),
        provider: result.provider,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function stripTemplateMeta(markdown: string): string {
  // Strip all blockquotes from the outdated plan when serving to the UI.
  // The blockquotes in the source file are dataset-builder annotations
  // (TEMPLATE NOTES, "this section is stale because...") that should not
  // appear to a viewer pretending this is a real stale plan.
  // The LLM still sees the full file via the POST refresh path.
  let cleaned = markdown.replace(/(^|\n)>[^\n]*(\n>[^\n]*)*\n?/g, "$1");
  // Also strip the dataset-builder trailing meta section if present.
  cleaned = cleaned.replace(
    /\n## What this stale plan is missing[\s\S]*$/i,
    "",
  );
  // Collapse 3+ consecutive newlines.
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return cleaned;
}

export async function GET(request: Request) {
  const personId = getPersonId(request);
  const eventsUrl = getEventsUrl(request);
  const [dataset, people] = await Promise.all([
    loadDataset(personId),
    listPeople(),
  ]);
  const liveNotes = await loadLiveNotes(eventsUrl, dataset.notes);
  return NextResponse.json({
    ok: true,
    personId,
    notesIngested: dataset.notes.length + liveNotes.length,
    liveNotesIngested: liveNotes.length,
    liveNoteIds: liveNotes.map((n) => n.id),
    outdatedPlan: stripTemplateMeta(dataset.outdatedPlan),
    people,
  });
}
