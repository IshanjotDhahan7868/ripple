"use client";

import { useState } from "react";
import type { QueryTrace } from "@/lib/api";

export type TraceStep = {
  name: string;
  input?: Record<string, unknown>;
  error?: boolean;
  queries: QueryTrace[];
  pending?: boolean;
};

export const STEP_TEXT: Record<string, string> = {
  search_drivers: "Looked up which parts of the economy the headline touches",
  analyze_impact: "Traced every knock-on effect through the map",
  recall_events: "Checked for related news in the last 30 days",
  record_alert: "Saved the result as an alert",
  systemic_drivers: "Ranked the economy's pressure points",
  explain_link: "Read how two parts of the economy are linked",
  asset_profile: "Walked the map backwards from this stock",
};

export const stepText = (name: string) => STEP_TEXT[name] ?? name;

export function UnderTheHood({
  steps,
  note,
  lead = "Claude picked each step from a fixed menu of tools and never wrote a database query itself.",
  onCompare,
  compareText,
}: {
  steps: TraceStep[];
  note?: string;
  lead?: string;
  onCompare?: () => void;
  compareText?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const queries = steps.flatMap((s) => s.queries);
  const ms = queries.reduce((t, q) => t + q.ms, 0);
  return (
    <details className="group rounded-3xl bg-panel p-5 open:pb-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-[20px] font-bold">Show how this was worked out</span>
          <span className="text-[15px] text-muted">
            {lead}
            {queries.length > 0 && ` FalkorDB ran ${queries.length} queries in ${ms.toFixed(1)} ms.`}
          </span>
        </span>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0 transition group-open:rotate-180">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <ol className="mt-5 flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={i} className="rounded-2xl bg-panel-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className={`font-bold ${s.error ? "text-down" : ""}`}>
                {i + 1}. {stepText(s.name)}
              </span>
              <span className="shrink-0 text-[14px] text-muted">
                {s.pending ? "running…" : s.error ? "refused" : `${s.queries.length} ${s.queries.length === 1 ? "query" : "queries"}`}
              </span>
            </div>
            {s.queries.map((q, j) => {
              const id = `${i}-${j}`;
              return (
                <div key={id} className="mt-2">
                  <button
                    onClick={() => setOpen(open === id ? null : id)}
                    aria-expanded={open === id}
                    className="flex w-full items-baseline justify-between gap-3 text-left text-[14px] text-muted hover:text-ink"
                  >
                    <span className="font-mono">{q.name}</span>
                    <span>
                      {q.rows} rows, {q.ms} ms
                    </span>
                  </button>
                  {open === id && (
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-xl bg-ground p-3 font-mono text-[12.5px] leading-relaxed">
                      {q.cypher}
                    </pre>
                  )}
                </div>
              );
            })}
          </li>
        ))}
      </ol>

      {note && <p className="mt-4 text-[14px] text-muted">{note}</p>}

      {onCompare && (
        <div className="mt-5 flex flex-col gap-2 border-t border-line pt-5">
          <button onClick={onCompare} className="self-start font-bold text-link hover:underline">
            Ask the same AI without the map
          </button>
          <p className="text-[14px] text-muted">
            Same model, no map. Compare whether you can check where each claim comes from.
          </p>
          {compareText && <p className="rounded-2xl bg-panel-2 p-4 text-[15px] leading-relaxed">{compareText}</p>}
        </div>
      )}
    </details>
  );
}
