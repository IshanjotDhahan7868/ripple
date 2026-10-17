"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import Link from "next/link";
import { Board, WhyCard } from "@/components/board";
import { UnderTheHood, stepText, type TraceStep } from "@/components/hood";
import { LiveFeed } from "@/components/live";
import { RippleGraph } from "@/components/ripple-graph";
import { StoryView } from "@/components/story";
import { FlowView } from "@/components/views/flow";
import { HeatView } from "@/components/views/heat";
import { RingsView } from "@/components/views/rings";
import {
  compare,
  getEvents,
  getGraph,
  getRipple,
  getSystemic,
  streamAnalyze,
  type Analysis,
  type AnswerType,
  type GraphEdge,
  type GraphNode,
  type MemoryEvent,
  type StreamEvent,
  type Systemic,
} from "@/lib/api";
import { animate, guilloche, type Field } from "@/lib/guilloche";
import { ago, getLiveFeed, getLiveItem, type LiveSummary } from "@/lib/live";
import { groupAssets, makeLookup, tidy, verdict, type Selection, type ViewProps } from "@/lib/model";

type Sample = { slug: string; headline: string; answer_type: AnswerType };
type Brief = { type: AnswerType; text: string; memory: MemoryEvent[]; usd?: number; replayed?: boolean };
type Tab = "story" | "rings" | "flow" | "heat" | "map";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "story", label: "Story", hint: "Walk one chain, step by step" },
  { id: "rings", label: "Ripple", hint: "Watch effects spread over time" },
  { id: "flow", label: "Flow", hint: "Where the push ends up" },
  { id: "heat", label: "Heat map", hint: "Every stock at a glance" },
  { id: "map", label: "Full map", hint: "The whole network" },
];

const PER_HOP = 10;

