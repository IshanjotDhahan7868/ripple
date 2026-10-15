"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerBadge, Exposures, Trace, type TraceStep } from "@/components/panels";
import { RippleGraph, type RippleState } from "@/components/ripple-graph";
import {
  compare,
  getEvents,
  getGraph,
  getRipple,
  pretty,
  streamAnalyze,
  type Analysis,
  type AnswerType,
  type GraphEdge,
  type GraphNode,
  type MemoryEvent,
} from "@/lib/api";

const SAMPLES = [
  "Microsoft, Google and Meta raise 2027 AI capex guidance by $120B",
  "Grid interconnection backlog hits a record as utilities pause new hookups",
  "Pentagon requests largest defense budget increase in a decade",
  "Taylor Swift announces a new world tour",
];

type Mode = "headline" | "driver";

function schedule(a: Analysis) {
  // reveal each driver after a delay set by its hop count and its real lag
  return a.drivers.map((d) => ({ id: d.id, at: d.hops === 0 ? 0 : d.hops * 420 + d.lag_months * 9 }));
}

export default function Home() {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("driver");
  const [headline, setHeadline] = useState(SAMPLES[0]);
  const [source, setSource] = useState("AI_Compute_Demand");
  const [direction, setDirection] = useState(1);
  const [depth, setDepth] = useState(4);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [focusPath, setFocusPath] = useState<string[] | null>(null);
  const [brief, setBrief] = useState<{ type: AnswerType; text: string; memory: MemoryEvent[] } | null>(null);
  const [plain, setPlain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    getGraph().then(setGraph, (e) => setLoadError(String(e.message ?? e)));
    getEvents().then(setEvents);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const play = useCallback((a: Analysis) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAnalysis(a);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const plan = schedule(a);
    if (reduce) {
      setRevealed(new Set(plan.map((p) => p.id)));
      return;
    }
    setRevealed(new Set(a.sources));
    for (const p of plan)
      timers.current.push(setTimeout(() => setRevealed((s) => new Set(s).add(p.id)), p.at));
  }, []);

  const reset = () => {
    setSteps([]);
    setBrief(null);
    setPlain(null);
    setError(null);
    setFocusPath(null);
  };

  async function runDriver() {
    reset();
    setRunning(true);
    setSteps([{ name: "analyze_impact", input: { sources: [source], direction, depth }, queries: [], pending: true }]);
    try {
      const r = await getRipple(source, direction, depth);
      setSteps([{ name: "analyze_impact", input: { sources: [source], direction, depth }, queries: r.queries }]);
      play(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSteps([]);
    } finally {
      setRunning(false);
    }
  }

  async function runHeadline() {
    reset();
    setAnalysis(null);
    setRevealed(new Set());
    setRunning(true);
    try {
      await streamAnalyze(headline, depth, (ev) => {
        if (ev.type === "tool_call") setSteps((s) => [...s, { name: ev.name, input: ev.input, queries: [], pending: true }]);
        if (ev.type === "tool_result") {
          setSteps((s) => {
            const copy = [...s];
            const i = copy.findLastIndex((x) => x.name === ev.name && x.pending);
            if (i >= 0) copy[i] = { ...copy[i], pending: false, error: ev.error, queries: ev.queries };
            return copy;
          });
          if (ev.name === "analyze_impact" && !ev.error) play(ev.result as unknown as Analysis);
        }
        if (ev.type === "brief") setBrief({ type: ev.answer_type, text: ev.text, memory: ev.memory });
        if (ev.type === "error") setError(ev.message);
      });
      getEvents().then(setEvents);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function runCompare() {
    setPlain("…");
    try {
      setPlain(await compare(headline));
    } catch (e) {
      setPlain(e instanceof Error ? e.message : String(e));
    }
  }

  const ripple: RippleState | null = useMemo(() => {
    if (!analysis) return null;
    return {
      sources: analysis.sources,
      impacts: new Map(analysis.drivers.map((d) => [d.id, d])),
      revealed,
      focusPath,
    };
  }, [analysis, revealed, focusPath]);

  const themes = useMemo(() => {
    const m = new Map<string, GraphNode[]>();
    for (const n of graph?.nodes ?? []) m.set(n.theme, [...(m.get(n.theme) ?? []), n]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [graph]);

  return (
    <div className="grid min-h-full grid-rows-[auto_1fr] lg:h-full lg:overflow-hidden">
      <header className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[18px] font-semibold tracking-tight">Ripple</h1>
          <p className="hidden text-[13px] text-muted sm:block">
            How a headline travels through the economy, traced on a FalkorDB causal graph
          </p>
        </div>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-md border border-line px-2.5 py-1 text-[12px] text-muted hover:text-ink"
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </header>

      <main className="grid grid-cols-1 lg:min-h-0 lg:grid-cols-[280px_1fr_360px]">
        {/* input + memory */}
        <aside className="flex flex-col gap-5 border-b lg:min-h-0 lg:overflow-y-auto border-line bg-panel p-4 lg:border-b-0 lg:border-r">
          <div role="tablist" className="grid grid-cols-2 rounded-md border border-line p-0.5 text-[13px]">
            {(["headline", "driver"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded px-2 py-1.5 ${mode === m ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"}`}
              >
                {m === "headline" ? "From a headline" : "From a driver"}
              </button>
            ))}
          </div>

          {mode === "headline" ? (
            <div className="space-y-2">
              <label htmlFor="headline" className="text-[13px] text-muted">
                Paste a headline
              </label>
              <textarea
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-line bg-ground p-2.5 text-[14px] outline-none focus:border-signal"
              />
              <div className="flex flex-col gap-1">
                {SAMPLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setHeadline(s)}
                    className="truncate text-left text-[12px] text-muted hover:text-ink"
                    title={s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="driver" className="text-[13px] text-muted">
                  Driver that moves
                </label>
                <select
                  id="driver"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full rounded-md border border-line bg-ground p-2 text-[14px] outline-none focus:border-signal"
                >
                  {themes.map(([t, ns]) => (
                    <optgroup key={t} label={t}>
                      {ns.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 rounded-md border border-line p-0.5 text-[13px]">
                {[1, -1].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    aria-pressed={direction === d}
                    className={`rounded px-2 py-1.5 ${direction === d ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"}`}
                  >
                    {d > 0 ? "Rises" : "Falls"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex justify-between text-[13px]">
              <label htmlFor="depth" className="text-muted">
                How far to follow it
              </label>
              <span>
                {depth} {depth === 1 ? "hop" : "hops"}
              </span>
            </div>
            <input
              id="depth"
              type="range"
              min={1}
              max={4}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="w-full accent-[var(--signal)]"
            />
          </div>

          <button
            onClick={mode === "headline" ? runHeadline : runDriver}
            disabled={running || !graph}
            className="rounded-md bg-signal px-3 py-2 text-[14px] font-semibold text-[#1a1406] disabled:opacity-50"
          >
            {running ? "Tracing…" : "Trace the ripple"}
          </button>

          <section className="min-h-0 space-y-2">
            <h2 className="text-[13px] text-muted">Event memory</h2>
            {events.length === 0 ? (
              <p className="text-[12px] text-muted">
                Headlines you trace are saved here as events in the graph, so later ones can compound with them.
              </p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="text-[12px]">
                    <p className="text-ink">{e.headline}</p>
                    <p className="text-muted">
                      {e.drivers.map(pretty).join(", ")} {e.direction > 0 ? "up" : "down"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        {/* graph */}
        <section className="relative h-[60vh] min-h-0 lg:h-auto" aria-label="Causal graph">
          {loadError ? (
            <div className="grid h-full place-items-center p-6 text-center text-[14px] text-muted">
              <p>
                Can&apos;t reach the Ripple API ({loadError}). Start it with
                <code className="mx-1 font-mono text-ink">uvicorn main:app --port 8787</code>
                and reload.
              </p>
            </div>
          ) : graph ? (
            <RippleGraph graph={graph} ripple={ripple} theme={theme} />
          ) : (
            <div className="grid h-full place-items-center text-muted">Loading the graph…</div>
          )}
          {analysis && (
            <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-panel/90 px-2.5 py-1.5 text-[12px] text-muted">
              {analysis.reached} drivers reached within {analysis.depth} {analysis.depth === 1 ? "hop" : "hops"}. Dashed
              edges push the other way.
            </p>
          )}
        </section>

        {/* trace + brief */}
        <aside className="flex flex-col gap-5 border-t lg:min-h-0 lg:overflow-y-auto border-line bg-panel p-4 lg:border-l lg:border-t-0">
          <section className="space-y-2">
            <h2 className="text-[13px] text-muted">Agent trace</h2>
            <Trace steps={steps} />
          </section>

          {error && <p className="rounded-md border border-down/50 p-2.5 text-[13px] text-down">{error}</p>}

          {(brief || analysis) && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[13px] text-muted">Impact brief</h2>
                {brief && <AnswerBadge type={brief.type} />}
              </div>
              {brief && <p className="text-[14px] leading-relaxed">{brief.text}</p>}
              {brief?.memory.length ? (
                <ul className="space-y-1 text-[12px] text-muted">
                  {brief.memory.map((m) => (
                    <li key={m.id}>Earlier: {m.headline}</li>
                  ))}
                </ul>
              ) : null}
              {analysis && <Exposures analysis={analysis} onFocus={setFocusPath} />}
              {mode === "headline" && brief && (
                <div className="space-y-1.5 border-t border-line pt-3">
                  <button onClick={runCompare} className="text-[13px] text-signal hover:underline">
                    Ask the same model without the graph
                  </button>
                  {plain && <p className="text-[13px] leading-relaxed text-muted">{plain}</p>}
                </div>
              )}
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
