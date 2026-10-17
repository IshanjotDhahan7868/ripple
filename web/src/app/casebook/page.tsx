import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/chrome";
import { Ticker } from "@/components/ticker";
import { pct, type Casebook } from "@/lib/casebook";
import data from "../../../public/casebook.json";

export const metadata: Metadata = {
  title: "Casebook · Ripple",
  description: "Ten real headlines from 2026, what Ripple called from a frozen map, and what the stocks did next.",
};

const book = data as Casebook;

export default function Page() {
  const a20 = book.aggregate["20d"];
  const a5 = book.aggregate["5d"];
  const right20 = Math.round(a20.ripple_pick_hit_rate * a20.n_picks);
  const frozen = book.graph.match(/\((.+)\)/)?.[1] ?? book.graph;
  const events = [...book.events].sort((x, y) => x.date.localeCompare(y.date));

  return (
    <div className="grain relative min-h-screen overflow-x-clip">
      <SiteHeader active="/casebook" />
      <main className="mx-auto flex max-w-[1240px] flex-col gap-14 px-5 pb-24 pt-12 sm:px-8">
        <section className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex flex-col gap-4">
            <p className="font-note text-[28px] leading-tight text-gold">The casebook</p>
            <h1 className="max-w-[760px] font-display text-[44px] font-extrabold leading-[1.02] tracking-tight sm:text-[60px]">
              Ten real headlines. What Ripple said. What the market did.
            </h1>
            <p className="max-w-[680px] text-[18px] text-muted">
              We froze Ripple&apos;s map on {frozen}, then fed it ten big headlines from the months after. For each one it
              named five stocks and a direction. Below is every call, checked against the S&amp;P 500 twenty trading days
              later. Nothing here was picked after the fact.
            </p>
          </div>
          <div className="border-[1.5px] border-line bg-[#0a0d15] font-mono text-[14px] shadow-[6px_6px_0_rgba(0,0,0,.45)]">
            <div className="flex justify-between bg-signal px-3 py-1.5 font-bold text-ground">
              <span>SCORECARD</span>
              <span>{a20.n_picks} CALLS</span>
            </div>
            {[
              ["Right after 20 days", `${right20} of ${a20.n_picks} (${Math.round(a20.ripple_pick_hit_rate * 100)}%)`],
              ["Random stocks, same days", `about ${Math.round(a20.random_hit_rate_mean * 100)}%`],
              ["Headlines that came out ahead", `${a20.ripple_events_positive} of ${a20.n_events}`],
              ["Average edge per call", pct(a20.ripple_mean_signed_excess_per_pick)],
              ["Right after only 5 days", `${Math.round(a5.ripple_pick_hit_rate * 100)}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 border-t border-line px-3 py-2 text-muted">
                <span>{k}</span>
                <b className="text-right text-signal">{v}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="halftone relative -rotate-[0.4deg] border-2 border-ground bg-salmon p-6 text-ground shadow-[7px_7px_0_rgba(0,0,0,.5)]">
          <h2 className="relative font-display text-[24px] font-extrabold">How to read this honestly</h2>
          <ul className="relative mt-3 grid gap-x-8 gap-y-2 text-[16px] md:grid-cols-2">
            <li>&ldquo;Right&rdquo; means the stock beat the S&amp;P 500 in the direction Ripple called. A call that a stock falls is right if it lagged the index.</li>
            <li>Ten headlines is a small sample. Treat this as a sanity check that the map points the right way, not as proof of an edge.</li>
            <li>After five days it&apos;s a coin flip. The map is about knock-on effects, and those take weeks to show up in prices.</li>
            <li>Ripple describes exposure. It is not investment advice, and none of this was traded.</li>
          </ul>
        </section>

        <ol className="flex flex-col gap-8">
          {events.map((e) => {
            const right = e.picks.filter((p) => p.excess_20d > 0).length;
            const avg = e.picks.reduce((s, p) => s + p.excess_20d, 0) / e.picks.length;
            return (
              <li
                key={e.date}
                id={e.date}
                className="scroll-mt-24 border-[1.5px] border-line bg-panel shadow-[6px_6px_0_rgba(0,0,0,.45)] target:border-gold"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
                  <div className="flex min-w-0 max-w-[780px] flex-col gap-2">
                    <span className="font-mono text-[14px] font-bold text-gold">{e.date}</span>
                    <h2 className="font-display text-[24px] font-extrabold leading-tight">{e.headline}</h2>
                    <p className="text-[15px] text-muted">
                      Ripple read it as{" "}
                      <b className="text-ink">
                        {e.driver.replaceAll("_", " ")} {e.direction > 0 ? "rising" : "falling"}
                      </b>
                      .{" "}
                      {e.url && (
                        <a href={e.url} target="_blank" rel="noreferrer" className="text-link hover:underline">
                          Read the original story
                        </a>
                      )}
                    </p>
                  </div>
                  <div className={`shrink-0 px-4 py-2 text-center font-mono font-bold ${avg > 0 ? "bg-up-fill text-ink" : "bg-down-fill text-ink"}`}>
                    <div className="text-[28px] leading-none">
                      {right}/{e.picks.length}
                    </div>
                    <div className="mt-1 text-[12px]">right, {pct(avg)} avg</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left font-mono text-[14px]">
                    <thead className="text-muted">
                      <tr>
                        <th className="px-5 py-2 font-normal">Stock</th>
                        <th className="px-3 py-2 font-normal">Called</th>
                        <th className="px-3 py-2 text-right font-normal">Stock, 20 days</th>
                        <th className="px-3 py-2 text-right font-normal">S&amp;P, 20 days</th>
                        <th className="px-5 py-2 text-right font-normal">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.picks.map((p) => {
                        const ok = p.excess_20d > 0;
                        return (
                          <tr key={p.ticker} className="border-t border-line">
                            <td className="px-5 py-2.5">
                              <Ticker t={p.ticker} />
                            </td>
                            <td className={`px-3 py-2.5 font-bold ${p.direction > 0 ? "text-up" : "text-down"}`}>
                              {p.direction > 0 ? "▲ up" : "▼ down"}
                            </td>
                            <td className="px-3 py-2.5 text-right">{pct(p.ret_20d)}</td>
                            <td className="px-3 py-2.5 text-right text-muted">{pct(p.spy_20d)}</td>
                            <td className={`px-5 py-2.5 text-right font-bold ${ok ? "text-up" : "text-down"}`}>
                              {ok ? "Right" : "Wrong"} by {pct(Math.abs(p.excess_20d)).replace("+", "")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="text-center text-muted">
          Want to see it on today&apos;s news? The <Link href="/live" className="text-link hover:underline">live tape</Link> grades
          every new call the same way, in public.
        </p>
      </main>
      <footer className="border-t border-line px-5 py-8 text-center text-[14px] text-muted">
        Built on FalkorDB for Graph Hacks. Ripple describes exposure, not investment advice.
      </footer>
    </div>
  );
}
