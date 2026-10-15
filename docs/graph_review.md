# Graph v1.1 review (polarity, aliases, expansion)

File: `seed/graph.yaml` (edited in place, not committed). Original kept by git.

## Counts

| | Before (v1.0) | After (v1.1) |
|---|---|---|
| Nodes | 44 | 79 (+35) |
| Edges | 66 | 170 (+104) |
| Edges with `polarity` + `why` | 0 | 170 (all) |
| Polarity −1 edges | n/a | 38 (4 existing, 34 new) |
| Nodes with `aliases` | 0 | 79 (all, 6–10 each, no alias shared between nodes) |
| Themes | 11 | 13 (+Macro, +Agriculture) |
| Isolated nodes | 2 (Cathode_Materials, Cobalt) | 0 |
| Distinct assets after seed | — | 364 (488 exposures) |

Validation: DAG, no dangling refs, no duplicate ids/edges/aliases, polarity ∈ {1,−1}, non-empty `why`, weight 0.1–1.0, confidence 0.5–0.95, integer lag 0–36. All pass. `seed/seed.py` succeeds. `pytest tests` gives 19/19 passing (the suite has 19 tests, not 14). The best path from AI_Compute_Demand to Nuclear_Energy is unchanged, and Nuclear_Energy is still unreachable at depth 1.

## New nodes

| id | theme | type | Why it matters for headlines |
|---|---|---|---|
| Interest_Rates | Macro | policy | Fed/ECB decisions, FOMC, Powell, Treasury yields: the most common macro headline |
| Inflation | Macro | macro | CPI/PCE/PPI prints; feeds the Fed reaction function |
| USD_Strength | Macro | macro | Dollar/DXY moves; gold, copper, farm exports |
| Credit_Conditions | Macro | macro | Spreads, defaults, bank failures, private-credit stress (**high = loose**) |
| Labor_Market | Macro | macro | Payrolls, claims, layoffs, "recession" |
| Consumer_Spending | Consumer | macro | Retail sales, consumer confidence, holiday sales |
| China_Economy | Macro | macro | China stimulus/PMI/property; demand for copper, oil, steel |
| Fiscal_Policy | Macro | policy | Shutdowns, debt ceiling, spending bills, tax cuts |
| Oil_Supply | Energy | driver | OPEC+ quotas, shale output, outages (supply shocks) |
| Oil_Price | Commodities | commodity | Brent/WTI moves; airlines, CPI, producers |
| Natural_Gas_Price | Commodities | commodity | Henry Hub/TTF; fertilizer, LNG, power economics |
| Refining | Energy | sub-industry | Refinery outages, diesel/gasoline/jet cracks |
| Airlines | Industrials | industry | Fuel-cost and travel-demand headlines |
| Tourism_and_Travel | Consumer | industry | Bookings, hotels, cruise demand |
| Shipping_Rates | Industrials | commodity | Container/tanker/dry-bulk rates (also covers "container shipping") |
| Maritime_Chokepoint_Disruption | Geopolitics | geopolitical | Red Sea/Houthi, Suez, Hormuz, Panama Canal |
| Middle_East_Conflict | Geopolitics | geopolitical | Israel/Iran/Gaza escalation |
| Taiwan_Strait_Risk | Geopolitics | geopolitical | PLA drills, blockade, cross-strait tension |
| Russia_Ukraine_War | Geopolitics | geopolitical | Escalation (+) / ceasefire (−) |
| Sanctions | Geopolitics | policy | Russia/Iran/Venezuela oil sanctions, price cap, shadow fleet |
| Gold | Commodities | commodity | Safe-haven, record-high gold headlines |
| Wheat_and_Grains | Agriculture | commodity | Black Sea grain, harvests, soybean trade war |
| Fertilizer | Agriculture | commodity | Potash/urea/ammonia; gas and Russia linked |
| Farm_Economy | Agriculture | industry | Farm income, tractor sales, farm bailouts |
| Steel_and_Aluminum | Commodities | commodity | Section 232 metal tariffs, smelters, China steel |
| Housing_and_Homebuilders | Consumer | industry | Mortgage rates, housing starts, home sales |
| Commercial_Real_Estate | Financials | industry | Office vacancies, CRE loan stress, regional banks |
| Autos_and_Auto_Parts | Consumer | industry | Auto tariffs, car sales, UAW (ICE/hybrid makers) |
| Insurance_and_Reinsurance | Financials | industry | Catastrophe losses, premiums |
| Natural_Disasters | Macro | driver | Hurricanes, wildfires, drought, heatwaves |
| Pharma_and_Biotech | Consumer | industry | GLP-1, drug pricing, pharma tariffs, FDA |
| Crypto_Assets | Financials | commodity | Bitcoin price/ETF flows, crypto regulation |
| Consumer_Electronics | Consumer | industry | iPhone/PC shipments; tariff and Taiwan exposure |
| Cyber_Threats | Software | driver | Ransomware, breaches, cyberattacks |
| Tech_Antitrust_and_Regulation | Software | policy | DOJ/FTC cases, EU DMA fines, breakups |

