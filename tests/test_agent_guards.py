"""Guards that keep the agent honest, exercised without any LLM."""

from api import agent
from api.db import TracedGraph


def make_run(g, events=None):
    out = []
    run = agent.Run(TracedGraph(g), "Hyperscalers raise AI capex", 4, out.append)
    return run, out


def test_unknown_driver_is_rejected_not_guessed(g):
    run, out = make_run(g)
    result, err = run.call("analyze_impact", {"sources": ["Made_Up_Sector"], "direction": 1, "depth": 4})
    assert err and "Unknown driver ids" in result["error"]
    assert run.answer_type("") == "unknown_entity"


def test_depth_is_set_by_the_user_not_the_model(g):
    run, _ = make_run(g)
    run.depth = 1
    result, err = run.call("analyze_impact", {"sources": ["AI_Compute_Demand"], "direction": 1, "depth": 4})
    assert not err and result["depth"] == 1
    assert all(d["hops"] <= 1 for d in result["drivers"])


def test_every_tool_result_carries_its_cypher_trace(g):
    run, out = make_run(g)
    run.call("analyze_impact", {"sources": ["AI_Compute_Demand"], "direction": 1, "depth": 4})
    trace = next(e for e in out if e["type"] == "tool_result")["queries"]
    assert {q["name"] for q in trace} >= {"RESOLVE_EXACT", "PROPAGATE", "EXPOSED_ASSETS"}
    assert all(q["ms"] >= 0 and q["cypher"] for q in trace)


def test_brief_guard_flags_tickers_and_drivers_not_returned(g):
    run, _ = make_run(g)
    run.call("analyze_impact", {"sources": ["AI_Compute_Demand"], "direction": 1, "depth": 4})
    tickers, drivers = run.allowed()
    _, _, universe = agent.catalog(g)
    good = "AI_Compute_Demand → Data_Centers → Copper lifts FCX and SCCO over ~12 months."
    assert agent.check_brief(good, tickers, drivers, universe) == []
    bad = "This also helps XOM via Oil_Supply_Shock."
    assert set(agent.check_brief(bad, tickers, drivers, universe)) >= {"Oil_Supply_Shock"}


def test_out_of_graph_headline_is_not_in_graph(g):
    run, _ = make_run(g)
    assert run.answer_type("Concert tours are not modelled.") == "not_in_graph"
