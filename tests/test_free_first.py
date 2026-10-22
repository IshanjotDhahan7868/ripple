"""Free-first /api/analyze: the deterministic rulebook reads typed headlines before the
model is called, and the engine brief can only name what the graph actually returned.
Matcher expectations mirror tests/test_live.py."""

from ripple.app import _engine_brief, _get_matcher

M = _get_matcher()


def test_rulebook_reads_known_headlines():
    assert M is not None
    p = M.pick("OPEC+ agrees deeper oil production cuts through next year")
    assert p["sources"][0] == "Oil_Supply" and p["direction"] == -1
    p = M.pick("Fed signals interest rates will stay higher for longer")
    assert p["sources"][0] == "Interest_Rates" and p["direction"] == 1


def test_rulebook_skips_what_it_cannot_read():
    assert M.pick("Marine biologists discover a new species of deep-sea octopus") is None
    assert M.pick("Harvard's endowment jumps 27% in fiscal 2026") is None


def _analysis():
    return {
        "drivers": [
            {"id": "Oil_and_Gas", "impact": 1.0, "direction": -1, "hops": 0,
             "lag_months": 0, "path": ["Oil_and_Gas"]},
            {"id": "Airlines", "impact": 0.62, "direction": -1, "hops": 2,
             "lag_months": 3, "path": ["Oil_and_Gas", "Jet_Fuel", "Airlines"]},
        ],
        "assets": [{"ticker": t, "direction": -1}
                   for t in ("XOM", "DAL", "UAL", "BP", "CVX", "AAL")],
    }


def test_engine_brief_names_only_graph_results():
    text = _engine_brief(_analysis(), [])
    for t in ("XOM", "DAL", "UAL", "BP", "CVX"):
        assert t in text
    assert "AAL" not in text  # only the top 5 are named
    assert "NVDA" not in text
    assert "Oil and Gas → Jet Fuel → Airlines" in text


def test_engine_brief_notes_compounding():
    text = _engine_brief(_analysis(), [{"headline": "OPEC+ agrees deeper oil production cuts"}])
    assert "adds to earlier news" in text
