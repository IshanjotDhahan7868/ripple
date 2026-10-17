# Ripple out-of-sample backtest (frozen graph 2026-01-21)

Not investment advice. Hackathon-grade sanity check, not a statistical proof.

## Setup (all rules fixed before any return was computed; one run)
- Graph: `eval/graph_frozen_2026-01-21.yaml` (30 nodes / 46 edges; no `polarity` field in the file so every edge is +1; `confidence` present). Seeded to FalkorDB graph `ripple_frozen` via `eval/seed_frozen.py`, which reuses `seed/seed.py` unchanged.
- Assets: `seed/assets.yaml` filtered to drivers existing in the frozen graph (67 exposure links to later-added drivers dropped), unioned with the assets embedded in the frozen yaml itself (the loader's normal behavior). Universe: 134 tickers, 116 priceable.
- Events: 10 events in `eval/events.yaml` (source URL each; selection rule at top of that file). Dates were verified by web search; no returns were consulted when choosing. Events with ambiguous driver direction (Trump-Xi summit, NATO summit) were skipped. Several are same-driver / correlated (3 AI-capex-semis, 3 oil, 2 copper).
- Prediction: `propagate(source driver, direction, depth=4)` then `exposed_assets`; top-5 PRICEABLE tickers by engine score (unpriceable / direction-0 tickers skipped and back-filled), each with its predicted direction.
- Entry: close of the event `date` = first US session in which the news was tradable (weekend/after-close news is dated the next session, so the first-day reaction is already in the entry price: conservative for Ripple). Exit: close 5 and 20 trading days later (SPY calendar; non-US series forward-filled).
- Score: signed excess = dir x (r_ticker - r_SPY) (market-hedged; short side wins if the name lags SPY). Hit = signed excess > 0. Literal variant dir x r_ticker - r_SPY also in results.json. Prices: yfinance, adjusted close.
- Baseline: 5 random priceable tickers from the same universe, random +/-1 direction, seeds 0..199, averaged.
- Commodity mapping: COPPER->HG=F, BRENT->BZ=F, WTI->CL=F, NATGAS->NG=F; also SK Hynix/Samsung/EATON/FORTUM/ENEL mapped to local listings.
- Unpriceable (logged, excluded): ABB, BLD, CATHODE, CCMP, COBALT, CONE, ELECTRICITY_FUTURES, IGN, INFN, KAP.L, LITHIUM, OIL_AND_GAS, QTS, SCHN.PA, SILICON, U3O8, URANIUM, VPN (commodity names with no mapping, delisted, or yfinance has no symbol).

## Headline

| Metric | 5d | 20d |
|---|---|---|
| Ripple pick-level hit rate (n=50 picks) | +50.0% | +70.0% |
| Random baseline hit rate | +50.1% | +48.9% |
| Ripple mean signed excess | -1.4% | +4.3% |
| Random mean signed excess | -0.1% | -0.4% |
| Random seed-to-seed SD of that mean | +1.0% | +2.3% |
| Events with positive mean excess (of 10) | 6 | 8 |
| Share of 200 random seeds >= Ripple | 0.915 | 0.020 |
| Ripple literal variant (dir*r - SPY) | -1.5% | +3.7% |

n = 10 events, 50 picks per horizon (picks within an event are highly correlated; effective n is closer to 10).

## Per event (signed excess vs SPY; picks as TICKER[dir])

| Date | Event | Driver | Dir | Top-5 | 5d mean | 20d mean | Random 20d |
|---|---|---|---|---|---|---|---|
| 2026-01-29 | Copper hits all-time high on LME (three-month ~$14,527/t intraday), bi | Copper | +1 | GLEN.L[+] (-4.1%/+6.3%), FCX[+] (-6.7%/+5.7%), SCCO[+] (-6.5%/+7.5%), COPPER[+] (-3.7%/-1.6%), COPX[+] (-11.3%/+2.7%) | -6.5% | +4.1% | +0.6% |
| 2026-02-20 | US Supreme Court rules 6-3 that IEEPA does not authorize tariffs | Trade_Restrictions | -1 | TER[-] (+1.0%/+4.8%), KLAC[-] (-2.4%/-5.8%), LRCX[-] (+4.0%/+1.0%), LHX[-] (-2.9%/-5.1%), AMAT[-] (+0.3%/-0.8%) | +0.0% | -1.2% | +0.0% |
| 2026-03-02 | US and Israel launch strikes on Iran (Sat 2026-02-28); first trading s | Oil_and_Gas | +1 | XOM[+] (-1.3%/+18.9%), BP[+] (+4.2%/+27.6%), EQT[+] (+2.1%/+12.2%), CNQ[+] (+5.4%/+20.0%), CVX[+] (+1.1%/+18.8%) | +2.3% | +19.5% | -0.8% |
| 2026-04-08 | Trump announces two-week US-Iran ceasefire conditional on reopening St | Oil_and_Gas | -1 | XOM[-] (+8.2%/+13.4%), BP[-] (+3.0%/+11.3%), EQT[-] (+9.2%/+13.0%), CNQ[-] (+5.0%/+10.3%), CVX[-] (+7.7%/+12.6%) | +6.6% | +12.1% | -1.0% |
| 2026-04-30 | Alphabet, Microsoft, Meta report Q1 after close 04-29 and raise 2026 A | AI_Compute_Demand | +1 | TER[+] (+1.3%/+3.8%), KLAC[+] (-1.1%/+4.7%), LRCX[+] (+9.3%/+18.1%), GLEN.L[+] (-2.4%/-5.3%), FCX[+] (+3.1%/+8.5%) | +2.1% | +6.0% | -0.8% |
| 2026-05-21 | Nvidia Q1 FY27 results (after close 05-20) - record $75.2B data center | AI_Compute_Demand | +1 | TER[+] (+4.1%/+28.8%), KLAC[+] (+2.5%/+45.6%), LRCX[+] (+3.4%/+35.1%), GLEN.L[+] (-2.9%/-3.1%), FCX[+] (+3.6%/+10.6%) | +2.1% | +23.4% | +0.2% |
| 2026-06-15 | US-Iran initial deal to end war and reopen Strait of Hormuz announced  | Oil_and_Gas | -1 | XOM[-] (-1.7%/-2.3%), BP[-] (+2.9%/+0.9%), EQT[-] (-4.4%/+3.2%), CNQ[-] (+3.2%/+2.1%), CVX[-] (-0.1%/-0.4%) | -0.0% | +0.7% | -0.2% |
| 2026-06-24 | White House sends $87.6B Iran-war supplemental to Congress incl. $67.1 | Defense_Spending | +1 | NOC[+] (+1.7%/+5.4%), GD[+] (+3.7%/+10.7%), BA[+] (-2.5%/-5.7%), RTX[+] (+1.9%/+12.3%), LMT[+] (+4.4%/+15.0%) | +1.8% | +7.5% | -0.7% |
| 2026-06-25 | Micron reports after close 06-24, revenue +346% y/y on AI-driven memor | Memory_Chips | +1 | Samsung[+] (-21.6%/-31.0%), SK Hynix[+] (-26.5%/-40.3%), MU[+] (-21.0%/-24.7%), GFS[+] (-20.3%/-38.5%), UMC[+] (-12.9%/-29.1%) | -20.5% | -32.7% | -0.8% |
| 2026-08-06 | DR Congo bans exports of copper and cobalt concentrates (order dated 0 | Copper | +1 | GLEN.L[+] (-2.1%/+6.4%), FCX[+] (-3.2%/+5.8%), SCCO[+] (-2.3%/+4.6%), COPPER[+] (-2.6%/-2.2%), COPX[+] (-1.9%/+5.4%) | -2.4% | +4.0% | -0.3% |

Per-pick cells are 5d/20d signed excess.

## Reading the result honestly

- 5-day: no edge. Hit rate 50% (same as random), mean excess negative (-1.4% vs random -0.1%). Ripple was behind most random seeds.
- 20-day: hit rate +70.0%, mean excess +4.3% vs random -0.4%; only 2.0% of random seeds did as well. Encouraging, but see the next point.
- The 20d magnitude is dominated by a few large moves (energy majors in the two oil-escalation/ceasefire events, and semiconductor equipment TER/KLAC/LRCX after the AI-demand events, up to +45%), partly offset by one large loss: the Micron memory event (entry was the post-earnings spike close; Samsung/SK Hynix/MU/GFS/UMC all fell sharply afterwards). Mean excess is therefore outlier-sensitive; 8 of 10 events were positive, which is the more robust summary. Descriptive, not re-tuned.
- The random baseline is a weak comparator: it ignores that Ripple only picks assets exposed to the event driver. A fairer (not run) baseline would be 'always buy the source driver's own sector ETF'.
- Oil events: the three oil events used the same energy names (XOM/BP/EQT/CNQ/CVX) with signs +, -, -; the first two were clearly positive at 20d and the third (06-15 peace deal) was roughly flat, so the sign logic works there, but oil is the most obvious macro driver of the year.

## Limitations

- Tiny n: 10 events, heavily clustered (3 AI-capex/semis, 3 oil, 2 copper). Nothing here is statistically significant at a conventional standard; the seed-share figure is a descriptive percentile vs random picks, not a p-value.
- Events were chosen by us (rule in events.yaml), with hindsight about what was newsworthy; survivorship in which events we considered notable cannot be excluded. Driver directions were assigned by us from the news.
- Single graph snapshot; the graph is by one author, with no polarity data (all edges +1) so the engine cannot predict negative propagation, only magnitude; shorts arise only from the event direction being -1.
- Frozen graph only partially predates the assets: embedded node assets are from the 2026-01 file; assets.yaml is a later file (filtered to old drivers) so ticker choices may contain mild look-ahead.
- No transaction costs, slippage, borrow costs for shorts, FX, or dividends beyond adjusted close. Non-US tickers are measured in local currency against SPY.
- Futures proxies (HG=F, BZ=F, CL=F) are continuous front-month series with roll gaps. Several commodity and delisted names unpriceable; reduces the universe.
- Entry rule ignores intraday timing; the day-1 reaction is excluded for after-close/weekend news, included for intraday news (e.g. SCOTUS, copper record).
- Third-party sources for some events are aggregators; the DRC ban item is reported 2026-08-06 by Reuters citing an order dated June 29. Verify before quoting publicly.
- Not investment advice.
