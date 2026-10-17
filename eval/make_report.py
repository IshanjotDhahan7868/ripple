import json
from pathlib import Path
D = Path(__file__).parent
r = json.loads((D / "results.json").read_text()); A = r["aggregate"]
pc = lambda x: "n/a" if x is None else f"{x*100:+.1f}%"
L = ["# Ripple out-of-sample backtest (frozen graph 2026-01-21)", "",
"Not investment advice. Hackathon-grade sanity check, not a statistical proof.", "",
"## Setup (all rules fixed before any return was computed; one run)",
"- Graph: `eval/graph_frozen_2026-01-21.yaml` (30 nodes / 46 edges; no `polarity` field in the file so every edge is +1; `confidence` present). Seeded to FalkorDB graph `ripple_frozen` via `eval/seed_frozen.py`, which reuses `seed/seed.py` unchanged.",
"- Assets: `seed/assets.yaml` filtered to drivers existing in the frozen graph (67 exposure links to later-added drivers dropped), unioned with the assets embedded in the frozen yaml itself (the loader's normal behavior). Universe: %d tickers, %d priceable." % (r["universe_total"], r["universe_priceable"]),
"- Events: 10 events in `eval/events.yaml` (source URL each; selection rule at top of that file). Dates were verified by web search; no returns were consulted when choosing. Events with ambiguous driver direction (Trump-Xi summit, NATO summit) were skipped. Several are same-driver / correlated (3 AI-capex-semis, 3 oil, 2 copper).",
"- Prediction: `propagate(source driver, direction, depth=4)` then `exposed_assets`; top-5 PRICEABLE tickers by engine score (unpriceable / direction-0 tickers skipped and back-filled), each with its predicted direction.",
"- Entry: close of the event `date` = first US session in which the news was tradable (weekend/after-close news is dated the next session, so the first-day reaction is already in the entry price: conservative for Ripple). Exit: close 5 and 20 trading days later (SPY calendar; non-US series forward-filled).",
"- Score: signed excess = dir x (r_ticker - r_SPY) (market-hedged; short side wins if the name lags SPY). Hit = signed excess > 0. Literal variant dir x r_ticker - r_SPY also in results.json. Prices: yfinance, adjusted close.",
"- Baseline: 5 random priceable tickers from the same universe, random +/-1 direction, seeds 0..199, averaged.",
"- Commodity mapping: COPPER->HG=F, BRENT->BZ=F, WTI->CL=F, NATGAS->NG=F; also SK Hynix/Samsung/EATON/FORTUM/ENEL mapped to local listings.",
"- Unpriceable (logged, excluded): " + ", ".join(r["unpriceable_tickers"]) + " (commodity names with no mapping, delisted, or yfinance has no symbol).", "",
"## Headline", "", "| Metric | 5d | 20d |", "|---|---|---|"]
def row(lbl, k, f=pc):
    L.append(f"| {lbl} | {f(A['5d'][k])} | {f(A['20d'][k])} |")
row("Ripple pick-level hit rate (n=50 picks)", "ripple_pick_hit_rate")
row("Random baseline hit rate", "random_hit_rate_mean")
row("Ripple mean signed excess", "ripple_mean_signed_excess_per_pick")
row("Random mean signed excess", "random_mean_signed_excess")
row("Random seed-to-seed SD of that mean", "random_mean_signed_excess_sd_across_seeds")
row("Events with positive mean excess (of 10)", "ripple_events_positive", lambda x: str(x))
row("Share of 200 random seeds >= Ripple", "frac_random_seeds_ge_ripple", lambda x: f"{x:.3f}")
row("Ripple literal variant (dir*r - SPY)", "ripple_literal_mean_excess_per_pick")
L += ["", "n = 10 events, 50 picks per horizon (picks within an event are highly correlated; effective n is closer to 10).", "",
"## Per event (signed excess vs SPY; picks as TICKER[dir])", "",
"| Date | Event | Driver | Dir | Top-5 | 5d mean | 20d mean | Random 20d |", "|---|---|---|---|---|---|---|---|"]
for e in r["events"]:
    tk = ", ".join(f"{p['ticker']}[{'+' if p['dir']>0 else '-'}] ({pc(p['5d']['excess'])}/{pc(p['20d']['excess'])})" for p in e["picks"])
    L.append(f"| {e['date']} | {e['headline'][:70]} | {e['driver']} | {e['dir']:+d} | {tk} | {pc(e['ripple_5d_mean_excess'])} | {pc(e['ripple_20d_mean_excess'])} | {pc(e['random_20d_mean_excess'])} |")
