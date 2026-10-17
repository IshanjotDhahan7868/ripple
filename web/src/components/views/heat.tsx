"use client";

import { company, strength, when, type Group, type Strength, type ViewProps } from "@/lib/model";

const SHADE: Record<"up" | "down", Record<Strength, string>> = {
  down: { Strong: "#b3262b", Medium: "#93262a", Weak: "#6e2a2e" },
  up: { Strong: "#1f7a47", Medium: "#1a6339", Weak: "#1d4a33" },
};
const TILE_H: Record<Strength, number> = { Strong: 128, Medium: 96, Weak: 72 };
const TICKER_SIZE: Record<Strength, string> = { Strong: "text-[30px]", Medium: "text-[23px]", Weak: "text-[18px]" };

function short(months: number) {
  if (months <= 0) return "now";
  if (months < 12) return `~${months} mo`;
  return `~${Math.round((months / 12) * 2) / 2} yr`;
}

const BUCKETS: { label: string; test: (m: number) => boolean }[] = [
  { label: "Right away", test: (m) => m <= 0 },
  { label: "Within 3 months", test: (m) => m > 0 && m <= 3 },
  { label: "Within a year", test: (m) => m > 3 && m <= 12 },
  { label: "In 1–2 years", test: (m) => m > 12 && m <= 24 },
  { label: "2+ years out", test: (m) => m > 24 },
];

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex-1 basis-[150px] rounded-xl bg-panel-2 px-4 py-3">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={`font-display text-[30px] font-bold leading-tight ${tone ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

export function HeatView({ a, L, downs, ups, max, selected, onSelect }: ViewProps) {
  const groups = [...downs, ...ups].sort(
    (p, q) => q.tickers.reduce((s, t) => s + t.score, 0) - p.tickers.reduce((s, t) => s + t.score, 0),
  );
  const fallCount = downs.reduce((s, g) => s + g.tickers.length, 0);
  const riseCount = ups.reduce((s, g) => s + g.tickers.length, 0);
  const biggest = [...downs, ...ups].sort((p, q) => q.score - p.score)[0];
  const isSel = (g: Group, ticker: string) =>
    !!selected && selected.up === g.up && selected.path.join(">") === g.path.join(">") && selected.tickers.includes(ticker);

  const buckets = BUCKETS.map((b) => {
    const all = a.drivers.filter((d) => d.hops >= 1 && b.test(d.lag_months)).sort((p, q) => q.impact - p.impact);
    return { label: b.label, shown: all.slice(0, 5), more: Math.max(0, all.length - 5) };
  }).filter((b) => b.shown.length);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Stat label="Stocks exposed" value={fallCount + riseCount} />
        <Stat label="Likely to fall" value={fallCount} tone="text-down" />
        <Stat label="Likely to rise" value={riseCount} tone="text-up" />
        <div className="flex-[2] basis-[260px] rounded-xl bg-panel-2 px-4 py-3">
          <div className="text-[13px] text-muted">Biggest hit</div>
          <div className="mt-1 text-[17px] font-bold leading-snug">
            {biggest
              ? `${biggest.name}, ${biggest.up ? "rising" : "falling"} (${biggest.strength.toLowerCase()}, ${when(biggest.months)})`
              : "Nothing strong enough to call"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[3] basis-[520px] rounded-2xl bg-panel p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
            <h3 className="font-display text-[20px] font-bold">Heat map</h3>
            <p className="text-[13px] text-muted">Bigger, deeper tile means a stronger push. Click one to see why.</p>
          </div>
          {groups.length ? (
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-ground p-1.5">
              {groups.map((g) => {
                const total = g.tickers.reduce((s, t) => s + t.score, 0);
                return (
                  <div
                    key={g.key}
                    className="flex min-w-[150px] flex-col gap-1"
                    style={{ flexGrow: total, flexBasis: `${Math.min(100, 12 + g.tickers.length * 9)}%` }}
                  >
                    <div className="truncate px-1 pt-0.5 text-[12px] text-muted">
                      {g.name} {g.up ? "↑" : "↓"}
                    </div>
                    <div className="flex flex-1 flex-wrap gap-1">
                      {g.tickers.map((t) => {
                        const s = strength(t.score, max);
                        const sel = isSel(g, t.ticker);
                        return (
                          <button
                            key={t.ticker}
                            type="button"
                            onClick={() => onSelect({ path: g.path, tickers: [t.ticker], up: g.up })}
                            title={`${company(t.ticker)}: ${g.up ? "likely to rise" : "likely to fall"}, ${s.toLowerCase()}, ${when(g.months)}`}
                            className={`flex min-w-[78px] flex-col items-center justify-center overflow-hidden rounded-md px-2 text-center text-white transition-[outline-color,filter] hover:brightness-125 ${
                              sel ? "outline outline-2 outline-offset-[-2px] outline-white" : "outline-none"
                            }`}
                            style={{ flexGrow: t.score, height: TILE_H[s], background: SHADE[g.up ? "up" : "down"][s] }}
                          >
                            <span className={`font-display font-bold leading-none ${TICKER_SIZE[s]}`}>{t.ticker}</span>
                            {s !== "Weak" && (
                              <span className="mt-1 max-w-full truncate text-[12px] text-white/80">{company(t.ticker)}</span>
                            )}
                            {s === "Strong" && (
                              <span className="mt-0.5 text-[13px] font-bold">
                                {g.up ? "↑" : "↓"} {s}, {short(g.months)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="p-4 text-muted">No stocks are linked to this ripple yet.</p>
          )}
        </div>

        <aside className="min-w-0 flex-[2] basis-[300px] rounded-2xl bg-panel p-5">
          <h3 className="font-display text-[20px] font-bold">When each effect lands</h3>
          <dl className="mt-3 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-3 text-[15px]">
            {buckets.map((b) => (
              <div key={b.label} className="contents">
                <dt className="text-muted">{b.label}</dt>
                <dd className="m-0 leading-snug">
                  {b.shown.map((d, i) => (
                    <span key={d.id}>
                      <span className={d.direction > 0 ? "text-up" : "text-down"}>{d.direction > 0 ? "↑" : "↓"}</span>{" "}
                      {L.name(d.id)}
                      {i < b.shown.length - 1 ? ", " : ""}
                    </span>
                  ))}
                  {b.more ? <span className="text-muted"> and {b.more} more</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  );
}
