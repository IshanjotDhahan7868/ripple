"""HTTP API. /api/analyze streams the agent's tool calls, Cypher trace and final brief as server-sent events."""

import json
import queue
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import agent, tools
from . import queries as Q
from .db import TracedGraph, graph

app = FastAPI(title="Ripple")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class AnalyzeIn(BaseModel):
    headline: str = Field(min_length=3, max_length=300)
    depth: int = Field(default=Q.MAX_DEPTH, ge=1, le=Q.MAX_DEPTH)


@app.get("/api/health")
def health():
    n = graph().ro_query("MATCH (d:Driver) RETURN count(d)").result_set[0][0]
    return {"ok": True, "drivers": n}


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


@app.post("/api/analyze")
def analyze(body: AnalyzeIn):
    q: queue.Queue = queue.Queue()

    def work():
        try:
            agent.analyze(TracedGraph(graph()), body.headline, body.depth, q.put)
        except Exception as e:  # surfaced to the UI as a stream event
            q.put({"type": "error", "message": f"{type(e).__name__}: {e}"})
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
    try:
        return {"plain": agent.plain_answer(body.headline)}
    except Exception as e:
        raise HTTPException(502, f"LLM error: {type(e).__name__}")