L += ["", "Per-pick cells are 5d/20d signed excess.", "",
"## Reading the result honestly", "",
"- 5-day: no edge. Hit rate 50%% (same as random), mean excess negative (%s vs random %s). Ripple was behind most random seeds." % (pc(A['5d']['ripple_mean_signed_excess_per_pick']), pc(A['5d']['random_mean_signed_excess'])),
"- 20-day: hit rate %s, mean excess %s vs random %s; only %s of random seeds did as well. Encouraging, but see the next point." % (pc(A['20d']['ripple_pick_hit_rate']), pc(A['20d']['ripple_mean_signed_excess_per_pick']), pc(A['20d']['random_mean_signed_excess']), f"{A['20d']['frac_random_seeds_ge_ripple']:.1%}"),
"- The 20d magnitude is dominated by a few large moves (energy majors in the two oil-escalation/ceasefire events, and semiconductor equipment TER/KLAC/LRCX after the AI-demand events, up to +45%), partly offset by one large loss: the Micron memory event (entry was the post-earnings spike close; Samsung/SK Hynix/MU/GFS/UMC all fell sharply afterwards). Mean excess is therefore outlier-sensitive; 8 of 10 events were positive, which is the more robust summary. Descriptive, not re-tuned.",
"- The random baseline is a weak comparator: it ignores that Ripple only picks assets exposed to the event driver. A fairer (not run) baseline would be 'always buy the source driver's own sector ETF'.",
"- Oil events: the three oil events used the same energy names (XOM/BP/EQT/CNQ/CVX) with signs +, -, -; the first two were clearly positive at 20d and the third (06-15 peace deal) was roughly flat, so the sign logic works there, but oil is the most obvious macro driver of the year.", "",
"## Limitations", "",
"- Tiny n: 10 events, heavily clustered (3 AI-capex/semis, 3 oil, 2 copper). Nothing here is statistically significant at a conventional standard; the seed-share figure is a descriptive percentile vs random picks, not a p-value.",
"- Events were chosen by us (rule in events.yaml), with hindsight about what was newsworthy; survivorship in which events we considered notable cannot be excluded. Driver directions were assigned by us from the news.",
"- Single graph snapshot; the graph is by one author, with no polarity data (all edges +1) so the engine cannot predict negative propagation, only magnitude; shorts arise only from the event direction being -1.",
"- Frozen graph only partially predates the assets: embedded node assets are from the 2026-01 file; assets.yaml is a later file (filtered to old drivers) so ticker choices may contain mild look-ahead.",
"- No transaction costs, slippage, borrow costs for shorts, FX, or dividends beyond adjusted close. Non-US tickers are measured in local currency against SPY.",
"- Futures proxies (HG=F, BZ=F, CL=F) are continuous front-month series with roll gaps. Several commodity and delisted names unpriceable; reduces the universe.",
"- Entry rule ignores intraday timing; the day-1 reaction is excluded for after-close/weekend news, included for intraday news (e.g. SCOTUS, copper record).",
"- Third-party sources for some events are aggregators; the DRC ban item is reported 2026-08-06 by Reuters citing an order dated June 29. Verify before quoting publicly.",
"- Not investment advice.", ""]
(D / "RESULTS.md").write_text("\n".join(L))
