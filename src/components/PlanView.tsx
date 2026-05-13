"use client";

import React, { type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CITATION_REGEX = /\[Note\s+([A-Za-z0-9_-]+),\s*(\d{4}-\d{2}-\d{2})\]/g;

interface PlanViewProps {
  markdown: string;
  onCitationClick: (noteId: string, date: string) => void;
}

function transformChildren(
  children: ReactNode,
  onCitationClick: (noteId: string, date: string) => void,
): ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    return splitOnCitations(child, onCitationClick);
  });
}

function splitOnCitations(
  text: string,
  onCitationClick: (noteId: string, date: string) => void,
): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CITATION_REGEX.lastIndex = 0;

  while ((match = CITATION_REGEX.exec(text)) !== null) {
    const [full, noteId, date] = match;
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <button
        key={`${noteId}-${match.index}`}
        type="button"
        onClick={() => onCitationClick(noteId, date)}
        className="mx-0.5 inline-flex items-center rounded-full border border-pampas bg-cream px-2 py-0.5 text-xs font-medium text-bark transition hover:border-sage hover:bg-sage-tint focus:outline-none focus:ring-2 focus:ring-sage"
        title={`Open evidence: Note ${noteId} on ${date}`}
      >
        Note {noteId}
        <span className="ml-1 text-stone">{date}</span>
      </button>,
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export function PlanView({ markdown, onCitationClick }: PlanViewProps) {
  return (
    <div className="prose max-w-none prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-table:text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{transformChildren(children, onCitationClick)}</p>,
          li: ({ children }) => <li>{transformChildren(children, onCitationClick)}</li>,
          td: ({ children }) => <td>{transformChildren(children, onCitationClick)}</td>,
          h2: ({ children }) => <h2>{transformChildren(children, onCitationClick)}</h2>,
          h3: ({ children }) => <h3>{transformChildren(children, onCitationClick)}</h3>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
