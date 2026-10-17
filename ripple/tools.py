"""The fixed tool catalog. Each tool validates its inputs against the graph, runs human-written
Cypher, and returns paths straight from the query. The model never sees or writes Cypher."""

import time
import uuid

from . import engine
from . import queries as Q

MAX_SOURCES = 4


class ToolError(Exception):
    pass


def _known_drivers(g, ids: list[str]) -> list[str]:
    rows = g.ro_query(Q.RESOLVE_EXACT, {"ids": ids}).result_set
    return [r[0] for r in rows]


def _require_drivers(g, ids: list[str]) -> list[str]:
    ids = list(dict.fromkeys(ids))[:MAX_SOURCES]
    known = _known_drivers(g, ids)
    unknown = sorted(set(ids) - set(known))
    if unknown:
        raise ToolError(f"Unknown driver ids {unknown}. Use search_drivers and pick ids from its results.")
    return ids


def search_drivers(g, query: str, limit: int = 6) -> dict:
    terms = " ".join(w for w in "".join(c if c.isalnum() else " " for c in query).split() if len(w) > 2)
    if not terms:
        return {"candidates": []}
    rows = g.ro_query(Q.RESOLVE_FULLTEXT, {"q": terms.replace(" ", "|"), "limit": int(limit)}).result_set
    return {"candidates": [{"id": r[0], "name": r[1], "theme": r[2], "score": round(r[3], 3)} for r in rows]}


def analyze_impact(g, sources: list[str], direction: int, depth: int = 4) -> dict:
    sources = _require_drivers(g, sources)
    direction = 1 if int(direction) >= 0 else -1
    impacts = engine.propagate(g, sources, direction=direction, depth=depth)
    assets = engine.exposed_assets(g, impacts, limit=12)
    nodes = sorted(impacts.values(), key=lambda n: n.impact, reverse=True)[:20]
    # keep every node on a shown path so the UI can always draw the full chain
    shown = {n.node for n in nodes}
    for path in [n.best_path for n in nodes] + [a["path"] for a in assets]:
        for node in path:
            if node not in shown and node in impacts:
                shown.add(node)
                nodes.append(impacts[node])
    return {
        "sources": sources,
        "direction": direction,
        "depth": depth,
        "drivers": [{"id": n.node, "impact": round(n.impact, 3), "direction": n.direction,
                     "hops": n.hops, "lag_months": n.lag_months, "path": n.best_path}
                    for n in nodes],
        "assets": [{**a, "score": round(a["score"], 3)} for a in assets],
        "reached": len(impacts),
    }


def explain_link(g, src: str, dst: str) -> dict:
    _require_drivers(g, [src, dst])
    rows = g.ro_query(Q.EXPLAIN_LINK, {"src": src, "dst": dst}).result_set
    if not rows:
        return {"connected": False, "note": f"Nothing in the graph leads from {src} to {dst}."}
    return {"connected": True, "path": rows[0][0], "hops": len(rows[0][0]) - 1}


def systemic_drivers(g, limit: int = 8) -> dict:
    """`drivers`: where shocks pool (PageRank). `spreaders`: how many drivers each one reaches within 4 hops."""
    rows = g.ro_query(Q.SYSTEMIC_PAGERANK, {"limit": int(limit)}).result_set
    reach = g.ro_query(Q.SYSTEMIC_REACH, {"limit": int(limit)}).result_set
    return {"drivers": [{"id": r[0], "theme": r[1], "pagerank": round(r[2], 4)} for r in rows],
            "spreaders": [{"id": r[0], "theme": r[1], "reach": r[2]} for r in reach]}


def recall_events(g, driver_ids: list[str], days: int = 30) -> dict:
    driver_ids = _require_drivers(g, driver_ids)
    since = int(time.time()) - int(days) * 86400
    rows = g.ro_query(Q.RECALL_EVENTS, {"nodes": driver_ids, "since": since, "limit": 5}).result_set
    return {"events": [{"id": r[0], "headline": r[1], "at": r[2], "direction": r[3], "drivers": r[4]}
                       for r in rows]}


