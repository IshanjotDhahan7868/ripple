"""Out-of-sample backtest of Ripple's propagate()+exposed_assets() on the frozen 2026-01-21 graph.

Rules (fixed before any return was computed):
- Graph: FalkorDB graph `ripple_frozen` (run eval/seed_frozen.py first), depth 4.
- Picks: top-5 PRICEABLE tickers by engine score (back-fill past unpriceable / direction==0 tickers; skips are logged).
- Entry: close of events.yaml `date` (first tradable session; see events.yaml). Exit: close 5 / 20 trading days later
  (SPY calendar; other series reindexed to it with ffill).
- Primary score: dir * (r_ticker - r_SPY). "hit" if > 0. Literal alt: dir * r_ticker - r_SPY (also reported).
- Baseline: 5 random tickers from the same priceable universe, random +-1 direction, seeds 0..199, averaged.
"""
import json, os, random, sys, statistics as st
from pathlib import Path
import pandas as pd, yaml, yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "seed"))
os.environ.update(FALKORDB_HOST="localhost", FALKORDB_PORT="6380", FALKORDB_USERNAME="", FALKORDB_PASSWORD="")
import seed as S                                  # noqa: E402
from ripple.engine import propagate, exposed_assets  # noqa: E402

HORIZONS = (5, 20)
SEEDS = list(range(200))
TOPN = 5
SYMBOL_MAP = {"COPPER": "HG=F", "BRENT": "BZ=F", "WTI": "CL=F", "NATGAS": "NG=F", "EATON": "ETN",
              "SK Hynix": "000660.KS", "Samsung": "005930.KS", "FORTUM": "FORTUM.HE", "ENEL": "ENEL.MI"}
# Unmapped (logged, not priced): GOLD n/a here; COBALT, LITHIUM, CATHODE, SILICON, URANIUM, U3O8, OIL_AND_GAS, ELECTRICITY_FUTURES

