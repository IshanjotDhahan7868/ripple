"use client";

import { useState } from "react";
import { Ticker } from "@/components/ticker";
import type { Analysis } from "@/lib/api";
import { chain, when, type Group, type Lookup, type Selection } from "@/lib/model";

const SHOW = 4;

function GroupCard({ g, active, onSelect }: { g: Group; active: boolean; onSelect: (s: Selection) => void }) {
  const extra = g.tickers.length - 5;
  const select = () => onSelect({ path: g.path, tickers: g.tickers.map((t) => t.ticker), up: g.up });
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={select}
      onKeyDown={(e) => e.target === e.currentTarget && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), select())}
      aria-pressed={active}
      className={`flex w-full flex-col gap-2 rounded-xl border-2 p-3.5 text-left transition ${
        active ? "border-ink bg-panel-2" : "border-transparent bg-panel-2/60 hover:bg-panel-2"
      }`}
    >
      <span className="flex w-full items-baseline justify-between gap-2">
        <span className="font-bold">{g.name}</span>
        <span className="shrink-0 text-[14px] text-muted">{when(g.months)}</span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        {g.tickers.slice(0, 5).map((t) => (
          <Ticker key={t.ticker} t={t.ticker} dir={g.up ? 1 : -1} />
        ))}
        {extra > 0 && <span className="px-1 py-0.5 text-[14px] text-muted">+{extra} more</span>}
      </span>
      <span className="flex w-full items-center gap-3">
        <span className="h-1.5 flex-1 rounded-full bg-line">
          <span
            className={`block h-1.5 rounded-full ${g.up ? "bg-up" : "bg-down"}`}
            style={{ width: g.strength === "Strong" ? "100%" : g.strength === "Medium" ? "62%" : "28%" }}
          />
        </span>
        <span className="w-16 text-[14px] text-muted">{g.strength}</span>
      </span>
    </div>
  );
}

function Side({ title, tone, groups, selected, onSelect }: {
  title: string;
  tone: string;
  groups: Group[];
  selected: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  const [all, setAll] = useState(false);
  const list = all ? groups : groups.slice(0, SHOW);
  const sel = selected?.path[selected.path.length - 1];
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className={`font-display text-[22px] font-bold ${tone}`}>{title}</h2>
      {groups.length === 0 ? (
        <p className="text-[15px] text-muted">Nothing on this side.</p>
      ) : (
        list.map((g) => <GroupCard key={g.key} g={g} active={sel === g.driver && selected?.up === g.up} onSelect={onSelect} />)
      )}
      {groups.length > SHOW && (
        <button onClick={() => setAll(!all)} className="self-start text-[15px] text-link hover:underline">
          {all ? "Show fewer" : `Show all ${groups.length} groups`}
        </button>
      )}
    </section>
  );
}

export function Board(props: { downs: Group[]; ups: Group[]; selected: Selection | null; onSelect: (s: Selection) => void }) {
  return (
    <div className="flex flex-col gap-6 rounded-3xl bg-panel p-5 pt-0">
      <div className="-mx-5 flex justify-between bg-signal px-4 py-1.5 font-mono text-[13px] font-bold text-ground">
        <span>EXPOSURE BOARD</span>
        <span>{props.downs.length + props.ups.length} groups</span>
      </div>
      <Side title="Likely to fall" tone="text-down" groups={props.downs} {...props} />
      <Side title="Likely to rise" tone="text-up" groups={props.ups} {...props} />
    </div>
  );
}

// the short answer to "why is this on the list?", in the graph's own words
export function WhyCard({ a, L, selected }: { a: Analysis; L: Lookup; selected: Selection | null }) {
  if (!selected) return null;
  const steps = chain(selected.path, a, L);
  const last = steps[steps.length - 1];
  const target = selected.tickers.length ? selected.tickers.slice(0, 3).join(", ") : last.label;
  return (
    <section className="halftone flex flex-col gap-4 rounded-3xl bg-ink p-5 text-ground shadow-[6px_6px_0_var(--money)]">
      <h2 className="font-display text-[22px] font-bold">Why {target}?</h2>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            <span className={`mt-1 size-3 shrink-0 rounded-full ${i === 0 ? "bg-[#c99a2e]" : s.up ? "bg-up-fill" : "bg-down-fill"}`} />
            <span className="flex flex-col">
              <span className="font-bold">
                {s.label} {s.up ? "up" : "down"}
                {i > 0 && <span className="font-normal text-[#4a5568]">, {when(s.months)}</span>}
              </span>
              {s.why && <span className="text-[15px] text-[#3a4453]">{s.why}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
