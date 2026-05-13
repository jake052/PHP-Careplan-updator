"use client";

import { useEffect, useState } from "react";
import { type CorpusNote } from "../lib/dataset";

interface EvidencePanelProps {
  noteId: string | null;
  date: string | null;
  personId: string;
  eventsUrl?: string | null;
  onClose: () => void;
}

export function EvidencePanel({ noteId, date, personId, eventsUrl, onClose }: EvidencePanelProps) {
  const [note, setNote] = useState<CorpusNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noteId) {
      setNote(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setNote(null);

    const eventsParam = eventsUrl
      ? `&eventsUrl=${encodeURIComponent(eventsUrl)}`
      : "";
    fetch(
      `/api/note?id=${encodeURIComponent(noteId)}&person=${encodeURIComponent(personId)}${eventsParam}`,
    )
      .then(async (res) => {
        const body = (await res.json()) as
          | { ok: true; note: CorpusNote }
          | { ok: false; error: string };
        if (!body.ok) throw new Error(body.error);
        setNote(body.note);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [noteId, personId, eventsUrl]);

  if (!noteId) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-pampas bg-white card-lift">
      <div className="flex items-start justify-between border-b border-pampas px-6 py-5">
        <div>
          <div className="text-xs uppercase tracking-wider text-stone font-medium">
            Source note
          </div>
          <h2 className="mt-1 font-display text-lg font-medium text-bark">
            Note {noteId}
            <span className="ml-2 text-sm font-normal text-stone">{date}</span>
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-stone hover:bg-cream hover:text-bark transition"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-walnut leading-relaxed">
        {loading && <p className="text-stone">Loading note…</p>}
        {error && <p className="text-alert">Error: {error}</p>}
        {note && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-pampas bg-cream px-3 py-2 text-xs">
              <div>
                <span className="text-stone">Time:</span>{" "}
                <span className="text-bark font-medium">{note.time}</span>
              </div>
              <div>
                <span className="text-stone">Type:</span>{" "}
                <span className="text-bark font-medium">{note.type}</span>
              </div>
              <div className="col-span-2">
                <span className="text-stone">Writer:</span>{" "}
                <span className="text-bark font-medium">{note.writer}</span>
              </div>
            </div>
            <div className="whitespace-pre-wrap">{note.body}</div>
          </div>
        )}
      </div>
    </div>
  );
}
