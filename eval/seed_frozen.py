"""Seed eval/graph_frozen_2026-01-21.yaml into FalkorDB graph `ripple_frozen`.
Reuses seed/seed.py. seed/assets.yaml is filtered to drivers that exist in the frozen graph
(the loader aborts on dangling refs). Node-embedded assets in the frozen yaml are kept too."""
import sys, tempfile
from pathlib import Path
import yaml
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "seed"))
import seed as S  # noqa: E402

FROZEN = ROOT / "eval" / "graph_frozen_2026-01-21.yaml"

def main():
    ids = {n["id"] for n in yaml.safe_load(FROZEN.read_text())["nodes"]}
    full = yaml.safe_load((ROOT / "seed" / "assets.yaml").read_text())
    kept = {}
    dropped = 0
    for t, m in full.items():
        nodes = [n for n in m.get("nodes") or [] if n in ids]
        dropped += len(m.get("nodes") or []) - len(nodes)
        if nodes:
            kept[t] = {**m, "nodes": nodes}
    out = ROOT / "eval" / "assets_frozen_filtered.yaml"
    out.write_text(yaml.safe_dump(kept))
    print("assets.yaml: kept", len(kept), "tickers; dropped", dropped, "exposures to drivers not in frozen graph")
    print(S.seed(S.connect(), "ripple_frozen", FROZEN, out))

if __name__ == "__main__":
    main()
