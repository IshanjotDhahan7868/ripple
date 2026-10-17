// the out-of-sample backtest (eval/backtest.py), trimmed by eval/export_casebook.py
export type CasePick = { ticker: string; direction: number; ret_20d: number; spy_20d: number; excess_20d: number; excess_5d: number };
export type CaseEvent = {
  date: string;
  headline: string;
  driver: string;
  direction: number;
  url: string | null;
  hit_rate_20d: number;
  mean_excess_20d: number;
  hit_rate_5d: number;
  mean_excess_5d: number;
  random_excess_20d: number;
  picks: CasePick[];
};
type Agg = { n_events: number; n_picks: number; ripple_pick_hit_rate: number; ripple_events_positive: number; ripple_mean_signed_excess_per_pick: number; random_hit_rate_mean: number };
export type Casebook = { graph: string; aggregate: { "5d": Agg; "20d": Agg }; events: CaseEvent[] };

export async function getCasebook(): Promise<Casebook> {
  const r = await fetch("/casebook.json");
  if (!r.ok) throw new Error(`casebook ${r.status}`);
  return r.json();
}

export const pct = (x: number, digits = 1) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
