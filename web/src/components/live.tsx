"use client";

import { useEffect, useState } from "react";
import { ago, getLiveFeed, type LiveFeed as Feed, type LiveSummary } from "@/lib/live";

const SHOW = 6;

function Status({ item }: { item: LiveSummary }) {
  const g = item.grade?.["5"];
  if (!g) return <span className="rounded-full bg-panel-2 px-3 py-1 text-[13px] text-muted">Waiting for 5 trading days</span>;
  return (
    <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${g.hit ? "bg-up-soft text-up" : "bg-down-soft text-down"}`}>
      {g.hit ? "Right" : "Wrong"} after 5 days
    </span>
  );
}

function Tickers({ item, up }: { item: LiveSummary; up: boolean }) {
  const list = item.top.filter((t) => (t.direction > 0) === up).slice(0, 4);
  if (!list.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-[14px] text-muted">{up ? "Rise" : "Fall"}</span>
      {list.map((t) => (
        <span key={t.ticker} className={`rounded-md px-2 py-0.5 text-[13px] font-bold ${up ? "bg-up-soft text-up" : "bg-down-soft text-down"}`}>
          {t.ticker}
        </span>
      ))}
    </span>
  );
}

export function LiveFeed({ onOpen, active }: { onOpen: (item: LiveSummary) => void; active: string | null }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    const load = () => getLiveFeed().then(setFeed, () => setFailed(true));
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (failed && !feed) return null;
  const items = feed ? (all ? feed.items : feed.items.slice(0, SHOW)) : [];
  const s5 = feed?.score["5"];

  return (
    <section id="live" className="flex scroll-mt-6 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <h2 className="flex items-center gap-3 font-display text-[30px] font-bold leading-tight">
            <span className="relative flex size-3" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-3 rounded-full bg-up" />
            </span>
            Today&apos;s news, traced on its own
          </h2>
          <p className="text-[16px] text-muted">
            Every 2 hours a robot reads business news, traces the headlines the map covers, and later checks each call
            against real prices. It runs for free, with no AI. Every so often Claude checks its work and teaches it new
            rules. {feed && <>Last run {ago(feed.updated)}.</>}
          </p>
        </div>
        {feed && s5 && (
          <div className="flex flex-col gap-0.5 rounded-2xl bg-panel px-5 py-3">
            <span className="font-display text-[22px] font-bold">
              {s5.graded ? `${s5.right} of ${s5.graded} right` : `${feed.total} calls so far`}
            </span>
            <span className="text-[14px] text-muted">
              {s5.graded
                ? `after 5 trading days, vs the S&P 500. ${feed.score.waiting} still waiting.`
                : "First grades land 5 trading days after each call."}
            </span>
          </div>
        )}
      </div>

      {feed?.checkup && (
        <p className="max-w-[760px] rounded-2xl bg-panel px-5 py-3 text-[15px]">
          <span className="font-note text-[21px] text-link">Last checkup {ago(feed.checkup.at)}:</span> {feed.checkup.note}
          {!!feed.withdrawn && (
            <span className="text-muted">
              {" "}
              {feed.withdrawn} misread {feed.withdrawn === 1 ? "call was" : "calls were"} withdrawn before grading, and the
              count stays public.
            </span>
          )}
        </p>
      )}

      {!feed ? (
        <p className="text-muted">Loading today&apos;s headlines…</p>
      ) : feed.items.length === 0 ? (
        <p className="text-muted">The robot hasn&apos;t found a headline the map covers yet. Check back after the next run.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => onOpen(it)}
                aria-pressed={active === it.id}
                className={`flex h-full w-full flex-col gap-3 rounded-2xl border-2 p-4 text-left transition ${
                  active === it.id ? "border-link bg-panel-2" : "border-transparent bg-panel hover:bg-panel-2"
                }`}
              >
                <span className="text-[14px] text-muted">
                  {it.source}, {ago(it.published ?? it.traced_at)}
                </span>
                <span className="font-bold leading-snug">{it.headline}</span>
                <span className="flex flex-wrap gap-x-4 gap-y-2">
                  <Tickers item={it} up={false} />
                  <Tickers item={it} up />
                </span>
                <span className="mt-auto pt-1">
                  <Status item={it} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {feed && feed.items.length > SHOW && (
        <button onClick={() => setAll(!all)} className="self-start text-[15px] text-link hover:underline">
          {all ? "Show fewer" : `Show all ${feed.items.length}`}
        </button>
      )}
    </section>
  );
}
