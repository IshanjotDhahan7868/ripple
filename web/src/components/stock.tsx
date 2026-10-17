"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/chrome";
import { UnderTheHood } from "@/components/hood";
import { Ticker } from "@/components/ticker";
import { getAsset, getGraph, type AssetMover, type AssetProfile } from "@/lib/api";
import { getCasebook, pct, type CaseEvent } from "@/lib/casebook";
import { ago, getLedger, type LedgerItem } from "@/lib/live";
import { company, makeLookup, when, type Lookup } from "@/lib/model";

const TYPE: Record<string, string> = { equity: "Stock", etf: "Fund (ETF)", commodity: "Commodity" };

export function StockView() {
  const raw = useParams<{ ticker: string }>().ticker;
  const ticker = decodeURIComponent(raw ?? "");
  const [p, setP] = useState<AssetProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [L, setL] = useState<Lookup>(() => makeLookup({ nodes: [], edges: [] }));
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [cases, setCases] = useState<CaseEvent[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getAsset(ticker).then(setP, (e) => setErr(e instanceof Error ? e.message : String(e)));
    getGraph().then((g) => setL(makeLookup(g)), () => {});
    getLedger().then(setLedger, () => {});
    getCasebook().then((c) => setCases(c.events), () => {});
  }, [ticker]);

  const calls = useMemo(
    () => ledger.filter((i) => !i.withdrawn && i.top.some((t) => t.ticker === ticker)).sort((a, b) => b.traced_at - a.traced_at),
    [ledger, ticker],
  );
  const tested = cases.flatMap((e) => e.picks.filter((x) => x.ticker === ticker).map((x) => ({ e, x })));
  const max = Math.max(...(p?.movers.map((m) => m.strength) ?? [1]));
  const direct = p?.movers.filter((m) => m.path.length === 1) ?? [];
  const upstream = p?.movers.filter((m) => m.path.length > 1) ?? [];
  const name = company(ticker);

  return (
    <div className="grain relative min-h-screen overflow-x-clip">
      <SiteHeader />
      <main className="mx-auto flex max-w-[1240px] flex-col gap-14 px-5 pb-24 pt-12 sm:px-8">
        <section className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="font-note text-[28px] leading-tight text-gold">Stock profile</p>
            <h1 className="flex flex-wrap items-baseline gap-x-5 gap-y-2 font-display font-extrabold tracking-tight">
              <span className="bg-paper px-3 pb-1 text-[64px] leading-none text-ground shadow-[7px_7px_0_var(--money)] sm:text-[88px]">{ticker}</span>
              {name !== ticker && <span className="text-[30px] leading-tight sm:text-[40px]">{name}</span>}
            </h1>
            {p && (
              <p className="max-w-[720px] text-[18px] text-muted">
                {TYPE[p.type] ?? p.type}. On the map it&apos;s tied directly to{" "}
                <b className="text-ink">{p.exposed_to.map((d) => L.name(d)).join(" and ")}</b>, so it tends to move when that
                does. Below is everything upstream that can push it, traced through FalkorDB.
              </p>
            )}
          </div>
          {p && (
            <div className="min-w-[280px] border-[1.5px] border-line bg-[#0a0d15] font-mono text-[14px] shadow-[6px_6px_0_rgba(0,0,0,.45)]">
              <div className="flex justify-between bg-signal px-3 py-1.5 font-bold text-ground">
                <span>{ticker}</span>
                <span>{(TYPE[p.type] ?? p.type).toUpperCase()}</span>
              </div>
              {[
                ["Forces that reach it", String(p.movers.length)],
                ["Live calls", String(calls.length)],
                ["Backtest picks", tested.length ? `${tested.filter((t) => t.x.excess_20d > 0).length} of ${tested.length} right` : "none"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 border-t border-line px-3 py-2 text-muted">
                  <span>{k}</span>
                  <b className="text-signal">{v}</b>
                </div>
              ))}
              <a
                href={`https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`}
                target="_blank"
                rel="noreferrer"
                className="block border-t border-line px-3 py-2 text-link hover:underline"
              >
                Price chart on Yahoo Finance
              </a>
            </div>
          )}
        </section>

        {err && (
          <div className="flex flex-col gap-3 border-[1.5px] border-line bg-panel p-6">
            <p className="font-display text-[24px] font-bold">{err}</p>
            <p className="text-muted">
              Ripple only covers stocks its map links to the economy. <Link href="/app" className="text-link hover:underline">Trace a headline</Link> to
              find exposed stocks.
            </p>
          </div>
        )}
        {!p && !err && <p className="text-muted">Walking the map backwards from {ticker}…</p>}

        {p && (
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-[32px] font-extrabold leading-tight">What moves {ticker}</h2>
                <p className="text-[16px] text-muted">
                  Read each row as &ldquo;if this rises&rdquo;. A falling force flips the arrow. Click a row to see the chain.
                </p>
              </div>
              <ol className="flex flex-col gap-2.5">
                {[...direct, ...upstream].map((m) => (
                  <Mover key={m.source} m={m} max={max} ticker={ticker} L={L} open={open === m.source} onToggle={() => setOpen(open === m.source ? null : m.source)} />
                ))}
              </ol>
            </div>

            <aside className="flex flex-col gap-6">
              <div className="halftone rotate-[0.6deg] border-2 border-ground bg-salmon p-5 text-ground shadow-[7px_7px_0_rgba(0,0,0,.5)]">
                <h3 className="relative font-display text-[22px] font-extrabold">On the live tape</h3>
                {calls.length === 0 ? (
                  <p className="relative mt-2 text-[15px]">The news robot hasn&apos;t flagged {ticker} yet.</p>
                ) : (
                  <ul className="relative mt-3 flex flex-col gap-3">
                    {calls.slice(0, 6).map((c) => {
                      const d = c.top.find((t) => t.ticker === ticker)!.direction;
                      const g = c.grade?.["5"];
                      return (
                        <li key={c.id} className="border-t border-ground/20 pt-3">
                          <Link href={`/app?live=${c.id}`} className="flex flex-col gap-1 hover:underline">
                            <span className="text-[13px] font-bold opacity-60">
                              {c.source}, {ago(c.traced_at)}
                            </span>
                            <span className="font-bold leading-snug">{c.headline}</span>
                            <span className="font-mono text-[13px] font-bold">
                              <span className={d > 0 ? "text-money" : "text-down-fill"}>{d > 0 ? "▲ called up" : "▼ called down"}</span>
                              <span className="opacity-60"> · {g ? `${g.hit ? "right" : "wrong"}, ${pct(g.excess)} vs S&P` : "waiting for 5 days"}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {tested.length > 0 && (
                <div className="border-[1.5px] border-line bg-panel p-5 shadow-[6px_6px_0_rgba(0,0,0,.45)]">
                  <h3 className="font-display text-[22px] font-extrabold">In the backtest</h3>
                  <ul className="mt-3 flex flex-col gap-3">
                    {tested.map(({ e, x }) => (
                      <li key={e.date} className="flex flex-col gap-1 border-t border-line pt-3">
                        <Link href={`/casebook#${e.date}`} className="font-bold leading-snug hover:underline">
                          {e.headline}
                        </Link>
                        <span className="font-mono text-[13px] text-muted">
                          {e.date} · called {x.direction > 0 ? "▲" : "▼"} ·{" "}
                          <b className={x.excess_20d > 0 ? "text-up" : "text-down"}>{pct(x.excess_20d)} vs S&amp;P after 20 days</b>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {p.peers.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-display text-[22px] font-extrabold">Moves with</h3>
                  <p className="-mt-2 text-[15px] text-muted">Tied to the same part of the economy.</p>
                  <div className="flex flex-wrap gap-2">
                    {p.peers.map((x) => (
                      <Ticker key={x.ticker} t={x.ticker} />
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </section>
        )}

        {p && (
          <UnderTheHood
            steps={[{ name: "asset_profile", queries: p.queries }]}
            lead="No AI here: three fixed Cypher queries walk the graph backwards from this stock."
          />
        )}
      </main>
      <footer className="border-t border-line px-5 py-8 text-center text-[14px] text-muted">
        Built on FalkorDB for Graph Hacks. Ripple describes exposure, not investment advice.
      </footer>
    </div>
  );
}

function Mover({ m, max, ticker, L, open, onToggle }: {
  m: AssetMover;
  max: number;
  ticker: string;
  L: Lookup;
  open: boolean;
  onToggle: () => void;
}) {
  const up = m.sign > 0;
  return (
    <li className={`border-[1.5px] bg-panel shadow-[5px_5px_0_rgba(0,0,0,.4)] ${open ? "border-gold" : "border-line"}`}>
      <button onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 p-4 text-left sm:grid-cols-[minmax(0,1fr)_160px_auto]">
        <span className="flex min-w-0 flex-col">
          <span className="font-bold">{L.name(m.source)} rises</span>
          <span className="text-[14px] text-muted">
            {m.path.length === 1 ? "Directly tied" : `${m.path.length - 1} ${m.path.length === 2 ? "step" : "steps"} away`}, {when(m.lag_months)}
          </span>
        </span>
        <span className="order-3 col-span-2 h-2 bg-line sm:order-none sm:col-span-1">
          <span className={`block h-2 ${up ? "bg-up" : "bg-down"}`} style={{ width: `${(m.strength / max) * 100}%` }} />
        </span>
        <span className={`font-mono text-[15px] font-bold ${up ? "text-up" : "text-down"}`}>
          {ticker} {up ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <ol className="flex flex-col gap-2 border-t border-line px-4 py-4">
          {m.path.map((id, i) => {
            const e = i > 0 ? L.edge(m.path[i - 1], id) : undefined;
            return (
              <li key={id} className="flex gap-3">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-gold" />
                <span className="flex flex-col">
                  <span className="font-bold">{L.name(id)}</span>
                  {e?.why && <span className="text-[14px] text-muted">{e.why}</span>}
                </span>
              </li>
            );
          })}
          <li className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <span className="flex gap-3">
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-signal" />
              <span className="font-bold">
                {ticker} {up ? "tends to rise" : "tends to fall"}
              </span>
            </span>
            <Link href={`/app?force=${m.source}`} className="text-[14px] font-bold text-link hover:underline">
              Everything else {L.name(m.source).toLowerCase()} moves
            </Link>
          </li>
        </ol>
      )}
    </li>
  );
}
