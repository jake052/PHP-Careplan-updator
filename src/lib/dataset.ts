import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const PEOPLE_DIR = join(DATA_DIR, "people");

export interface CorpusNote {
  id: string;
  date: string;
  time: string;
  writer: string;
  type: string;
  quality?: "thin" | "mid" | "rich";
  body: string;
  raw: string;
}

export interface Dataset {
  persona: string;
  outdatedPlan: string;
  embeddedPatterns: string;
  notes: CorpusNote[];
}

export interface PersonSummary {
  id: string;
  displayName: string;
  notesCount: number;
}

function personDir(personId: string): string {
  // Sam is the default and lives at the data/ root (legacy layout, leave alone).
  // Everyone else lives under data/people/{personId}/.
  return personId === "sam" ? DATA_DIR : join(PEOPLE_DIR, personId);
}

export async function loadDataset(personId: string = "sam"): Promise<Dataset> {
  const dir = personDir(personId);
  const [persona, outdatedPlan, embeddedPatterns, notes] = await Promise.all([
    readFile(join(dir, "persona-template.md"), "utf8"),
    readFile(join(dir, "outdated-care-plan-template.md"), "utf8"),
    readFile(join(dir, "embedded-patterns.md"), "utf8"),
    loadAllNotes(personId),
  ]);

  return { persona, outdatedPlan, embeddedPatterns, notes };
}

// Merges live/external notes into an existing corpus, sorted by date+time.
// Used by the ?eventsUrl= live-events hook (PHP-Demo integration) so freshly
// captured care notes flow into the refresh pass alongside the fixture corpus.
export function mergeExtraNotes(
  corpus: CorpusNote[],
  extra: CorpusNote[],
): CorpusNote[] {
  if (extra.length === 0) return corpus;
  return [...corpus, ...extra].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
  );
}

export async function listPeople(): Promise<PersonSummary[]> {
  const people: PersonSummary[] = [];

  // Sam — legacy at data/ root.
  try {
    const samNotes = await loadAllNotes("sam");
    people.push({ id: "sam", displayName: "Sam Hartley", notesCount: samNotes.length });
  } catch {
    // Sam files missing — skip silently.
  }

  // Everyone else under data/people/.
  try {
    const entries = await readdir(PEOPLE_DIR);
    for (const entry of entries) {
      const entryPath = join(PEOPLE_DIR, entry);
      const s = await stat(entryPath).catch(() => null);
      if (!s?.isDirectory()) continue;
      try {
        const persona = await readFile(join(entryPath, "persona-template.md"), "utf8");
        const displayName = extractDisplayName(persona, entry);
        const notes = await loadAllNotes(entry);
        people.push({ id: entry, displayName, notesCount: notes.length });
      } catch {
        // Person dir missing required files — skip.
      }
    }
  } catch {
    // data/people/ doesn't exist yet — fine.
  }

  return people;
}

function extractDisplayName(persona: string, fallbackId: string): string {
  // Look for `# About me — <Name>` or `# Care plan: <Name>` style headings.
  const aboutMatch = persona.match(/^#\s+About me\s+[—–-]\s+(.+)$/m);
  if (aboutMatch) return aboutMatch[1].trim();
  const planMatch = persona.match(/^#\s+(?:Care plan:?\s+)?(.+)$/m);
  if (planMatch) return planMatch[1].trim();
  return fallbackId.charAt(0).toUpperCase() + fallbackId.slice(1);
}

async function loadAllNotes(personId: string = "sam"): Promise<CorpusNote[]> {
  const corpusDir = join(personDir(personId), "notes-corpus");
  const files = await readdir(corpusDir);
  const noteFiles = files
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !f.toLowerCase().includes("readme"))
    .sort();

  const notes: CorpusNote[] = [];
  for (const file of noteFiles) {
    const content = await readFile(join(corpusDir, file), "utf8");
    notes.push(...parseNotes(content));
  }
  notes.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return notes;
}

function parseNotes(markdown: string): CorpusNote[] {
  const notes: CorpusNote[] = [];
  const blocks = markdown.split(/^### Note /m).slice(1);

  for (const block of blocks) {
    const lines = block.split("\n");
    const id = lines[0].trim();
    const meta: Record<string, string> = {};
    let bodyStart = 1;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "" || !line.startsWith("- **")) {
        bodyStart = i;
        break;
      }
      const match = line.match(/^- \*\*([^:*]+):\*\*\s*(.+)$/);
      if (match) {
        meta[match[1].toLowerCase().trim()] = match[2].trim();
      }
    }

    const body = lines
      .slice(bodyStart)
      .join("\n")
      .replace(/^---\s*$/gm, "")
      .trim();

    if (!meta.date || !body) continue;

    notes.push({
      id,
      date: meta.date,
      time: meta.time ?? "",
      writer: meta.writer ?? "",
      type: meta.type ?? "",
      quality: ["thin", "mid", "rich"].includes(meta.quality)
        ? (meta.quality as CorpusNote["quality"])
        : undefined,
      body,
      raw: `### Note ${id}\n${block.split("\n").slice(0, bodyStart).join("\n")}\n\n${body}`,
    });
  }

  return notes;
}

export function formatNotesForPrompt(notes: CorpusNote[]): string {
  return notes
    .map(
      (n) =>
        `Note ${n.id} — ${n.date} ${n.time} — ${n.writer} — ${n.type}\n${n.body}`,
    )
    .join("\n\n---\n\n");
}
