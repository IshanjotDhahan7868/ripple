"use client";

import { useState } from "react";
import { chain, company, when, type Group, type Step, type ViewProps } from "@/lib/model";

function defaultPath(downs: Group[], ups: Group[]) {
  const top = [...downs, ...ups].sort((p, q) => q.score - p.score);
  // a chain with a few links tells a better story than a one-step one, if it is still reasonably strong
  const strong = top.slice(0, 6);
  const g = strong.find((x) => x.path.length >= 3) ?? strong.find((x) => x.path.length >= 2) ?? top[0];
  return g ? { path: g.path, tickers: g.tickers.slice(0, 3).map((t) => t.ticker), up: g.up } : null;
}

function stepsFor(props: ViewProps): Step[] {
  const sel = props.selected ?? defaultPath(props.downs, props.ups);
  if (!sel) return [];
  const steps = chain(sel.path, props.a, props.L);
  if (sel.tickers.length) {
    const last = steps[steps.length - 1];
    steps.push({
      id: "stocks",
      label: sel.tickers.slice(0, 3).join(", "),
      up: sel.up ?? last.up,
      months: last.months,
      why: `${sel.tickers.slice(0, 3).map(company).join(", ")} ${sel.tickers.length > 1 ? "make" : "makes"} money from ${last.label.toLowerCase()}, so ${sel.tickers.length > 1 ? "they move" : "it moves"} with it.`,
    });
  }
  return steps;
}

const verb = (s: Step) => (s.up ? "up" : "down");

function note(i: number, n: number) {
  if (i === 0) return "This is the headline itself.";
  if (i === 1) return "Direct effect. The push is strongest here.";
  if (i === n - 1) return "End of the chain. Weaker by now, but it points the same way.";
  return `${i} steps out, so the push is fading.`;
}

export function StoryView(props: ViewProps) {
  const steps = stepsFor(props);
  const key = steps.map((s) => s.id).join(">");
  const [state, setState] = useState({ key, i: 0 });
  const i = state.key === key ? Math.min(state.i, steps.length - 1) : 0;
  const go = (n: number) => setState({ key, i: Math.max(0, Math.min(steps.length - 1, n)) });
  const options = [...props.downs, ...props.ups].sort((p, q) => q.score - p.score).slice(0, 8);

  if (!steps.length) return <p className="text-muted">Nothing to walk through for this headline.</p>;
  const cur = steps[i];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
          Follow the chain to
          <select
            value=""
            onChange={(e) => {
              const g = options.find((o) => o.key === e.target.value);
              if (g) props.onSelect({ path: g.path, tickers: g.tickers.map((t) => t.ticker), up: g.up });
            }}
            className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-[15px] text-ink"
          >
            <option value="">{steps[steps.length - 1].label}</option>
            {options.map((g) => (
              <option key={g.key} value={g.key}>
                {g.name} ({g.up ? "rise" : "fall"})
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(i - 1)}
            disabled={i === 0}
            aria-label="Previous step"
            className="grid size-11 place-items-center rounded-full border-2 border-ink/80 disabled:opacity-30"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="min-w-24 text-center font-bold">
            Step {i + 1} of {steps.length}
          </span>
          <button
            onClick={() => go(i + 1)}
            disabled={i === steps.length - 1}
            aria-label="Next step"
            className="grid size-11 place-items-center rounded-full bg-link text-ground disabled:opacity-30"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <ol className="flex snap-x gap-3 overflow-x-auto pb-2">
        {steps.map((s, k) => {
          const tone = k === 0 ? "bg-signal text-ground" : s.up ? "bg-up-fill text-white" : "bg-down-fill text-white";
          return (
            <li key={s.id} className="flex shrink-0 snap-start items-center gap-3">
              <button
                onClick={() => go(k)}
                aria-current={k === i ? "step" : undefined}
                className={`flex w-48 flex-col gap-2 rounded-2xl border-2 p-4 text-left transition duration-300 ${
                  k === i ? "border-link bg-panel-2" : "border-line bg-panel"
                } ${k <= i ? "opacity-100" : "opacity-45"} ${k === i ? "" : k % 2 ? "rotate-1" : "-rotate-1"}`}
              >
                <span className={`grid size-8 place-items-center rounded-full font-bold ${k <= i ? tone : "bg-line text-muted"}`}>{k + 1}</span>
                <span className="font-display text-[19px] font-bold leading-tight">
                  {s.label} {verb(s)}
                </span>
                <span className="text-[14px] text-muted">{k === 0 ? "The news" : when(s.months)}</span>
              </button>
              {k < steps.length - 1 && (
                <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden className="shrink-0 text-muted">
                  <path d="M1 7h18M14 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-panel-2 p-6">
        <p className="min-w-0 flex-[1_1_420px] text-[21px] leading-snug">
          {i === 0 ? `It starts here: the news pushes ${cur.label.toLowerCase()} ${verb(cur)}.` : (cur.why ?? `${steps[i - 1].label} pushes ${cur.label.toLowerCase()}.`)}
        </p>
        <p className="flex-[0_1_240px] -rotate-2 font-note text-[25px] leading-tight text-link">{note(i, steps.length)}</p>
      </div>
    </div>
  );
}
