"""HTTP API. /api/analyze streams the agent's tool calls, Cypher trace and final brief as server-sent events."""

import json
import os
import queue
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import agent, budget, tools
from . import queries as Q
from .db import TracedGraph, client, graph


@asynccontextmanager
async def lifespan(_app):
    from seed.seed import ensure_seeded

    ensure_seeded(client(), os.getenv("RIPPLE_GRAPH", "ripple"))
    yield


app = FastAPI(title="Ripple", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class AnalyzeIn(BaseModel):
    headline: str = Field(min_length=3, max_length=300)
    depth: int = Field(default=Q.MAX_DEPTH, ge=1, le=Q.MAX_DEPTH)


def _llm_error(e: Exception) -> str:
    text = str(e)
    if any(k in text for k in ("429", "RESOURCE_EXHAUSTED", "rate_limit", "overloaded")):
        return "The language model is rate limited right now. Wait a minute and try again, or trace from a driver, which needs no model."
    if any(k in text for k in ("401", "403", "API key", "api_key", "PERMISSION_DENIED")):
        return "The language model rejected the API key. Check the key in the server's environment."
    return f"The agent stopped: {type(e).__name__}. Driver mode still works."


@app.get("/api/health")
def health():
    g = graph()
    n = g.ro_query("MATCH (d:Driver) RETURN count(d)").result_set[0][0]
    return {"ok": True, "drivers": n, "llm_spent_usd": round(budget.spent(g), 3), "llm_budget_usd": budget.limit()}


@app.get("/api/graph")
def full_graph():
    g = graph()
    nodes = g.ro_query("MATCH (d:Driver) RETURN d.id, d.name, d.theme, d.type, d.description").result_set
    edges = g.ro_query("MATCH (a:Driver)-[r:DRIVES]->(b:Driver) RETURN a.id, b.id, r.weight, r.confidence, "
                       "r.lag_months, r.polarity, r.why").result_set
    return {
        "nodes": [dict(zip(("id", "name", "theme", "type", "description"), r)) for r in nodes],
        "edges": [dict(zip(("source", "target", "weight", "confidence", "lag_months", "polarity", "why"), r))
                  for r in edges],
    }


@app.get("/api/ripple")
def ripple(source: str, direction: int = 1, depth: int = Q.MAX_DEPTH):
    """Engine mode: the deterministic propagation with no LLM in the loop."""
    g = TracedGraph(graph())
    try:
        result = tools.analyze_impact(g, [source], direction, max(1, min(depth, Q.MAX_DEPTH)))
    except tools.ToolError as e:
        raise HTTPException(404, str(e))
    return {**result, "queries": g.drain()}


@app.get("/api/asset/{ticker}")
def asset(ticker: str, limit: int = 12):
    """Everything the map says moves one stock: its direct exposures, the parts of the economy upstream, and peers."""
    g = TracedGraph(graph())
    rows = g.ro_query(Q.ASSET_EXPOSURE, {"ticker": ticker}).result_set
    if not rows:
        raise HTTPException(404, f"{ticker} isn't on the map.")
    movers = {d: {"source": d, "strength": 1.0, "lag_months": 0, "sign": 1, "path": [d]} for _, d in rows}
    for src, strength, lag, sign, path in g.ro_query(Q.ASSET_UPSTREAM, {"ticker": ticker, "min_strength": 0.08}).result_set:
        if src not in movers or strength > movers[src]["strength"]:
            movers[src] = {"source": src, "strength": strength, "lag_months": lag, "sign": sign, "path": path}
    peers = g.ro_query(Q.ASSET_PEERS, {"ticker": ticker}).result_set
    return {
        "ticker": ticker,
        "type": rows[0][0],
        "exposed_to": [d for _, d in rows],
        "movers": sorted(movers.values(), key=lambda m: -m["strength"])[:max(3, min(limit, 30))],
        "peers": [dict(zip(("ticker", "type", "shared"), r)) for r in peers],
        "queries": g.drain(),
    }


@app.get("/api/systemic")
def systemic(limit: int = 10):
    return tools.systemic_drivers(graph(), max(3, min(limit, 15)))


@app.get("/api/events")
def events(limit: int = 20):
    rows = graph().ro_query(
        "MATCH (e:Event)-[:HIT]->(d:Driver) OPTIONAL MATCH (al:Alert)-[:FROM]->(e) "
        "RETURN e.id, e.headline, e.at, e.direction, collect(DISTINCT d.id), al.answer_type "
        "ORDER BY e.at DESC LIMIT $limit", {"limit": max(1, min(limit, 50))}).result_set
    return {"events": [dict(zip(("id", "headline", "at", "direction", "drivers", "answer_type"), r)) for r in rows]}


def _over_budget() -> bool:
    return os.getenv("RIPPLE_PROVIDER", "gemini") == "anthropic" and budget.spent(graph()) >= budget.limit()


BUDGET_MESSAGE = ("The demo's language-model budget is used up. Sample headlines still replay from earlier runs, "
                  "and tracing from a driver works without a model.")


@app.post("/api/analyze")
def analyze(body: AnalyzeIn):
    """Streams a live agent run. A headline seen before replays its stored run instead of calling the model again."""
    q: queue.Queue = queue.Queue()
    cached = budget.cached_run(graph(), body.headline, body.depth)

    def work():
        events: list[dict] = []

        def emit(ev):
            events.append(ev)
            q.put(ev)

        try:
            if cached is not None:
                for ev in cached:
                    q.put({**ev, "replayed": True} if ev.get("type") == "brief" else ev)
                return
            if _over_budget():
                q.put({"type": "error", "message": BUDGET_MESSAGE})
                return
            result = agent.analyze(TracedGraph(graph()), body.headline, body.depth, emit)
            if os.getenv("RIPPLE_PROVIDER", "gemini") == "anthropic":
                budget.charge(graph(), result.get("usd", 0.0))
            budget.store_run(graph(), body.headline, body.depth, events)
        except Exception as e:  # surfaced to the UI as a stream event
            q.put({"type": "error", "message": _llm_error(e)})
        finally:
            q.put(None)

    threading.Thread(target=work, daemon=True).start()

    def stream():
        while (ev := q.get()) is not None:
            yield f"data: {json.dumps(ev, default=str)}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/compare")
def compare(body: AnalyzeIn):
    if _over_budget():
        raise HTTPException(429, BUDGET_MESSAGE)
    try:
        text = agent.plain_answer(body.headline)
        if os.getenv("RIPPLE_PROVIDER", "gemini") == "anthropic":
            budget.charge(graph(), getattr(agent._plain, "usd", 0.0))
        return {"plain": text}
    except Exception as e:
        raise HTTPException(502, f"LLM error: {type(e).__name__}")