What was deliberately **not** added:
- **Tariffs.** Folded into `Trade_Restrictions`, which already covered tariffs. It gets tariff aliases and 8 new out-edges.
- **Container_Shipping.** Folded into `Shipping_Rates`, which carries the carrier stocks.
- **A generic GDP/Economic_Growth node.** It would create cycles (see below).
- **Power_Prices.** Its natural edges would create a stronger AI → Nuclear path and break the documented depth-4 test.

## Changes to existing content

- **Weight:** `Aerospace_and_Defense_Manufacturing → Advanced_Logic_Chips` lowered from 0.60 to 0.30. Defense is a small share of leading-edge logic demand. No other existing weight, lag or confidence changed.
- **Descriptions:**
  - `Trade_Restrictions`: "sanctions" moved out to the new `Sanctions` node.
  - `Oil_and_Gas`: clarified as producers, since it now sits downstream of `Oil_Price`.
- **Fields added:** `what_affects_it` added to Lithium, Cathode_Materials and Cobalt, which had none.
- **Header:** version bumped to 1.1 with a v1.1 header comment. New themes Macro and Agriculture.
- **New edges touching previously isolated nodes:** Energy_Storage → Lithium, Energy_Storage → Cathode_Materials, Cathode_Materials → Cobalt.

## Every polarity −1 edge

