import type { CorpusNote } from "./dataset";

// Read-only hook for the PHP-Demo integrated trial. When a refresh request
// comes in with `?eventsUrl=...`, fetch the live event store at that URL,
// map each care-note event into a CorpusNote so the LLM and the evidence
// panel treat live notes identically to fixture notes.
//
// SSRF guard: only localhost/loopback hosts are allowed. This is a dev-only
// hook; production would replace it with a typed RPC into the real event store.

const ALLOWED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

type RawEvent = {
  eventId: string;
  occurredAt: string;
  sourceType: string;
  payload: { fullNote?: string };
};

export function isAllowedEventsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function eventToNote(event: RawEvent, assignedId: string): CorpusNote {
  const body = event.payload.fullNote?.trim() ?? "";
  const iso = event.occurredAt;
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  const writer = "You (support worker)";
  const type = "live capture";
  return {
    id: assignedId,
    date,
    time,
    writer,
    type,
    quality: "rich",
    body,
    raw: [
      `### Note ${assignedId}`,
      `- **Date:** ${date}`,
      `- **Time:** ${time}`,
      `- **Writer:** ${writer}`,
      `- **Type:** ${type}`,
      "",
      body,
    ].join("\n"),
  };
}

export async function fetchLiveNotes(
  eventsUrl: string,
  startingId: number,
): Promise<CorpusNote[]> {
  if (!isAllowedEventsUrl(eventsUrl)) {
    throw new Error(
      `eventsUrl host not allowed (loopback only): ${eventsUrl}`,
    );
  }
  const res = await fetch(eventsUrl, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`eventsUrl returned HTTP ${res.status}`);
  }
  const body = (await res.json()) as { events?: RawEvent[] };
  const events = Array.isArray(body.events) ? body.events : [];
  const careNotes = events.filter(
    (e) => e.sourceType === "care-note" && e.payload?.fullNote,
  );
  return careNotes.map((event, i) =>
    eventToNote(event, pad3(startingId + i)),
  );
}

// Find the next id that doesn't collide with any existing numeric id in the
// corpus. Existing IDs are like "001", "042"; we pick max(parsed) + 1, padded.
export function nextSafeId(existing: CorpusNote[]): number {
  let max = 0;
  for (const note of existing) {
    const n = Number.parseInt(note.id, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}
