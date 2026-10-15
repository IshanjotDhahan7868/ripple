"use client";

import { useState } from "react";
import { pretty, type Analysis, type AnswerType, type QueryTrace } from "@/lib/api";

export type TraceStep = {
  name: string;
  input?: Record<string, unknown>;
  error?: boolean;
  queries: QueryTrace[];
  pending?: boolean;
};

const ANSWER_LABEL: Record<AnswerType, { text: string; tone: string }> = {
  answered: { text: "Answered with path", tone: "text-signal border-signal/50" },
  compounding: { text: "Compounding with earlier events", tone: "text-signal border-signal" },
  not_in_graph: { text: "Not in the graph", tone: "text-muted border-line" },
  unknown_entity: { text: "Unknown entity", tone: "text-down border-down/50" },
};

export function AnswerBadge({ type }: { type: AnswerType }) {
  const a = ANSWER_LABEL[type];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[12px] ${a.tone}`}>{a.text}</span>;
}

export function Trace({ steps }: { steps: TraceStep[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const queries = steps.flatMap((s) => s.queries);
  const total = queries.reduce((t, q) => t + q.ms, 0);
  if (!steps.length)
    return <p className="text-[13px] text-muted">Each tool the agent calls appears here with the Cypher it ran.</p>;
  return (
    <div className="space-y-2">
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="rounded-md border border-line bg-panel-2 px-2.5 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`font-mono text-[12px] ${s.error ? "text-down" : "text-ink"}`}>{s.name}</span>
              <span className="text-[11px] text-muted">{s.pending ? "running…" : s.error ? "rejected" : `${s.queries.length} queries`}</span>
            </div>
            {s.input && (
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted" title={JSON.stringify(s.input)}>
                {Object.entries(s.input)
                  .filter(([k]) => k !== "summary")
                  .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                  .join("  ")}
              </p>
            )}
            {s.queries.map((q, j) => {
              const id = `${i}-${j}`;
              return (
                <div key={id} className="mt-1">
                  <button
                    onClick={() => setOpen(open === id ? null : id)}
                    className="flex w-full items-baseline justify-between text-left text-[12px] text-muted hover:text-ink"
                    aria-expanded={open === id}
                  >
                    <span className="font-mono">{q.name}</span>
                    <span>
                      {q.rows} rows in {q.ms} ms
                    </span>
                  </button>
                  {open === id && (
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-ground p-2 font-mono text-[11px] leading-relaxed text-ink">
                      {q.cypher}
                    </pre>
                  )}
                </div>
              );
            })}
          </li>
        ))}
      </ol>
      {queries.length > 0 && (
        <p className="text-[12px] text-muted">
          {queries.length} Cypher queries, {total.toFixed(1)} ms in FalkorDB
        </p>
      )}
    </div>
  );
}

export function Exposures({
  analysis,
  onFocus,
}: {
  analysis: Analysis;
  onFocus: (path: string[] | null) => void;
}) {
  const max = Math.max(...analysis.assets.map((a) => a.score), 0.0001);
  const second = analysis.drivers.find((d) => d.hops >= 2);
  return (
    <div className="space-y-3">
      {second && (
        <button
          className="w-full rounded-md border border-signal/40 bg-signal-soft p-2.5 text-left"
          onMouseEnter={() => onFocus(second.path)}
          onMouseLeave={() => onFocus(null)}
          onFocus={() => onFocus(second.path)}
          onBlur={() => onFocus(null)}
        >
          <p className="text-[12px] text-muted">Strongest second-order effect</p>
          <p className="mt-0.5 text-[13px] text-ink">{second.path.map(pretty).join(" → ")}</p>
          <p className="mt-0.5 text-[12px] text-muted">
            {second.hops} hops, about {second.lag_months} months out
          </p>
        </button>
      )}
      <table className="w-full text-[13px]">
        <caption className="mb-1 text-left text-[12px] text-muted">
          Most exposed assets, ranked by propagated strength. Hover a row to see its path.
        </caption>
        <thead className="sr-only">
          <tr>
            <th>Ticker</th>
            <th>Direction</th>
            <th>Strength</th>
            <th>Lag</th>
          </tr>
        </thead>
        <tbody>
          {analysis.assets.map((a) => (
            <tr
              key={a.ticker}
              tabIndex={0}
              onMouseEnter={() => onFocus(a.path)}
              onMouseLeave={() => onFocus(null)}
              onFocus={() => onFocus(a.path)}
              onBlur={() => onFocus(null)}
              className="cursor-default border-t border-line/60 outline-none hover:bg-panel-2 focus:bg-panel-2"
            >
              <td className="py-1.5 pr-2 font-mono text-[12.5px]">{a.ticker}</td>
              <td className={`whitespace-nowrap pr-2 ${a.direction > 0 ? "text-up" : "text-down"}`}>
                {a.direction > 0 ? "▲ up" : "▼ down"}
              </td>
              <td className="w-full pr-2">
                <div className="h-1.5 rounded-full bg-line">
                  <div className="h-1.5 rounded-full bg-signal" style={{ width: `${(a.score / max) * 100}%` }} />
                </div>
              </td>
              <td className="whitespace-nowrap text-right text-[12px] text-muted">{a.lag_months} mo</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