| from | to | weight | status | why |
|---|---|---|---|---|
| Trade_Restrictions | Semiconductor_Equipment | 0.70 | existing | Export controls block tool sales to Chinese fabs, a major customer for equipment makers. |
| Trade_Restrictions | Defense_Electronics | 0.50 | existing | Export controls and Chinese counter-controls on gallium, germanium and rare earths constrain defense electronics supply. |
| Lithium | EVs_and_Autonomy | 0.50 | existing | Higher lithium prices raise battery costs and squeeze EV margins. |
| Copper | EVs_and_Autonomy | 0.40 | existing | Higher copper prices raise EV motor and wiring costs. |
| Inflation | Consumer_Spending | 0.40 | new | Rising prices erode real incomes and squeeze discretionary spending. |
| Interest_Rates | Housing_and_Homebuilders | 0.85 | new | Higher rates raise mortgage costs, cutting home sales and builder orders. |
| Interest_Rates | Commercial_Real_Estate | 0.70 | new | Higher rates lift cap rates and refinancing costs, lowering property values. |
| Interest_Rates | Credit_Conditions | 0.60 | new | Higher policy rates tighten lending standards and widen credit spreads. |
| Interest_Rates | Gold | 0.45 | new | Higher real yields raise the opportunity cost of holding non-yielding gold. |
| Interest_Rates | Crypto_Assets | 0.45 | new | Tighter liquidity and higher yields reduce appetite for speculative assets like bitcoin. |
| Interest_Rates | Capital_Markets | 0.50 | new | Higher rates depress asset prices and the financing of IPOs and M&A. |
| Interest_Rates | Consumer_Spending | 0.35 | new | Higher borrowing costs on cards and loans dampen consumer spending. |
| Interest_Rates | Autos_and_Auto_Parts | 0.35 | new | Higher auto-loan rates reduce vehicle affordability and sales. |
| Interest_Rates | Data_Centers | 0.30 | new | Higher financing costs raise the hurdle rate for debt-funded data center builds. |
| Interest_Rates | Energy_Storage | 0.35 | new | Storage and solar projects are capital-intensive, so higher rates hurt project economics. |
| USD_Strength | Gold | 0.50 | new | A stronger dollar makes dollar-priced gold more expensive for foreign buyers. |
| USD_Strength | Copper | 0.30 | new | A stronger dollar raises the local-currency cost of copper and damps demand. |
| USD_Strength | Farm_Economy | 0.30 | new | A stronger dollar makes US crop exports less competitive, hurting farm income. |
| Oil_Supply | Oil_Price | 0.90 | new | More barrels on the market push crude prices down; supply cuts push them up. |
| Oil_Price | Airlines | 0.70 | new | Jet fuel is airlines' second-largest cost, so higher crude squeezes margins. |
| Oil_Price | Consumer_Spending | 0.35 | new | Higher pump prices divert household budgets away from discretionary spending. |
| Refining | Airlines | 0.30 | new | Wider jet fuel cracks raise airline fuel costs beyond the move in crude. |
| Middle_East_Conflict | Oil_Supply | 0.60 | new | Attacks on Gulf producers, pipelines or tankers can remove barrels from the market. |
| Sanctions | Oil_Supply | 0.50 | new | Sanctions on Russian, Iranian or Venezuelan crude reduce exportable barrels. |
| Taiwan_Strait_Risk | Semiconductor_Manufacturing | 0.80 | new | Taiwan hosts most leading-edge foundry capacity, so a blockade or conflict halts chip output. |
| Taiwan_Strait_Risk | Advanced_Logic_Chips | 0.70 | new | Nvidia, AMD and Apple chips are fabbed in Taiwan, so disruption cuts their supply. |
| Taiwan_Strait_Risk | Consumer_Electronics | 0.60 | new | Phone and PC supply chains depend on Taiwanese chips and assembly. |
| Trade_Restrictions | China_Economy | 0.45 | new | US tariffs and export controls weigh on Chinese exports and growth. |
| Trade_Restrictions | Autos_and_Auto_Parts | 0.40 | new | Auto tariffs raise the cost of imported vehicles and parts, hurting automaker margins. |
| Trade_Restrictions | Consumer_Electronics | 0.40 | new | Tariffs on phones, PCs and components raise device prices and cut margins. |
| Trade_Restrictions | Wheat_and_Grains | 0.35 | new | Retaliatory tariffs from China cut US soybean and grain exports, depressing prices. |
| Trade_Restrictions | Pharma_and_Biotech | 0.25 | new | Pharmaceutical tariffs raise costs for drugmakers with overseas manufacturing. |
| Steel_and_Aluminum | Autos_and_Auto_Parts | 0.35 | new | Higher steel and aluminum prices raise automakers' input costs. |
| Fertilizer | Farm_Economy | 0.35 | new | Higher fertilizer costs squeeze farm margins. |
| Natural_Disasters | Insurance_and_Reinsurance | 0.70 | new | Catastrophes trigger insured losses that hit insurer and reinsurer earnings. |
| Natural_Disasters | Oil_Supply | 0.25 | new | Gulf of Mexico hurricanes shut in offshore oil production. |
| Tech_Antitrust_and_Regulation | Digital_Advertising | 0.45 | new | Antitrust remedies against search and social platforms threaten ad business models. |
| Tech_Antitrust_and_Regulation | E_Commerce_and_Marketplaces | 0.25 | new | Marketplace antitrust cases can restrict fees, self-preferencing and bundling. |

## Judgment calls to double-check

1. **104 new edges, not ~70.** Thirty-five new nodes need both in- and out-links to be useful. About 2.9 links per new node is still sparse, and every new edge clears weight 0.20 or more. If you want ~70, the weakest candidates to cut are:
   - Refining → Inflation
   - Credit_Conditions → Data_Centers
   - Oil_Price → EVs_and_Autonomy
   - Tech_Antitrust_and_Regulation → E_Commerce_and_Marketplaces
   - Trade_Restrictions → Pharma_and_Biotech
2. **The DAG forces one-way macro causality.** The chain runs Oil/Labor/Fiscal/Trade → Inflation → Interest_Rates → {housing, credit, USD, gold, crypto, consumer…}. As a result:
   - Rates do **not** feed back into inflation or jobs.
   - The dollar does **not** feed oil or grains. Either would close a cycle through Inflation → Rates → USD.
   - There is no generic GDP node for the same reason. "Recession" headlines resolve to `Labor_Market` (−1) via alias.
