"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/chrome";
import { Ticker } from "@/components/ticker";
import { getGraph } from "@/lib/api";
import { ago, getLedger, getLiveFeed, type LedgerItem, type LiveFeed } from "@/lib/live";
import { company, makeLookup, type Lookup } from "@/lib/model";

type Filter = "all" | "graded" | "waiting" | "withdrawn";
const WEEK = 7 * 24 * 3600;

const pct = (x: number) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const day = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const clock = (ts: number) => new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function LiveTape() {
  const [ledger, setLedger] = useState<LedgerItem[] | null>(null);
  const [feed, setFeed] = useState<LiveFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const [L, setL] = useState<Lookup>(() => makeLookup({ nodes: [], edges: [] }));
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    getLedger().then((l) => setLedger([...l].sort((a, b) => b.traced_at - a.traced_at)), () => setFailed(true));
    getLiveFeed().then(setFeed, () => {});
    getGraph().then((g) => setL(makeLookup(g)), () => {});
  }, []);

  const counts = useMemo(() => {
    const l = ledger ?? [];
    return {
      all: l.length,
      graded: l.filter((i) => !i.withdrawn && i.grade?.["5"]).length,
      waiting: l.filter((i) => !i.withdrawn && !i.grade?.["5"]).length,
      withdrawn: l.filter((i) => i.withdrawn).length,
    };
  }, [ledger]);

  const shown = (ledger ?? []).filter((i) =>
    filter === "all" ? true : filter === "withdrawn" ? !!i.withdrawn : !i.withdrawn && (filter === "graded") === !!i.grade?.["5"],
  );
  const days = shown.reduce<[string, LedgerItem[]][]>((acc, it) => {
    const d = day(it.traced_at);
    if (acc.length && acc[acc.length - 1][0] === d) acc[acc.length - 1][1].push(it);
    else acc.push([d, [it]]);
    return acc;
  }, []);

  const s5 = feed?.score["5"], s20 = feed?.score["20"];

  return (
    <div className="grain relative min-h-screen overflow-x-clip">
      <SiteHeader active="/live" />
      <main className="mx-auto flex max-w-[1240px] flex-col gap-16 px-5 pb-24 pt-12 sm:px-8">
        <section className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex max-w-[720px] flex-col gap-3">
            <p className="font-note text-[28px] leading-tight text-gold">The live tape</p>
            <h1 className="font-display text-[44px] font-extrabold leading-[1.02] tracking-tight sm:text-[60px]">
              Every call the robot has made, graded in public.
            </h1>
            <p className="text-[18px] text-muted">
              Every 2 hours a robot reads business news, traces the headlines the map covers, and records which stocks are
              exposed. Each call is graded against the S&amp;P 500 after 5 and 20 trading days. Misreads are withdrawn
              before grading, and they stay on the record.
            </p>
          </div>
          <div className="min-w-[300px] border-[1.5px] border-line bg-[#0a0d15] font-mono text-[14px] shadow-[6px_6px_0_rgba(0,0,0,.45)]">
            <div className="flex justify-between bg-signal px-3 py-1.5 font-bold text-ground">
              <span>RIPPLE LIVE</span>
              <span>{feed ? `ran ${ago(feed.updated)}` : "…"}</span>
            </div>
            {[
              ["Calls made", ledger ? String(counts.all - counts.withdrawn) : "…"],
              ["Right after 5 days", s5 ? (s5.graded ? `${s5.right} of ${s5.graded}` : "first grades soon") : "…"],
              ["Right after 20 days", s20 ? (s20.graded ? `${s20.right} of ${s20.graded}` : "grading by mid-Nov") : "…"],
              ["Withdrawn misreads", ledger ? String(counts.withdrawn) : "…"],
              ["Cost to run", "$0"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 border-t border-line px-3 py-2 text-muted">
                <span>{k}</span>
                <b className="text-signal">{v}</b>
              </div>
            ))}
          </div>
        </section>

        {ledger && <Pressure items={ledger} L={L} />}

        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-[34px] font-extrabold leading-tight">The timeline</h2>
            <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2">
              {(["all", "graded", "waiting", "withdrawn"] as Filter[]).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`border-[1.5px] px-3 py-1.5 text-[15px] font-bold capitalize ${
                    filter === f ? "border-ground bg-signal text-ground shadow-[3px_3px_0_rgba(0,0,0,.5)]" : "border-line bg-panel text-muted hover:border-gold hover:text-ink"
                  }`}
                >
                  {f} <span className="opacity-60">{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>

          {failed && <p className="text-muted">The live record can&apos;t be reached right now. Refresh in a minute.</p>}
          {!ledger && !failed && <p className="text-muted">Loading the record…</p>}
          {ledger && !shown.length && <p className="text-muted">Nothing here yet.</p>}

          <ol className="flex flex-col gap-10">
            {days.map(([d, items]) => (
              <li key={d} className="flex flex-col gap-4">
                <h3 className="font-note text-[26px] text-gold">{d}</h3>
                <ol className="relative flex flex-col gap-5 border-l-2 border-line pl-6 sm:pl-8">
                  {items.map((it) => (
                    <Entry key={it.id} it={it} L={L} />
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="border-t border-line px-5 py-8 text-center text-[14px] text-muted">
        Built on FalkorDB for Graph Hacks. Ripple describes exposure, not investment advice.
      </footer>
    </div>
  );
}

function Entry({ it, L }: { it: LedgerItem; L: Lookup }) {
  const g5 = it.grade?.["5"], g20 = it.grade?.["20"];
  const out = !!it.withdrawn;
  const read = it.pick.sources.map((s) => L.name(s).toLowerCase()).join(" and ");
  return (
    <li className="relative">
      <span
        aria-hidden
        className={`absolute top-6 -left-[33px] size-4 rounded-full border-2 border-ground sm:-left-[41px] ${
          out ? "bg-line" : g5 ? (g5.hit ? "bg-up" : "bg-down") : "bg-gold"
        }`}
      />
      <article
        className={`flex flex-col gap-3 border-[1.5px] p-5 shadow-[6px_6px_0_rgba(0,0,0,.45)] ${
          out ? "border-dashed border-line bg-ground opacity-75" : "border-line bg-panel"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-muted">
          <span>
            {clock(it.traced_at)} · {it.source}
          </span>
          {out ? (
            <span className="-rotate-2 border-2 border-down px-2 py-0.5 font-mono text-[13px] font-bold text-down">WITHDRAWN</span>
          ) : g5 ? (
            <span className={`px-2.5 py-1 font-mono text-[13px] font-bold ${g5.hit ? "bg-up-soft text-up" : "bg-down-soft text-down"}`}>
              {g5.hit ? "RIGHT" : "WRONG"} · 5d {pct(g5.excess)} vs S&amp;P{g20 ? ` · 20d ${pct(g20.excess)}` : ""}
            </span>
          ) : (
            <span className="bg-panel-2 px-2.5 py-1 font-mono text-[13px] text-muted">WAITING FOR 5 TRADING DAYS</span>
          )}
        </div>
        <p className={`font-display text-[22px] font-bold leading-snug ${out ? "line-through decoration-down/70" : ""}`}>{it.headline}</p>
        <p className="text-[15px] text-muted">
          <span className="font-note text-[19px] text-ink">Read as</span> {read} going {it.pick.direction > 0 ? "up" : "down"}
          {it.pick.how === "rule" ? ", by a saved rule" : `, from “${it.pick.matched.join("”, “")}”`}.
          {it.revises && " A corrected read of an earlier call."}
          {out && <span className="text-down"> Withdrawn: {it.withdrawn!.reason}.</span>}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex flex-wrap gap-1.5">
            {it.top.slice(0, 6).map((t) => (
              <Ticker key={t.ticker} t={t.ticker} dir={t.direction} />
            ))}
          </span>
          {!out && (
            <span className="flex gap-4 text-[15px] font-bold">
              {it.url && (
                <a href={it.url} target="_blank" rel="noreferrer" className="text-muted hover:text-ink">
                  Article
                </a>
              )}
              <Link href={`/app?live=${it.id}`} className="text-link hover:underline">
                Open the chain
              </Link>
            </span>
          )}
        </div>
      </article>
    </li>
  );
}

// what the last week of news has been pushing, added up across every live call
function Pressure({ items, L }: { items: LedgerItem[]; L: Lookup }) {
  const now = Math.max(...items.map((i) => i.traced_at));
  const recent = items.filter((i) => !i.withdrawn && now - i.traced_at < WEEK);
  const forces = new Map<string, { up: number; down: number }>();
  const stocks = new Map<string, { net: number; n: number }>();
  for (const it of recent) {
    for (const s of it.pick.sources) {
      const f = forces.get(s) ?? { up: 0, down: 0 };
      if (it.pick.direction > 0) f.up++;
      else f.down++;
      forces.set(s, f);
    }
    for (const t of it.top) {
      const s = stocks.get(t.ticker) ?? { net: 0, n: 0 };
      s.net += t.direction;
      s.n++;
      stocks.set(t.ticker, s);
    }
  }
  const F = [...forces.entries()].sort((a, b) => b[1].up + b[1].down - (a[1].up + a[1].down)).slice(0, 7);
  const fmax = Math.max(1, ...F.map(([, f]) => f.up + f.down));
  const S = [...stocks.entries()].sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net) || b[1].n - a[1].n).slice(0, 10);
  if (!recent.length) return null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[34px] font-extrabold leading-tight">What the news is pushing this week</h2>
        <p className="max-w-[720px] text-[17px] text-muted">
          Added up across {recent.length} live {recent.length === 1 ? "call" : "calls"} from the last 7 days. The more
          headlines lean on the same part of the economy, the longer its bar.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
        <div className="halftone -rotate-[0.5deg] border-2 border-ground bg-paper p-6 text-ground shadow-[8px_8px_0_rgba(0,0,0,.5)]">
          <h3 className="relative mb-4 font-display text-[22px] font-extrabold">Forces in the news</h3>
          <ul className="relative flex flex-col gap-3">
            {F.map(([id, f]) => {
              const net = f.up - f.down;
              return (
                <li key={id} className="grid grid-cols-[minmax(0,170px)_1fr_auto] items-center gap-3">
                  <span className="truncate font-bold">{L.name(id)}</span>
                  <span className="flex h-6 bg-[#e6dcc8]">
                    <span className="h-full bg-money" style={{ width: `${(f.up / fmax) * 100}%` }} />
                    <span className="h-full bg-down-fill" style={{ width: `${(f.down / fmax) * 100}%` }} />
                  </span>
                  <span className={`w-28 text-right font-mono text-[14px] font-bold whitespace-nowrap ${net >= 0 ? "text-money" : "text-down-fill"}`}>
                    {net >= 0 ? "▲" : "▼"} {f.up + f.down} {f.up + f.down === 1 ? "story" : "stories"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="border-[1.5px] border-line bg-[#0a0d15] font-mono text-[14px] shadow-[6px_6px_0_rgba(0,0,0,.45)]">
          <div className="flex justify-between bg-signal px-3 py-1.5 font-bold text-ground">
            <span>MOST EXPOSED THIS WEEK</span>
            <span>net calls</span>
          </div>
          {S.map(([t, s]) => (
            <Link key={t} href={`/stock/${encodeURIComponent(t)}`} className="flex items-center justify-between gap-4 border-t border-line px-3 py-2 hover:bg-panel">
              <span className="flex min-w-0 items-baseline gap-3">
                <b className="w-14 shrink-0 text-ink">{t}</b>
                <span className="truncate font-sans text-[13px] text-muted">{company(t)}</span>
              </span>
              <b className={s.net > 0 ? "text-up" : s.net < 0 ? "text-down" : "text-muted"}>
                {s.net > 0 ? "▲".repeat(Math.min(s.net, 5)) : s.net < 0 ? "▼".repeat(Math.min(-s.net, 5)) : "mixed"}
              </b>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
