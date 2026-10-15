"""The Cypher engine must reproduce Orion's original BFS propagation exactly."""

from collections import defaultdict

import pytest
import yaml

from ripple import engine
from tests.conftest import ROOT
from tests.reference_orion_propagate import propagate_impact


class YamlGraph:
    def __init__(self, path):
        self.out = defaultdict(list)
        for e in yaml.safe_load(path.read_text())["edges"]:
            self.out[e["from"]].append({"to": e["to"], "weight": e.get("weight", 1.0),
                                        "confidence": e.get("confidence", 1.0),
                                        "lag_months": e.get("lag_months", 0)})

    def out_edges(self, node):
        return self.out[node]


REF = YamlGraph(ROOT / "seed" / "graph.yaml")
SOURCES = [["AI_Compute_Demand"], ["Defense_Spending"], ["Trade_Restrictions"],
           ["Electricity_Demand", "Industrial_Policy"]]


@pytest.mark.parametrize("sources", SOURCES, ids=lambda s: "+".join(s))
@pytest.mark.parametrize("depth", [1, 2, 4])
def test_propagation_matches_reference(g, sources, depth):
    ref_impacts, ref_best = propagate_impact(REF, sources, max_depth=depth)
    got = engine.propagate(g, sources, depth=depth)

    assert set(got) == set(ref_impacts)
    for node, impact in ref_impacts.items():
        assert got[node].impact == pytest.approx(impact, rel=1e-9), node
        assert got[node].best_strength == pytest.approx(ref_best[node]["strength"], rel=1e-9), node
        assert got[node].lag_months == ref_best[node]["lag_months"], node


def test_depth_one_is_direct_neighbours_only(g):
    got = engine.propagate(g, ["AI_Compute_Demand"], depth=1)
    assert all(ni.hops <= 1 for ni in got.values())
    assert "Nuclear_Energy" not in got


def test_depth_four_reaches_second_order_effects(g):
    got = engine.propagate(g, ["AI_Compute_Demand"], depth=4)
    nuclear = got["Nuclear_Energy"]
    assert nuclear.best_path == ["AI_Compute_Demand", "Data_Centers", "Electricity_Demand",
                                 "Power_Generation", "Nuclear_Energy"]
