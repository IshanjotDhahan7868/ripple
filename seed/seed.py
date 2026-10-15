"""Load the causal graph (seed/graph.yaml + seed/assets.yaml) into FalkorDB.

Graph data originates from the author's Orion project (authored Jan 2026); this loader is new.
Re-running is idempotent: the target graph is deleted and rebuilt.
"""

import os
import sys
from pathlib import Path

import yaml
from falkordb import FalkorDB

ROOT = Path(__file__).parent
ASSET_KINDS = {"equities": "equity", "etfs": "etf", "commodities": "commodity"}


def load_yaml(graph_path: Path, assets_path: Path):
    graph = yaml.safe_load(graph_path.read_text())
    assets_cfg = yaml.safe_load(assets_path.read_text()) if assets_path.exists() else {}

    drivers = []
    for n in graph["nodes"]:
        drivers.append({
            "id": n["id"],
            "name": n.get("name") or n["id"].replace("_", " "),
            "theme": n.get("theme", ""),
            "type": n.get("type", ""),
            "description": n.get("what_is_this", ""),
            "factors": "; ".join(n.get("what_affects_it") or []),
            "aliases": "; ".join(n.get("aliases") or []),
        })

    edges = [{
        "src": e["from"],
        "dst": e["to"],
        "weight": float(e.get("weight", 1.0)),
        "confidence": float(e.get("confidence", 1.0)),
        "lag_months": int(e.get("lag_months", 0)),
        "polarity": int(e.get("polarity", 1)),
        "why": e.get("why", ""),
    } for e in graph["edges"]]

    # ticker -> {type, nodes}; node-embedded lists and assets.yaml are unioned
    assets: dict[str, dict] = {}
    for n in graph["nodes"]:
        for kind, atype in ASSET_KINDS.items():
            for t in (n.get("assets") or {}).get(kind) or []:
                if atype == "commodity":  # "Copper" and "COPPER" are the same asset
                    t = t.upper().replace(" ", "_")
                a = assets.setdefault(t, {"type": atype, "nodes": set()})
                a["nodes"].add(n["id"])
    for t, meta in (assets_cfg or {}).items():
        a = assets.setdefault(t, {"type": meta.get("type", "equity"), "nodes": set()})
        a["type"] = (meta.get("type") or a["type"]).lower()
        a["nodes"].update(meta.get("nodes") or [])

    ids = {d["id"] for d in drivers}
    dangling = [(e["src"], e["dst"]) for e in edges if e["src"] not in ids or e["dst"] not in ids]
    dangling += [(t, n) for t, a in assets.items() for n in a["nodes"] if n not in ids]
    if dangling:
        sys.exit(f"dangling references: {dangling}")

    exposures = [{"ticker": t, "node": n} for t, a in assets.items() for n in sorted(a["nodes"])]
    asset_rows = [{"ticker": t, "type": a["type"]} for t, a in sorted(assets.items())]
    return drivers, edges, asset_rows, exposures


def seed(db: FalkorDB, graph_name: str, graph_path: Path, assets_path: Path):
    drivers, edges, assets, exposures = load_yaml(graph_path, assets_path)
    if graph_name in db.list_graphs():
        db.select_graph(graph_name).delete()
    g = db.select_graph(graph_name)

    g.query("UNWIND $rows AS r CREATE (:Driver {id: r.id, name: r.name, theme: r.theme, type: r.type, "
            "description: r.description, factors: r.factors, aliases: r.aliases})", {"rows": drivers})
    g.query("CREATE INDEX FOR (d:Driver) ON (d.id)")
    g.query("UNWIND $rows AS r MATCH (a:Driver {id: r.src}), (b:Driver {id: r.dst}) "
            "CREATE (a)-[:DRIVES {weight: r.weight, confidence: r.confidence, "
            "lag_months: r.lag_months, polarity: r.polarity, why: r.why}]->(b)", {"rows": edges})
    g.query("UNWIND $rows AS r CREATE (:Asset {ticker: r.ticker, type: r.type})", {"rows": assets})
    g.query("CREATE INDEX FOR (a:Asset) ON (a.ticker)")
    g.query("UNWIND $rows AS r MATCH (a:Asset {ticker: r.ticker}), (d:Driver {id: r.node}) "
            "CREATE (a)-[:EXPOSED_TO]->(d)", {"rows": exposures})
    g.query("CALL db.idx.fulltext.createNodeIndex('Driver', 'name', 'description', 'factors', 'aliases')")
    g.query("CREATE INDEX FOR (e:Event) ON (e.id)")
    return {"drivers": len(drivers), "edges": len(edges), "assets": len(assets), "exposures": len(exposures)}


def connect() -> FalkorDB:
    return FalkorDB(
        host=os.getenv("FALKORDB_HOST", "localhost"),
        port=int(os.getenv("FALKORDB_PORT", "6380")),
        username=os.getenv("FALKORDB_USERNAME") or None,
        password=os.getenv("FALKORDB_PASSWORD") or None,
    )


if __name__ == "__main__":
    name = os.getenv("RIPPLE_GRAPH", "ripple")
    print(seed(connect(), name, ROOT / "graph.yaml", ROOT / "assets.yaml"))