// for the full map: strongest effects per step, plus everything on a path to a listed stock
function shown(a: Analysis) {
  const keep = new Set<string>();
  const byHop = new Map<number, typeof a.drivers>();
  for (const d of a.drivers) byHop.set(d.hops, [...(byHop.get(d.hops) ?? []), d]);
  for (const col of byHop.values())
    col.sort((x, y) => y.impact - x.impact).slice(0, PER_HOP).forEach((d) => keep.add(d.id));
  for (const path of [...a.drivers.filter((d) => keep.has(d.id)).map((d) => d.path), ...a.assets.map((x) => x.path)])
    path.forEach((id) => keep.add(id));
  return a.drivers.filter((d) => keep.has(d.id));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [systemic, setSystemic] = useState<Systemic | null>(null);

  const [headline, setHeadline] = useState("");
  const [explore, setExplore] = useState(false);
  const [source, setSource] = useState("Interest_Rates");
  const [direction, setDirection] = useState(1);

  const [asked, setAsked] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [tab, setTab] = useState<Tab>("story");
  const [plain, setPlain] = useState<string | null>(null);
  const [live, setLive] = useState<LiveSummary | null>(null);
  const results = useRef<HTMLDivElement>(null);
  const run = useRef(0);

  useEffect(() => {
    getGraph().then(setGraph, (e) => setLoadError(String(e.message ?? e)));
    getEvents().then(setEvents);
    getSystemic().then(setSystemic, () => {});
    fetch("/samples/index.json")
      .then((r) => r.json())
      .then(setSamples, () => {});
  }, []);

  // the landing page hands over a headline as ?q=
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")?.trim();
    if (!q) return;
    const t = setTimeout(() => {
      setHeadline(q);
      runHeadline(q);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // engraved rings behind the ask; they pulse when an answer lands
  const engraving = useRef<HTMLCanvasElement>(null);
  const field = useRef<Field | null>(null);
  useEffect(() => {
    const f = guilloche(engraving.current!, { cx: 0.82, cy: 0.45, alpha: 0.32, follow: true });
    field.current = f;
    f.hit(1.2);
    const stop = animate([{ f, el: engraving.current! }]);
    return () => {
      stop();
      f.stop();
    };
  }, []);
  useEffect(() => {
    if (!analysis) return;
    field.current?.hit(1.4);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = gsap.from("[data-reveal]", { y: 28, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.08, clearProps: "all" });
    return () => {
      t.kill();
    };
  }, [analysis]);

  // share links: ?example=<slug>&view=<tab> opens a saved example straight away
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !samples.length || !graph) return;
    opened.current = true;
    const q = new URLSearchParams(window.location.search);
    const v = q.get("view") as Tab | null;
    const s = samples.find((x) => x.slug === q.get("example"));
    const show = () => v && TABS.some((t) => t.id === v) && setTab(v);
    if (s) runSample(s).then(show);
    const l = q.get("live");
    if (l && /^[0-9a-f]{12}$/.test(l))
      getLiveItem(l).then((it) => runLive(it).then(show), () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, graph]);

  const shareUrl = (() => {
    if (typeof window === "undefined") return null;
    if (live) return `${window.location.origin}/app?live=${live.id}&view=${tab}`;
    const s = samples.find((x) => x.headline === asked);
    if (!s) return null;
    return `${window.location.origin}/app?example=${s.slug}&view=${tab}`;
  })();
  const [copied, setCopied] = useState(false);

  const L = useMemo(() => makeLookup(graph ?? { nodes: [], edges: [] }), [graph]);
  const groups = useMemo(() => (analysis ? groupAssets(analysis, L) : null), [analysis, L]);
  const forces = useMemo(() => {
    const m = new Map<string, GraphNode[]>();
    for (const n of graph?.nodes ?? []) m.set(n.theme, [...(m.get(n.theme) ?? []), n]);
    return [...m.entries()].sort(([p], [q]) => p.localeCompare(q));
  }, [graph]);

  function start(label: string) {
    run.current += 1;
    setAsked(label);
    setRunning(true);
    setSteps([]);
    setAnalysis(null);
    setBrief(null);
    setSaved(false);
    setError(null);
    setSelected(null);
    setPlain(null);
    setLive(null);
    setTab("story");
    setTimeout(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return run.current;
  }

  function apply(ev: StreamEvent) {
    if (ev.type === "tool_call") setSteps((s) => [...s, { name: ev.name, input: ev.input, queries: [], pending: true }]);
    if (ev.type === "tool_result") {
      setSteps((s) => {
        const copy = [...s];
        const i = copy.findLastIndex((x) => x.name === ev.name && x.pending);
        if (i >= 0) copy[i] = { ...copy[i], pending: false, error: ev.error, queries: ev.queries };
        return copy;
      });
      if (ev.name === "analyze_impact" && !ev.error) setAnalysis(ev.result as unknown as Analysis);
    }
    if (ev.type === "brief") {
      setBrief({ type: ev.answer_type, text: ev.text, memory: ev.memory, usd: ev.usd, replayed: ev.replayed });
      if (ev.analysis) setAnalysis(ev.analysis);
    }
    if (ev.type === "error") setError(ev.message);
  }

  async function runHeadline(h: string) {
    if (!h.trim()) return;
    start(h.trim());
    try {
      await streamAnalyze(h.trim(), 4, apply);
      getEvents().then(setEvents);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function runSample(s: Sample) {
    setHeadline(s.headline);
    const id = start(s.headline);
    try {
      const data: { events: StreamEvent[] } = await (await fetch(`/samples/${s.slug}.json`)).json();
      for (const ev of data.events) {
        if (run.current !== id) return;
        if (ev.type === "tool_call") await sleep(380);
        apply(ev);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (run.current === id) setRunning(false);
    }
  }

  async function runLive(item: LiveSummary) {
    setHeadline(item.headline);
    const id = start(item.headline);
    setLive(item);
    try {
      const full = await getLiveItem(item.id);
      if (run.current === id) setAnalysis(full.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (run.current === id) setRunning(false);
    }
  }

  async function runForce(src: string, dir: number) {
    start(`What if ${L.name(src).toLowerCase()} ${dir > 0 ? "rise" : "fall"}?`);
    setSteps([{ name: "analyze_impact", queries: [], pending: true }]);
    try {
      const r = await getRipple(src, dir, 4);
      setSteps([{ name: "analyze_impact", queries: r.queries }]);
      setAnalysis(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSteps([]);
    } finally {
      setRunning(false);
    }
  }

  const answered = analysis && groups && (!brief || brief.type === "answered" || brief.type === "compounding");
  const paragraphs = brief ? tidy(brief.text, L).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];
  const headlineVerdict = answered && paragraphs.length > 1 ? paragraphs[0] : groups ? verdict(groups.downs, groups.ups) : null;
  const detail = answered && paragraphs.length > 1 ? paragraphs.slice(1).join(" ") : answered ? paragraphs.join(" ") : null;
  const earlier = (brief?.memory ?? []).filter((m) => m.headline.trim().toLowerCase() !== asked?.trim().toLowerCase());
  const view: ViewProps | null =
    analysis && groups ? { a: analysis, L, ...groups, selected, onSelect: setSelected } : null;
  const costNote = saved
    ? "This example was recorded from a real run earlier, so it loads instantly and costs nothing."
    : brief?.replayed
      ? "Someone ran this exact headline before, so the saved run was replayed at no cost."
      : brief?.usd
        ? `This run cost about $${brief.usd.toFixed(2)} in AI fees.`
        : !brief && analysis
          ? "No AI was used: this went straight to the map."
          : undefined;

  return (
    <div className="grain relative min-h-screen overflow-x-clip">
      <header className="relative z-20 mx-auto flex max-w-[1240px] items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 border-[1.5px] border-gold bg-ground px-3 py-1.5">
          <Logo />
          <span className="font-display text-[22px] font-extrabold tracking-tight">ripple</span>
        </Link>
        <nav className="flex items-center gap-2 text-[15px] font-bold">
          <a href="#live" className="hidden border-[1.5px] border-line px-3 py-1.5 hover:border-gold sm:block">
            Live calls
          </a>
          <a href="#how" className="border-[1.5px] border-line px-3 py-1.5 hover:border-gold">
            How it works
          </a>
        </nav>
      </header>
      <Tape />

      <canvas ref={engraving} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[760px] w-full" />
      <main className="relative mx-auto flex max-w-[1240px] flex-col gap-14 px-5 pb-20 sm:px-8">
        {/* ask */}
        <section className="flex flex-col gap-6 pt-10">
          <div className="flex max-w-[860px] flex-col gap-4">
            <p className="font-note text-[28px] leading-tight text-gold">The news moved. What moves next?</p>
            <h1 className="font-display text-[44px] font-extrabold leading-[1.02] tracking-tight sm:text-[64px]">
              Paste a headline. See which stocks{" "}
              <span className="inline-block -rotate-[1.5deg] bg-salmon px-2.5 pb-1 text-ground shadow-[6px_7px_0_var(--down-fill)]">
                it hits next.
              </span>
            </h1>
            <p className="max-w-[720px] text-[19px] text-muted">
              Ripple follows the news through a map of {graph?.nodes.length ?? 79} parts of the economy and{" "}
              {graph?.edges.length ?? 170} cause-and-effect links, then shows which stocks are likely to rise or fall,
              when, and the exact chain behind every call.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runHeadline(headline);
            }}
            className="flex max-w-[900px] flex-col gap-3 border-2 border-ground bg-paper p-2 shadow-[7px_7px_0_var(--money)] sm:flex-row"
          >
            <label htmlFor="headline" className="sr-only">
              Headline
            </label>
            <input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Fed signals interest rates will stay higher for longer"
              className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[17px] text-ground outline-none placeholder:text-[#6d6a72]"
            />
            <button
              disabled={running || !headline.trim()}
              className="h-12 border-2 border-ground bg-signal px-7 text-[17px] font-bold text-ground shadow-[4px_4px_0_var(--ground)] transition hover:-translate-x-0.5 hover:-translate-y-0.5 disabled:opacity-60"
            >
              {running ? "Tracing…" : "Trace it"}
            </button>
          </form>

          {samples.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[15px] text-muted">Or try an example. These load instantly.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {samples.map((s, i) => (
                  <button
                    key={s.slug}
                    onClick={() => runSample(s)}
                    disabled={running}
                    className={`halftone flex flex-col gap-1.5 p-4 text-left text-ground transition hover:-translate-y-1 disabled:opacity-60 ${
                      i % 2 ? "rotate-[0.8deg] bg-salmon" : "-rotate-[0.8deg] bg-paper"
                    } ${asked === s.headline ? "shadow-[6px_6px_0_var(--signal)]" : "shadow-[6px_6px_0_rgba(0,0,0,.45)]"}`}
                  >
                    <span className="relative text-[12px] font-bold opacity-60">Saved example</span>
                    <span className="relative font-display text-[19px] font-extrabold leading-[1.1]">{s.headline}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button onClick={() => setExplore(!explore)} aria-expanded={explore} className="self-start text-[15px] text-link hover:underline">
              {explore ? "Hide" : "Or skip the headline and explore one part of the economy (no AI, free)"}
            </button>
            {explore && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-panel p-4">
                <label htmlFor="force" className="text-[16px]">
                  What if
                </label>
                <select
                  id="force"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="h-11 rounded-xl border border-line bg-panel-2 px-3 text-[16px]"
                >
                  {forces.map(([theme, ns]) => (
                    <optgroup key={theme} label={theme}>
                      {ns.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="flex rounded-xl border border-line p-1">
                  {[1, -1].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      aria-pressed={direction === d}
                      className={`rounded-lg px-4 py-1.5 ${direction === d ? "bg-panel-2 font-bold" : "text-muted"}`}
                    >
                      {d > 0 ? "rises" : "falls"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => runForce(source, direction)}
                  disabled={running || !graph}
                  className="h-11 rounded-xl bg-signal px-5 font-bold text-ground disabled:opacity-50"
                >
                  Show the ripple
                </button>
              </div>
            )}
          </div>
          {loadError && (
            <p className="rounded-2xl bg-down-soft p-4 text-down">
              Can&apos;t reach the Ripple server right now ({loadError}). Refresh in a minute.
            </p>
          )}
        </section>

        {/* answer */}
        <div ref={results} className="scroll-mt-4">
          {asked && (
            <section className="flex flex-col gap-8">
              <div className="flex max-w-[940px] flex-col gap-3">
                <div className="halftone self-start -rotate-1 bg-salmon px-5 py-3.5 text-ground shadow-[6px_6px_0_rgba(0,0,0,.45)]">
                  <p className="relative text-[12px] font-bold opacity-60">{live ? live.source : "You asked about"}</p>
                  <p className="relative font-display text-[24px] font-extrabold leading-tight">{asked}</p>
                </div>
                {live && (
                  <p className="text-[15px] text-muted">
                    {live.source}, {ago(live.published ?? live.traced_at)}.{" "}
                    {live.url && (
                      <a href={live.url} target="_blank" rel="noreferrer" className="text-link hover:underline">
                        Read the article
                      </a>
                    )}
                    <br />
                    Picked up by the robot, which read this as {live.pick.sources.map((d) => L.name(d).toLowerCase()).join(" and ")}{" "}
                    going {live.pick.direction > 0 ? "up" : "down"}
                    {live.pick.how === "rule" ? " using a saved rule." : ` from the words “${live.pick.matched.join("”, “")}”.`} No AI was involved, so
                    the answer below is built straight from the map.
                  </p>
                )}
                {shareUrl && !running && (
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(shareUrl).then(() => setCopied(true), () => {});
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="self-start text-[15px] text-link hover:underline"
                  >
                    {copied ? "Link copied" : "Copy a link to this result"}
                  </button>
                )}
              </div>

              {running && !analysis && <Progress steps={steps} />}
              {error && <p className="rounded-2xl bg-down-soft p-5 text-[17px] text-down">{error}</p>}

              {brief && !answered && (
                <div className="flex max-w-[860px] flex-col gap-3 rounded-3xl bg-panel p-7">
                  <h2 className="font-display text-[30px] font-bold leading-tight">
                    {brief.type === "unknown_entity" ? "We couldn't place that in the map." : "No ripple here."}
                  </h2>
                  <p className="text-[18px]">{paragraphs.join(" ")}</p>
                  <p className="font-note text-[24px] text-link">
                    That&apos;s on purpose: Ripple says so instead of making something up.
                  </p>
                </div>
              )}

              {answered && view && (
                <>
                  <div data-reveal className="flex max-w-[980px] flex-col gap-3">
                    <p className="font-note text-[26px] text-gold">Ripple&apos;s read</p>
                    <h2 className="font-display text-[32px] font-bold leading-[1.12] tracking-tight sm:text-[42px]">{headlineVerdict}</h2>
                    {detail && <p className="text-[19px] leading-relaxed text-muted">{detail}</p>}
                    {earlier.length > 0 && (
                      <p className="rounded-2xl bg-signal-soft p-4 text-[16px]">
                        This adds to earlier news on the same part of the economy: {earlier.map((m) => `“${m.headline}”`).join(", ")}.
                      </p>
                    )}
                  </div>

                  <div data-reveal className={`grid gap-6 ${tab === "map" ? "" : "lg:grid-cols-[minmax(0,1fr)_380px]"}`}>
                    <div className="flex min-w-0 flex-col gap-4">
                      <div role="tablist" aria-label="See it as" className="flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-[15px] text-muted">See it as</span>
                        {TABS.map((t) => (
                          <button
                            key={t.id}
                            role="tab"
                            aria-selected={tab === t.id}
                            title={t.hint}
                            onClick={() => setTab(t.id)}
                            className={`border-[1.5px] px-4 py-2 text-[15px] font-bold transition ${
                              tab === t.id
                                ? "border-ground bg-signal text-ground shadow-[3px_3px_0_rgba(0,0,0,.5)]"
                                : "border-line bg-panel text-muted hover:border-gold hover:text-ink"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[15px] text-muted">{TABS.find((t) => t.id === tab)?.hint}. Click anything to see why.</p>
                      <div role="tabpanel">
                        {tab === "story" && (
                          <div className="rounded-3xl bg-panel p-5 sm:p-6">
                            <StoryView {...view} />
                          </div>
                        )}
                        {tab === "rings" && <RingsView {...view} />}
                        {tab === "flow" && <FlowView {...view} />}
                        {tab === "heat" && <HeatView {...view} />}
                        {tab === "map" && graph && (
                          <div className="h-[560px] overflow-hidden rounded-3xl bg-panel lg:h-[720px]">
                            <RippleGraph
                              graph={graph}
                              theme="dark"
                              ripple={{
                                sources: view.a.sources,
                                impacts: new Map(shown(view.a).map((d) => [d.id, d])),
                                revealed: new Set(view.a.drivers.map((d) => d.id)),
                                focusPath: selected?.path ?? null,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <aside className={tab === "map" ? "grid items-start gap-5 lg:grid-cols-2" : "flex flex-col gap-5"}>
                      <Board downs={view.downs} ups={view.ups} selected={selected} onSelect={setSelected} />
                      <WhyCard a={view.a} L={L} selected={selected} />
                    </aside>
                  </div>
                </>
              )}

              {!running && steps.length > 0 && (
                <UnderTheHood
                  steps={steps}
                  note={costNote}
                  onCompare={
                    brief && !saved
                      ? async () => {
                          setPlain("Asking…");
                          try {
                            setPlain(await compare(asked));
                          } catch (e) {
                            setPlain(e instanceof Error ? e.message : String(e));
                          }
                        }
                      : undefined
                  }
                  compareText={plain}
                />
              )}
            </section>
          )}
        </div>

        <LiveFeed onOpen={runLive} active={live?.id ?? null} />

        <Trust />

        {/* how it works */}
        <section id="how" className="flex scroll-mt-6 flex-col gap-6">
          <h2 className="font-display text-[34px] font-bold">How it works</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              ["Claude reads the headline", "It picks the parts of the economy the news moves, and in which direction. If nothing fits, it says so."],
              ["FalkorDB follows the links", `Every cause-and-effect link is stored in a graph database. It follows them up to 4 steps out, weakening the push and adding up the delay at each step.`],
              ["You see who's exposed", "Stocks likely to rise or fall, roughly when, and the chain behind each one. Every claim comes from the map, not from the AI's memory."],
            ].map(([t, d], i) => (
              <li key={t} className="flex flex-col gap-3 rounded-3xl bg-panel p-6">
                <span className="grid size-10 place-items-center rounded-full bg-signal font-bold text-ground">{i + 1}</span>
                <span className="font-display text-[22px] font-bold">{t}</span>
                <span className="text-[16px] text-muted">{d}</span>
              </li>
            ))}
          </ol>
        </section>

        {systemic && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-[34px] font-bold">The economy&apos;s pressure points</h2>
              <p className="max-w-[720px] text-[17px] text-muted">
                Ranked live from the map. Click one to see what happens if it rises.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <PressureList
                title="A shock here spreads the furthest"
                items={systemic.spreaders.map((s) => ({ id: s.id, value: s.reach, label: `reaches ${s.reach} other parts` }))}
                L={L}
                onPick={(id) => runForce(id, 1)}
              />
              <PressureList
                title="Shocks pile up here"
                items={systemic.drivers.map((s) => ({ id: s.id, value: s.pagerank, label: s.theme }))}
                L={L}
                onPick={(id) => runForce(id, 1)}
              />
            </div>
          </section>
        )}

        {events.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-[26px] font-bold">Recently traced</h2>
            <ul className="flex flex-col gap-2">
              {events.slice(0, 6).map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-panel px-4 py-3">
                  <span>{e.headline}</span>
                  <span className="text-[14px] text-muted">
                    {e.drivers.map((d) => L.name(d)).join(", ")} {e.direction > 0 ? "up" : "down"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-line px-5 py-8 text-center text-[14px] text-muted">
        Built on FalkorDB for Graph Hacks. Ripple describes exposure, not investment advice.
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="var(--signal)" strokeWidth="2" />
      <circle cx="10" cy="10" r="3.5" fill="var(--signal)" />
    </svg>
  );
}

// amber ticker tape of the robot's latest calls
function Tape() {
  const [calls, setCalls] = useState<[string, number][]>([]);
  useEffect(() => {
    getLiveFeed().then(
      (f) => setCalls(f.items.slice(0, 10).flatMap((i) => i.top.slice(0, 2).map((t) => [t.ticker, t.direction] as [string, number]))),
      () => {},
    );
  }, []);
  if (!calls.length) return <div className="h-[46px]" />;
  const one = calls.map(([t, d], i) => (
    <span key={i} className="flex items-center gap-2">
      {t} <span className={d > 0 ? "text-[#075c34]" : "text-[#b3180a]"}>{d > 0 ? "▲" : "▼"}</span>
      <span className="opacity-40">|</span>
    </span>
  ));
  return (
    <a href="#live" aria-label="The robot's latest calls" className="relative z-10 block -rotate-[0.6deg] overflow-hidden border-y-2 border-ground bg-signal text-ground">
      <div className="tape-run flex w-max py-2.5 font-mono text-[15px] font-bold whitespace-nowrap">
        {[0, 1].map((k) => (
          <span key={k} className="flex gap-7 pr-7">
            {one}
          </span>
        ))}
      </div>
    </a>
  );
}

function Progress({ steps }: { steps: TraceStep[] }) {
  return (
    <div className="flex max-w-[640px] flex-col gap-3 rounded-3xl bg-panel p-6" aria-live="polite">
      <p className="font-display text-[22px] font-bold">Working on it…</p>
      <ol className="flex flex-col gap-2 text-[16px]">
        <li className="flex items-center gap-3">
          <Dot done={steps.length > 0} />
          Reading the headline
        </li>
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3">
            <Dot done={!s.pending} />
            {stepText(s.name)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Dot({ done }: { done: boolean }) {
  return done ? (
    <span className="grid size-5 place-items-center rounded-full bg-up-fill text-[12px] text-white" aria-label="done">
      ✓
    </span>
  ) : (
    <span className="size-5 animate-pulse rounded-full border-2 border-signal" aria-label="in progress" />
  );
}

function Trust() {
  const dots = (n: number, on: string) =>
    Array.from({ length: 10 }, (_, k) => <span key={k} className={`size-4 rounded-full ${k < n ? on : "bg-line"}`} />);
  return (
    <section className="flex flex-wrap items-center gap-8 rounded-3xl bg-panel p-6 sm:p-8">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
        <h2 className="font-display text-[28px] font-bold">Can you trust this?</h2>
        <p className="text-[16px] text-muted">
          We replayed 10 real past events and checked what the flagged stocks did 20 days later. Ten events is a small
          sample, so treat this as a sanity check, not proof.
        </p>
      </div>
      <div className="flex flex-[1_1_380px] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-28 font-bold">Ripple</span>
          <span className="flex gap-1.5">{dots(7, "bg-up")}</span>
          <span className="font-bold">7 of 10 right</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-28 text-muted">Random picks</span>
          <span className="flex gap-1.5">{dots(5, "bg-muted")}</span>
          <span className="text-muted">about 5 of 10</span>
        </div>
      </div>
    </section>
  );
}

function PressureList({
  title,
  items,
  L,
  onPick,
}: {
  title: string;
  items: { id: string; value: number; label: string }[];
  L: ReturnType<typeof makeLookup>;
  onPick: (id: string) => void;
}) {
  const max = Math.max(...items.map((i) => i.value), 1e-9);
  return (
    <div className="flex flex-col gap-2 rounded-3xl bg-panel p-5">
      <h3 className="mb-1 font-display text-[20px] font-bold">{title}</h3>
      {items.map((i) => (
        <button key={i.id} onClick={() => onPick(i.id)} className="flex flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left hover:bg-panel-2">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-bold">{L.name(i.id)}</span>
            <span className="shrink-0 text-[14px] text-muted">{i.label}</span>
          </span>
          <span className="h-1.5 rounded-full bg-line">
            <span className="block h-1.5 rounded-full bg-signal" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
        </button>
      ))}
    </div>
  );
}