def main():
    events = yaml.safe_load((ROOT / "eval" / "events.yaml").read_text())
    g = S.connect().select_graph("ripple_frozen")
    all_tickers = [r[0] for r in g.ro_query("MATCH (a:Asset) RETURN a.ticker").result_set]
    sym = {t: SYMBOL_MAP.get(t, t) for t in all_tickers}
    start = min(str(e["date"]) for e in events)
    px = yf.download(sorted(set(sym.values()) | {"SPY"}), start=pd.Timestamp(start) - pd.Timedelta(days=10),
                     end="2026-10-15", auto_adjust=True, progress=False)["Close"]
    spy = px["SPY"].dropna()
    px = px.reindex(spy.index).ffill()
    priceable, unpriceable = {}, []
    for t, s in sym.items():
        if s in px and px[s].notna().sum() > 100 and px[s].dropna().index[0] <= spy.index[0] + pd.Timedelta(days=15):
            priceable[t] = s
        else:
            unpriceable.append(t)
    print("unpriceable:", unpriceable)

    def window(t, edate, h):
        i = spy.index.searchsorted(pd.Timestamp(edate))
        if i + h >= len(spy):
            return None
        a, b = px[sym[t]].iloc[i], px[sym[t]].iloc[i + h]
        sa, sb = spy.iloc[i], spy.iloc[i + h]
        if pd.isna(a) or pd.isna(b):
            return None
        return float(b / a - 1), float(sb / sa - 1), str(spy.index[i].date())

    def score(t, d, edate, h):
        w = window(t, edate, h)
        if w is None:
            return None
        r, m, ed = w
        return {"ret": r, "spy": m, "excess": d * (r - m), "excess_literal": d * r - m}

    out_events, pool = [], {h: {"ripple": [], "ripple_lit": []} for h in HORIZONS}
    seed_scores = {h: [[] for _ in SEEDS] for h in HORIZONS}  # per seed, per event mean excess
    seed_hits = {h: [[] for _ in SEEDS] for h in HORIZONS}
    seed_lit = {h: [[] for _ in SEEDS] for h in HORIZONS}
    for ev in events:
        edate = str(ev["date"])
        imp = propagate(g, [ev["driver"]], ev["direction"], depth=4)
        ranked = exposed_assets(g, imp, limit=10000)
        picks, skipped = [], []
        for a in ranked:
            if len(picks) == TOPN:
                break
            if a["ticker"] not in priceable:
                skipped.append((a["ticker"], "unpriceable"))
            elif a["direction"] == 0:
                skipped.append((a["ticker"], "direction 0"))
            else:
                picks.append(a)
        rec = {"date": edate, "headline": ev["headline"], "driver": ev["driver"], "dir": ev["direction"],
               "n_exposed": len(ranked), "skipped_in_top": skipped, "picks": []}
        for a in picks:
            p = {"ticker": a["ticker"], "symbol": sym[a["ticker"]], "dir": a["direction"], "score": round(a["score"], 4)}
            for h in HORIZONS:
                s = score(a["ticker"], a["direction"], edate, h)
                p[f"{h}d"] = s
                if s:
                    pool[h]["ripple"].append(s["excess"]); pool[h]["ripple_lit"].append(s["excess_literal"])
            rec["picks"].append(p)
        for h in HORIZONS:
            ex = [p[f"{h}d"]["excess"] for p in rec["picks"] if p[f"{h}d"]]
            rec[f"ripple_{h}d_mean_excess"] = sum(ex) / len(ex) if ex else None
            rec[f"ripple_{h}d_hit_rate"] = sum(x > 0 for x in ex) / len(ex) if ex else None
        # baseline
        uni = sorted(priceable)
        for si, sd in enumerate(SEEDS):
            rng = random.Random(sd * 1000 + int(edate.replace("-", "")) % 1000)
            ch = rng.sample(uni, TOPN)
            dirs = [rng.choice([-1, 1]) for _ in ch]
            for h in HORIZONS:
                ss = [score(t, d, edate, h) for t, d in zip(ch, dirs)]
                ss = [x for x in ss if x]
                if ss:
                    seed_scores[h][si].append(sum(x["excess"] for x in ss) / len(ss))
                    seed_hits[h][si].append(sum(x["excess"] > 0 for x in ss) / len(ss))
                    seed_lit[h][si].append(sum(x["excess_literal"] for x in ss) / len(ss))
        for h in HORIZONS:
            vals = [seed_scores[h][si][-1] for si in range(len(SEEDS)) if len(seed_scores[h][si]) == len(out_events) + 1]
            rec[f"random_{h}d_mean_excess"] = sum(vals) / len(vals) if vals else None
        out_events.append(rec)

    agg = {}
    for h in HORIZONS:
        r = pool[h]["ripple"]; rl = pool[h]["ripple_lit"]
        ev_means = [e[f"ripple_{h}d_mean_excess"] for e in out_events if e[f"ripple_{h}d_mean_excess"] is not None]
        n_ev = len(ev_means)
        full = [s for s in seed_scores[h] if len(s) == n_ev]
        seed_overall = [sum(s) / len(s) for s in full]
        seed_hit_overall = [sum(x) / len(x) for x in seed_hits[h] if len(x) == n_ev]
        seed_lit_overall = [sum(x) / len(x) for x in seed_lit[h] if len(x) == n_ev]
        ripple_mean_ev = sum(ev_means) / n_ev
        agg[f"{h}d"] = {
            "n_events": n_ev, "n_picks": len(r),
            "ripple_pick_hit_rate": sum(x > 0 for x in r) / len(r),
            "ripple_mean_signed_excess_per_pick": sum(r) / len(r),
            "ripple_mean_signed_excess_event_avg": ripple_mean_ev,
            "ripple_events_positive": sum(x > 0 for x in ev_means),
            "ripple_literal_mean_excess_per_pick": sum(rl) / len(rl),
            "random_hit_rate_mean": sum(seed_hit_overall) / len(seed_hit_overall),
            "random_mean_signed_excess": sum(seed_overall) / len(seed_overall),
            "random_mean_signed_excess_sd_across_seeds": st.pstdev(seed_overall),
            "random_literal_mean_excess": sum(seed_lit_overall) / len(seed_lit_overall),
            "frac_random_seeds_ge_ripple": sum(x >= ripple_mean_ev for x in seed_overall) / len(seed_overall),
        }
    res = {"graph": "ripple_frozen (2026-01-21)", "depth": 4, "top_n": TOPN, "seeds": [SEEDS[0], SEEDS[-1]],
           "unpriceable_tickers": unpriceable, "symbol_map": SYMBOL_MAP,
           "universe_priceable": len(priceable), "universe_total": len(all_tickers),
           "events": out_events, "aggregate": agg}
    (ROOT / "eval" / "results.json").write_text(json.dumps(res, indent=1))
    print(json.dumps(agg, indent=1))

if __name__ == "__main__":
    main()
