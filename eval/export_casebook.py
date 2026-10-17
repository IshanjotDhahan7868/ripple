"""Trim eval/results.json into the casebook the website shows (web/public/casebook.json). No new numbers."""
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
res = json.loads((ROOT / "eval" / "results.json").read_text())
urls = {str(e["date"]): e.get("source_url") for e in yaml.safe_load((ROOT / "eval" / "events.yaml").read_text())}

out = {
    "graph": res["graph"],
    "aggregate": {h: {k: res["aggregate"][h][k] for k in ("n_events", "n_picks", "ripple_pick_hit_rate", "ripple_events_positive",
                                                         "ripple_mean_signed_excess_per_pick", "random_hit_rate_mean")}
                  for h in ("5d", "20d")},
    "events": [{
        "date": e["date"], "headline": e["headline"], "driver": e["driver"], "direction": e["dir"],
        "url": urls.get(str(e["date"])),
        "hit_rate_20d": e["ripple_20d_hit_rate"], "mean_excess_20d": e["ripple_20d_mean_excess"],
        "hit_rate_5d": e["ripple_5d_hit_rate"], "mean_excess_5d": e["ripple_5d_mean_excess"],
        "random_excess_20d": e["random_20d_mean_excess"],
        "picks": [{"ticker": p["ticker"], "direction": p["dir"],
                   "ret_20d": p["20d"]["ret"], "spy_20d": p["20d"]["spy"], "excess_20d": p["20d"]["excess"],
                   "excess_5d": p["5d"]["excess"]} for p in e["picks"]],
    } for e in res["events"]],
}
(ROOT / "web" / "public" / "casebook.json").write_text(json.dumps(out, indent=1))
print(len(out["events"]), "events")