3. **Some node directions are not "more is good", so the agent must pick the sign:**
   - `Credit_Conditions`: high means loose credit, so "credit stress" or "bank failure" is direction −1.
   - `Russia_Ukraine_War`: a ceasefire is −1.
   - `Tech_Antitrust_and_Regulation`: tougher enforcement is +1.
   - The `what_is_this` text states each of these.
4. **Nine new driver nodes have no direct assets:** Inflation, Oil_Supply, Maritime_Chokepoint_Disruption, Middle_East_Conflict, Taiwan_Strait_Risk, Russia_Ukraine_War, Sanctions, Cyber_Threats and Tech_Antitrust_and_Regulation. In addition, USD_Strength has only the UUP ETF, and Labor_Market and Natural_Disasters have no ETF.
   - **Reason:** `exposed_assets` gives every asset on a node that node's direction. There is no per-asset polarity. Any ticker placed on, say, Oil_Supply or Taiwan_Strait_Risk would be shown moving *with* the shock, which is wrong for nearly every candidate (SLB on Oil_Supply would show "down" on an OPEC cut).
   - This matches the existing convention for driver nodes (AI_Compute_Demand, Defense_Spending, Trade_Restrictions all have empty assets). Exposures come one hop downstream.
5. **Existing −1 reinterpretations:**
   - `Lithium/Copper → EVs_and_Autonomy` is read as input cost (−1). The original edge direction suggests "dependency". If you meant demand pull, the edge should be reversed (EVs → Lithium) instead.
   - `Trade_Restrictions → Defense_Electronics` is −1 (supply constraints).
6. **Ambiguous outcomes the graph now produces (defensible, but worth knowing):**
   - **Fed cut makes banks net up.** The NIM squeeze (−) is outweighed by credit, CRE and capital-markets relief. In that case the displayed `path` is the direct `Interest_Rates > Retail_Banking` edge, which points *down*, while `direction` is up. The engine reports the strongest single path but the net-summed direction. Consider showing the strongest path *with the winning sign* in the UI.
   - **Hot CPI makes gold net down (−0.58).** The rates and USD paths beat the inflation-hedge edge. This matches the typical same-day reaction but not the long-run hedge story.
7. **Natural_Gas_Price mixes Henry Hub and TTF.** `NG → LNG_and_Gas_Export (+)` holds for global prices; a Henry Hub-only spike actually narrows the US LNG export spread.
8. **`Interest_Rates` carries SCHW, IBKR, TBT and TBF** (assets that rise with rates), so a Fed cut shows them **down** at the top of the list. This is correct but may surprise a demo audience.
9. **`Natural_Disasters` carries GNRC, HD and LOW** (rebuild/backup-power trade).
10. **Pharma is themed `Consumer`** because only Macro and Agriculture were allowed as new themes. A `Healthcare` theme would be cleaner.
11. **Barrick is left out of Gold** because its ticker changed (GOLD → B, 2025) and I couldn't confirm which one to use. `Oil_and_Gas` still lists WTI/Brent/NatGas, which now also sit on `Oil_Price`/`Natural_Gas_Price`. Shared tickers get their scores divided across nodes (score/exposure_count).

## Existing issues noticed, not changed (outside scope)

- **Dead or wrong tickers on original nodes:**
  - Delisted or acquired: QTS, CONE, INFN (Nokia 2025), CCMP (Entegris 2022).
  - Renamed or wrong symbol: SQ (now XYZ), EATON (ticker is ETN).
  - Not tickers: "SK Hynix", "Samsung".
  - Missing exchange suffix: FORTUM, ENEL.
  - Probably wrong company: BGC (a brokerage, not grid). GE's grid business is GEV.
- **Duplicate commodity assets:** `Copper` (graph.yaml) vs `COPPER` (assets.yaml), and `Silicon` vs `SILICON`, seed as separate assets.
- Lithium, Cathode_Materials and Cobalt have no equities (ALB and SQM would be obvious for Lithium).
- **Scoring artifacts (engine, not graph):**
  - Many parallel paths push a node's `impact` above 1.0. Under Taiwan, Semiconductor_Equipment scores 1.94, more than the shocked node itself.
  - Multi-node tickers are divided by exposure_count. NVDA is on 4 nodes, so it barely ranks under the Taiwan shock even though it is directly hit.

## Sanity propagations (depth 4, min strength 0.05, live FalkorDB)