def record_alert(g, headline: str, sources: list[str], direction: int, summary: str,
                 tickers: list[str], answer_type: str = "answered") -> dict:
    sources = _require_drivers(g, sources)
    now = int(time.time())
    event_id = f"evt_{uuid.uuid4().hex[:10]}"
    g.query(Q.RECORD_EVENT, {"id": event_id, "headline": headline[:300], "at": now,
                             "direction": 1 if int(direction) >= 0 else -1, "url": "", "nodes": sources})
    alert_id = f"alr_{uuid.uuid4().hex[:10]}"
    g.query(Q.CREATE_ALERT, {"id": alert_id, "event_id": event_id, "text": summary[:2000], "at": now,
                             "answer_type": answer_type, "tickers": tickers[:12]})
    return {"event_id": event_id, "alert_id": alert_id}


SPEC = [
    {
        "name": "search_drivers",
        "description": "Full-text search over the causal graph's economic drivers. Call first with the "
                       "headline's key terms. Returns candidate driver ids; only these ids exist.",
        "input_schema": {"type": "object", "additionalProperties": False, "required": ["query"],
                         "properties": {"query": {"type": "string", "description": "Key terms from the headline"}}},
    },
    {
        "name": "analyze_impact",
        "description": "Propagate a shock from 1-4 driver ids through the causal graph (weighted multi-hop "
                       "traversal). direction=1 if the headline raises the driver, -1 if it lowers it. Returns "
                       "affected drivers and exposed assets, each with the exact graph path, strength, lag.",
        "input_schema": {"type": "object", "additionalProperties": False,
                         "required": ["sources", "direction", "depth"],
                         "properties": {
                             "sources": {"type": "array", "items": {"type": "string"}, "maxItems": MAX_SOURCES},
                             "direction": {"type": "integer", "enum": [1, -1]},
                             "depth": {"type": "integer", "minimum": 1, "maximum": Q.MAX_DEPTH}}},
    },
    {
        "name": "recall_events",
        "description": "Memory: past events (last N days) that hit any of these drivers. Use to detect "
                       "compounding pressure before writing the alert.",
        "input_schema": {"type": "object", "additionalProperties": False, "required": ["driver_ids", "days"],
                         "properties": {"driver_ids": {"type": "array", "items": {"type": "string"}},
                                        "days": {"type": "integer", "minimum": 1, "maximum": 365}}},
    },
    {
        "name": "explain_link",
        "description": "Shortest causal path between two driver ids, or that none exists.",
        "input_schema": {"type": "object", "additionalProperties": False, "required": ["src", "dst"],
                         "properties": {"src": {"type": "string"}, "dst": {"type": "string"}}},
    },
    {
        "name": "systemic_drivers",
        "description": "Systemic view of the graph: drivers where shocks pool (PageRank) and drivers that spread furthest (count reached within 4 hops).",
        "input_schema": {"type": "object", "additionalProperties": False, "required": ["limit"],
                         "properties": {"limit": {"type": "integer", "minimum": 3, "maximum": 15}}},
    },
    {
        "name": "record_alert",
        "description": "Act: save this headline as an Event in graph memory and file an alert flagging "
                       "tickers. Call once, last, only after analyze_impact, using tickers from its results.",
        "input_schema": {"type": "object", "additionalProperties": False,
                         "required": ["headline", "sources", "direction", "summary", "tickers"],
                         "properties": {
                             "headline": {"type": "string"},
                             "sources": {"type": "array", "items": {"type": "string"}},
                             "direction": {"type": "integer", "enum": [1, -1]},
                             "summary": {"type": "string"},
                             "tickers": {"type": "array", "items": {"type": "string"}, "maxItems": 12}}},
    },
]

FUNCS = {
    "search_drivers": search_drivers,
    "analyze_impact": analyze_impact,
    "recall_events": recall_events,
    "explain_link": explain_link,
    "systemic_drivers": systemic_drivers,
    "record_alert": record_alert,
}
