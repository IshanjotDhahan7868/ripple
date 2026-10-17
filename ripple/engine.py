"""Deterministic graph engine: propagation and asset exposure. No LLM involved."""

from dataclasses import dataclass, field

from . import queries as Q

TYPE_WEIGHTS = {"equity": 1.0, "etf": 0.6, "commodity": 0.9}


@dataclass
class NodeImpact:
    node: str
    impact: float = 0.0          # sum of path strengths (magnitude)
    net: float = 0.0             # sum of signed path strengths
    best_path: list[str] = field(default_factory=list)
    best_strength: float = 0.0
    lag_months: int = 0
    hops: int = 0

    @property
    def direction(self) -> int:
        return (self.net > 0) - (self.net < 0)


def propagate(g, sources: list[str], direction: int = 1, depth: int = Q.MAX_DEPTH,
              min_strength: float = 0.05) -> dict[str, NodeImpact]:
    depth = max(1, min(int(depth), Q.MAX_DEPTH))
    out: dict[str, NodeImpact] = {}
    for s in sources:
        out[s] = NodeImpact(s, 1.0, float(direction), [s], 1.0, 0, 0)

    rows = g.ro_query(Q.PROPAGATE, {"sources": sources, "depth": depth,
                                    "min_strength": min_strength}).result_set
    for node, strength, lag, sign, path in rows:
        ni = out.setdefault(node, NodeImpact(node))
        ni.impact += strength
        ni.net += strength * sign * direction
        if strength > ni.best_strength:
            ni.best_strength, ni.best_path, ni.lag_months, ni.hops = strength, path, lag, len(path) - 1
    return out


def exposed_assets(g, impacts: dict[str, NodeImpact], limit: int = 15, per_side: int = 6) -> list[dict]:
    rows = g.ro_query(Q.EXPOSED_ASSETS, {"nodes": list(impacts)}).result_set
    scored = []
    for ticker, atype, hit, exposure_count in rows:
        net = sum(impacts[n].net for n in hit)
        mag = sum(impacts[n].impact for n in hit)
        tw = TYPE_WEIGHTS.get(atype, 1.0)
        best = max((impacts[n] for n in hit), key=lambda ni: ni.best_strength)
        scored.append({
            "ticker": ticker,
            "type": atype,
            "score": mag / max(1, exposure_count) * tw,
            "direction": (net > 0) - (net < 0),
            "via": hit,
            "path": best.best_path,
            "lag_months": best.lag_months,
            "hops": best.hops,
        })
    scored.sort(key=lambda a: a["score"], reverse=True)
    # one strong side shouldn't hide the other: top up each side to a few names
    keep = scored[:limit]
    for up in (True, False):
        side = [a for a in scored if (a["direction"] > 0) == up]
        have = sum((a["direction"] > 0) == up for a in keep)
        keep += [a for a in side if a not in keep][:max(0, per_side - have)]
    return sorted(keep, key=lambda a: a["score"], reverse=True)
