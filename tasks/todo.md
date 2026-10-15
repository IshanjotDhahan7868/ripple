# Ripple — Graph Hacks 2026 (Track 01: Agents That Act on Connected Data)

Deadline: Sun Oct 18, 11:59 PM IST = **2:29 PM EDT**. Internal submit target: **Sun 12:00 EDT**. Feature freeze: **Sat 22:00 EDT**.

Rules that bind every decision:
- FalkorDB is the primary DB and load-bearing. All code new during the event; graph *data* imported from Orion (disclosed).
- Model never writes Cypher. Fixed tool catalog, human-written queries in `api/queries.py`, every parameter validated.
- Paths returned by the query, never reconstructed by the model.
- Answer types: `answered` · `from_memory` · `not_in_graph` · `unknown_entity`.

Runtime LLM: Gemini free tier during build → Claude (Haiku 4.5 / Sonnet 5.5) for final. Provider behind one switch.

## Thu (6h) — engine
- [ ] Repo, docker FalkorDB (6380 / browser 3300), venv
- [ ] `seed/seed.py`: YAML → Driver / Asset / DRIVES / EXPOSED_TO, indexes (exact + full-text)
- [ ] `api/queries.py`: named Cypher (resolve, propagate, exposed_assets, explain_link, systemic, recall, record_event, create_alert)
- [ ] Parity test: Cypher propagate == Orion `propagate.py` numbers
- [ ] Polarity on every edge + expand graph to ~80 drivers → **user review**
- [ ] Deploy hello-world: FalkorDB Cloud, Railway API, Vercel web

## Fri (9h) — agent + API + web skeleton (submittable by end of day)
- [ ] LLM provider switch (Gemini / Claude), tool-use loop
- [ ] Entity + output validators, 4 answer types
- [ ] Memory: Event nodes, compounding detection
- [ ] FastAPI SSE stream (tool_call / tool_result / brief)
- [ ] Next.js: 3-pane layout, React Flow + ELK graph, hop-by-hop highlight, Impact Brief, agent trace
- [ ] Live deploy end-to-end

## Sat (10h) — differentiation + polish
- [ ] Compare mode (plain LLM vs Ripple)
- [ ] Depth slider 1→4
- [ ] Systemic map (pageRank / betweenness)
- [ ] MCP server (same tools)
- [ ] Backtest (timebox 3h): frozen 2026-01-21 graph, ~10 post-Jan events, top-5 vs SPY 5d/20d, vs random + plain LLM
- [ ] UI polish pass: empty/error/loading, dark/light, mobile, disclaimer
- Cut order if behind: systemic map → MCP → backtest. Never cut: compare, depth, guards.

## Sun (4h) — ship
- [ ] README (pitch, GIF, architecture, schema, tools, answer types, eval, limitations, setup, data disclosure)
- [ ] Demo video 2:30
- [ ] Blog post (AirPods prize)
- [ ] Submit by 12:00 EDT

## Review
_(fill in at end)_
