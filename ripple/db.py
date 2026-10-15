"""FalkorDB connection and a query tracer that records every Cypher call for the UI's agent trace."""

import os
import time
from functools import lru_cache

from falkordb import FalkorDB

from . import queries as Q

QUERY_NAMES = {v: k for k, v in vars(Q).items() if k.isupper() and isinstance(v, str)}


@lru_cache(maxsize=1)
def client() -> FalkorDB:
    return FalkorDB(
        host=os.getenv("FALKORDB_HOST", "localhost"),
        port=int(os.getenv("FALKORDB_PORT", "6380")),
        username=os.getenv("FALKORDB_USERNAME") or None,
        password=os.getenv("FALKORDB_PASSWORD") or None,
    )


def graph(name: str | None = None):
    return client().select_graph(name or os.getenv("RIPPLE_GRAPH", "ripple"))


class TracedGraph:
    """Wraps a FalkorDB graph; every query is timed and logged with its name and parameters."""

    def __init__(self, g):
        self._g = g
        self.log: list[dict] = []

    def _run(self, fn, cypher: str, params: dict | None):
        t0 = time.perf_counter()
        res = fn(cypher, params or {})
        self.log.append({
            "name": QUERY_NAMES.get(cypher, "ADHOC"),
            "cypher": " ".join(cypher.split()),
            "params": params or {},
            "rows": len(res.result_set),
            "ms": round((time.perf_counter() - t0) * 1000, 2),
        })
        return res

    def ro_query(self, cypher: str, params: dict | None = None):
        return self._run(self._g.ro_query, cypher, params)

    def query(self, cypher: str, params: dict | None = None):
        return self._run(self._g.query, cypher, params)

    def drain(self) -> list[dict]:
        out, self.log = self.log, []
        return out
