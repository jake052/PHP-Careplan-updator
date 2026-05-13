import { NextResponse } from "next/server";
import { loadDataset, mergeExtraNotes } from "../../../lib/dataset";
import { fetchLiveNotes, nextSafeId } from "../../../lib/live-events";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const personId = url.searchParams.get("person") ?? "sam";
  const eventsUrl = url.searchParams.get("eventsUrl");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing 'id' query param" }, { status: 400 });
  }

  const dataset = await loadDataset(personId);
  let notes = dataset.notes;
  if (eventsUrl) {
    try {
      const liveNotes = await fetchLiveNotes(eventsUrl, nextSafeId(dataset.notes));
      notes = mergeExtraNotes(dataset.notes, liveNotes);
    } catch (err) {
      console.warn("[/api/note] live events fetch failed:", err);
    }
  }
  const note = notes.find((n) => n.id === id);

  if (!note) {
    return NextResponse.json({ ok: false, error: `Note ${id} not found` }, { status: 404 });
  }

  return NextResponse.json({ ok: true, note });
}
