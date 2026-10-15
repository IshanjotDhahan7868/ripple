"""Reference oracle: Orion propagate.py, copied verbatim for the parity test only. Not used by Ripple at runtime."""

from collections import defaultdict, deque

def propagate_impact(
    graph,
    start_nodes,
    initial_strength: float = 1.0,
    min_strength: float = 0.05,
    max_depth: int = 4,
):
    # cumulative impact per node
    impacts = defaultdict(float)
    # best path per node by strength
    # node -> {"path": [...], "strength": float, "lag_months": int}
    best_path = {}

    q = deque()
    for node in start_nodes:
        q.append((node, initial_strength, 0, [node], 0))  # (node, strength, depth, path, lag_sum)

    while q:
        node, strength, depth, path, lag_sum = q.popleft()
        if strength < min_strength or depth > max_depth:
            continue

        impacts[node] += strength

        prev = best_path.get(node)
        if (prev is None) or (strength > prev["strength"]):
            best_path[node] = {"path": path, "strength": strength, "lag_months": lag_sum}

        for edge in graph.out_edges(node):
            w = edge.get("weight", 1.0)
            c = edge.get("confidence", 1.0)  # optional; defaults to 1.0 if absent
            next_strength = strength * (w * c)
            next_lag = lag_sum + int(edge.get("lag_months", 0))
            q.append((edge["to"], next_strength, depth + 1, path + [edge["to"]], next_lag))

    return impacts, best_path