### 1. OPEC+ supply cut: `Oil_Supply`, direction −1 (27 nodes reached)
Nodes: Oil_Price +, Oil_and_Gas +, Airlines −, Inflation +, Consumer_Spending −, LNG +, Interest_Rates +, Housing −, Gold +, Shipping_Rates − (fewer barrels to ship). All sensible.

| ticker | type | dir | score | best path |
|---|---|---|---|---|
| APA | equity | up | 0.81 | Oil_Supply > Oil_Price |
| OXY | equity | up | 0.81 | Oil_Supply > Oil_Price |
| COP | equity | up | 0.81 | Oil_Supply > Oil_Price |
| DVN | equity | up | 0.81 | Oil_Supply > Oil_Price |
| FANG | equity | up | 0.81 | Oil_Supply > Oil_Price |
| EOG | equity | up | 0.81 | Oil_Supply > Oil_Price |
| Brent | commodity | up | 0.64 | Oil_Supply > Oil_Price |
| WTI | commodity | up | 0.64 | Oil_Supply > Oil_Price |

Next in the list: XOM/BP/CVX up, then DAL/UAL/AAL/LUV down.

### 2. Fed rate cut: `Interest_Rates`, direction −1 (35 nodes reached)
Nodes: Housing +, Credit_Conditions +, CRE +, USD −, Gold +, Capital_Markets +, Autos +, Alt managers +, Crypto +, Retail_Banking + (see judgment call 6).

| ticker | type | dir | score | best path |
|---|---|---|---|---|
| IBKR | equity | down | 1.00 | Interest_Rates |
| TOL | equity | up | 1.00 | Interest_Rates > Housing_and_Homebuilders |
| NVR | equity | up | 1.00 | Interest_Rates > Housing_and_Homebuilders |
| LEN | equity | up | 1.00 | Interest_Rates > Housing_and_Homebuilders |
| DHI | equity | up | 1.00 | Interest_Rates > Housing_and_Homebuilders |
| PHM | equity | up | 1.00 | Interest_Rates > Housing_and_Homebuilders |
| WFC | equity | up | 0.69 | Interest_Rates > Retail_Banking |
| TD | equity | up | 0.69 | Interest_Rates > Retail_Banking |

### 3. Taiwan blockade risk: `Taiwan_Strait_Risk`, direction +1 (27 nodes reached)
Nodes: Semiconductor_Manufacturing −, Semiconductor_Materials −, Advanced_Logic_Chips −, Consumer_Electronics −, Supply_Chain_Resilience +, Industrial_Construction + (reshoring beats lost fab construction), Defense_Spending +, Rare_Earths +, Aerospace and Defense +, Gold +.

| ticker | type | dir | score | best path |
|---|---|---|---|---|
| TER | equity | down | 1.94 | Taiwan_Strait_Risk > Semiconductor_Manufacturing > Semiconductor_Equipment |
| KLAC | equity | down | 1.94 | Taiwan_Strait_Risk > Semiconductor_Manufacturing > Semiconductor_Equipment |
| LRCX | equity | down | 1.94 | Taiwan_Strait_Risk > Semiconductor_Manufacturing > Semiconductor_Equipment |
| ASML | equity | down | 1.86 | Taiwan_Strait_Risk > Semiconductor_Manufacturing |
| GFS | equity | down | 1.79 | Taiwan_Strait_Risk > Semiconductor_Manufacturing |
| UMC | equity | down | 1.79 | Taiwan_Strait_Risk > Semiconductor_Manufacturing |
| AMAT | equity | down | 1.49 | Taiwan_Strait_Risk > Semiconductor_Manufacturing > Semiconductor_Equipment |
| TSM | equity | down | 1.29 | Taiwan_Strait_Risk > Semiconductor_Manufacturing |

Additional spot checks, all directionally sensible:

| Shock | Result |
|---|---|
| Middle East escalation | Oil up, airlines down, shippers up, gold and defense up |
| Russia–Ukraine ceasefire | Fertilizer, defense, grains and gas down; oil supply up |
| Tariffs | MP and steel up; semi equipment and autos down |
| Weak jobs | Retailers and payments down; homebuilders up |
| Hurricane | Insurers down; GNRC, HD, LOW and refiners up |
| China stimulus | China ADRs, copper and steel up |
| Red Sea disruption | ZIM, FRO and BDRY up; oil up |
| Credit stress | Lenders, HY bonds, alt managers and homebuilders down |
