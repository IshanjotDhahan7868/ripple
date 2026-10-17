# How I built an agent that reasons over a causal graph with FalkorDB

**DRAFT**

I'm Ishanjot. For the Graph Hacks hackathon I built Ripple: you give it a headline, and it traces how that headline moves through the economy on a FalkorDB graph, hop by hop, then tells you which assets are exposed and why. This is a write-up of the design decisions, what worked, and what I'd be careful about if you reuse the idea.

## The problem with asking a model about a headline

If you ask a language model "Microsoft, Google and Meta raise AI capex by $120B, what's exposed?", you get a fluent answer. You can't tell which parts come from structure and which are plausible-sounding guesses. Second-order effects are the worst case: "this raises electricity demand, which helps nuclear" sounds right whether or not anyone checked it.

I wanted the opposite: every claim has to be a path in a graph that I can print.

## Starting point

I already had a causal graph from an earlier project, Orion, written in January 2026: economic drivers (`AI_Compute_Demand`, `Data_Centers`, `Electricity_Demand`...) connected by `DRIVES` edges with a weight, a confidence and a lag in months. During the hackathon I grew it from 44 to 79 drivers (170 edges), added a polarity (+1 or -1) and a one-sentence `why` to every edge, and hung 357 assets off the drivers through 483 `EXPOSED_TO` edges. All the code is new; the data is not, and I say so in the README.

## The model never writes Cypher

The first decision was the one that shaped everything else. The model doesn't get a "run a query" tool. It gets six tools with typed parameters, and each tool runs a query I wrote by hand:

```python
SPEC = [
    {"name": "search_drivers",   ...},  # full-text search -> candidate ids
    {"name": "analyze_impact",   ...},  # propagate a shock 1-4 hops
    {"name": "recall_events",    ...},  # memory: past events on these drivers
    {"name": "explain_link",     ...},  # shortest path between two drivers
    {"name": "systemic_drivers", ...},  # PageRank + reach
    {"name": "record_alert",     ...},  # the only write
]
```

This costs some flexibility and buys three things. It can't hallucinate a schema. It can't run a destructive query. And the same catalog can be exposed over MCP with no extra work: the MCP server is generated from the same `SPEC` and `FUNCS`, so Claude Desktop calls exactly the tools my own agent does.

Validation sits in the tools. Any driver id the model passes is checked against the graph first; an unknown id raises an error the model can see, and the answer is labelled `unknown_entity`. After the model writes its brief, I scan it for tickers and driver names. If it mentions one the graph didn't return in that run, I throw the brief away and write a plain one from the tool results.

## The query that does the work

Propagation is one variable-length pattern. Strength is the product of weight and confidence along the path, lag adds up, polarity multiplies:

```cypher
MATCH p = (s:Driver)-[:DRIVES*1..4]->(t:Driver)
WHERE s.id IN $sources AND length(p) <= $depth
WITH p, t,
     reduce(x = 1.0, r IN relationships(p) | x * r.weight * r.confidence) AS strength,
     reduce(l = 0, r IN relationships(p) | l + r.lag_months) AS lag,
     reduce(sg = 1, r IN relationships(p) | sg * r.polarity) AS sign
WHERE strength >= $min_strength
RETURN t.id AS node, strength, lag, sign, [n IN nodes(p) | n.id] AS path
```

One gotcha: FalkorDB won't take a parameter in the `*1..4` bound, so the cap is a literal and the user's depth is applied in the `WHERE`. The path comes back as part of the row, which is the whole point: the UI draws what the database returned.

Because I was porting logic from Python to Cypher, I kept a copy of Orion's original propagation and wrote parity tests that compare both on 12 cases. Impact, best-path strength and lag match to floating point tolerance.

## Depth 1 versus depth 4

The demo I like best is a slider. Shock `AI_Compute_Demand` and follow it one hop: you see the obvious neighbours, and `Nuclear_Energy` isn't there. Slide to four hops and it appears:

`AI_Compute_Demand -> Data_Centers -> Electricity_Demand -> Power_Generation -> Nuclear_Energy`

This is a test in the repo, not a screenshot. It's the cleanest way to show what a graph gives you that a prompt doesn't. The depth is set by the person in the UI; I overwrite whatever depth the model asks for.

## Memory as nodes, and algorithms as tools

When the agent files an alert, it writes an `Event` node with `HIT` edges to the drivers it moved, and an `Alert` node with `FROM` to the event and `FLAGS` to the tickers. Next time, `recall_events` looks for earlier events on the same drivers. If it finds any, the answer type becomes `compounding`. Memory in the graph means the agent's history is queryable with the same tools as everything else.

PageRank and shortest path are exposed as tools too (`algo.pageRank`, `algo.SPpaths`). "Where do shocks pool?" is a graph question and gets a graph answer.

## Saying "not in the graph"

"Taylor Swift announces a new world tour" is a sample headline in the UI. The right answer is that nothing in the graph models it. The system prompt makes that an explicit, correct outcome, and the UI shows it as its own answer type. It's easy to under-build this; a model asked to be helpful will always find a stretch.

## The backtest, honestly

I froze the January graph (30 nodes, no polarity) and tested on ten real events between late January and early August 2026, with selection rules written before I looked at any returns. For each event Ripple picked five tickers and a direction, scored as direction times excess return over SPY.

- At 5 trading days: no edge. Hit rate 50.0% (random: 50.1%), mean excess -1.4%.
- At 20 trading days: hit rate 70.0% (random: 48.9%), mean excess +4.3% against -0.4% for random. Only 2.0% of 200 random seeds did as well.

I wouldn't lean on that last number. It's a percentile against a weak baseline, not a p-value. Events cluster (three on AI capex, three on oil), so the effective sample is closer to ten. A few big moves drive the mean, and one event, the Micron memory spike, lost badly. "Eight of ten events positive" is the safer summary. Not investment advice.

## What I'd flag if you build something similar

- **Summed paths exceed 1.0.** Impact adds over parallel paths, so a downstream node can outscore the shocked node. It's fine for ranking and confusing as a probability.
- **The graph is my judgment.** I wrote down the calls I'm least sure of in a review file. A hand-built graph is only as good as its author.
- **Free tiers bite.** FalkorDB Cloud's free tier doesn't persist data, so the API reseeds on startup if the graph is empty. Gemini's free tier rate-limits.
- **Test the boring parts.** The parity tests caught nothing dramatic, and that's why I trust the engine.

## Try it

The app is at https://ripple-beta-five.vercel.app. Start in "From a driver", shock `AI_Compute_Demand`, and drag the depth slider from 1 to 4.
