"""Checkup helper, run by Claude Code (or a person) every so often; see docs/checkup.md.

    python -m live.review --data data/live                      # report: health, recent calls, score
    python -m live.review --data data/live --recheck            # re-read ungraded calls with the current rulebook
    python -m live.review --data data/live --withdraw ID --reason "..."
    python -m live.review --data data/live --note "what this checkup changed"

Only ungraded calls can be revised or withdrawn, so a checkup can never tidy away a call that turned out wrong."""

import argparse
import json
import time
from pathlib import Path

from .pick import Matcher
from .run import load, write


def ungraded(i: dict) -> bool:
    return not i.get("grade") and not i.get("withdrawn")


def report(data: Path, n: int):
    state, items = load(data / "state.json", {}), load(data / "ledger.json", [])
    feed = load(data / "feed.json", {})
    last = state.get("last_run")
    print(f"runs: {state.get('runs', 0)}, last {round((time.time() - last) / 3600, 1) if last else '?'}h ago, "
          f"new last run: {state.get('last_new')}")
    for name, c in (state.get("feeds") or {}).items():
        print(f"  feed {name}: {c} headlines{'  <-- DEAD?' if not c else ''}")
    print("score:", json.dumps(feed.get("score")), "withdrawn:", feed.get("withdrawn"))
    how = {}
    for i in items:
        how[i["pick"]["how"]] = how.get(i["pick"]["how"], 0) + 1
    print("matched by:", how)
    print(f"\nnewest {n} calls (id | dir drivers | how: matched | top | grade | headline)")
    for i in items[:n]:
        p = i["pick"]
        g = i.get("grade", {}).get("5")
        mark = "WITHDRAWN" if i.get("withdrawn") else ("right" if g and g["hit"] else "wrong" if g else "-")
        top = " ".join(f"{t['ticker']}{'+' if t['direction'] > 0 else '-'}" for t in i["top"][:4])
        print(f"{i['id']} | {p['direction']:+d} {','.join(p['sources'])} | {p['how']}: {'; '.join(p['matched'])[:30]} "
              f"| {top} | {mark} | {i['headline'][:90]}")


def recheck(data: Path, items: list[dict]) -> list[str]:
    """Re-read every ungraded call with the current rulebook. Changed reads are withdrawn, so the robot
    traces nothing twice and never quietly swaps a call; the corrected read is reported for the checkup."""
    m, changes = Matcher(), []
    for i in items:
        if not ungraded(i):
            continue
        p = m.pick(i["headline"])
        old = (sorted(i["pick"]["sources"]), i["pick"]["direction"])
        if p and (sorted(p["sources"]), p["direction"]) == old:
            continue
        reason = "rulebook now skips this headline" if not p else \
            f"rulebook now reads it as {','.join(p['sources'])} {'up' if p['direction'] > 0 else 'down'}"
        i["withdrawn"] = {"at": int(time.time()), "reason": reason}
        changes.append(f"{i['id']}: {reason} | {i['headline'][:80]}")
    return changes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/live")
    ap.add_argument("-n", type=int, default=30)
    ap.add_argument("--recheck", action="store_true")
    ap.add_argument("--withdraw")
    ap.add_argument("--reason", default="misread at checkup")
    ap.add_argument("--note")
    args = ap.parse_args()
    data = Path(args.data)
    items = load(data / "ledger.json", [])
    feed = load(data / "feed.json", {})
    changed = False

    if args.recheck:
        for c in recheck(data, items):
            print("withdrawn", c)
            changed = True
    if args.withdraw:
        hit = [i for i in items if i["id"] == args.withdraw]
        if not hit or not ungraded(hit[0]):
            raise SystemExit("can only withdraw an ungraded call that exists")
        hit[0]["withdrawn"] = {"at": int(time.time()), "reason": args.reason}
        changed = True
    checkup = feed.get("checkup")
    if args.note:
        checkup = {"at": int(time.time()), "note": args.note}
        changed = True
    if changed:
        write(data, items, checkup=checkup)
    else:
        report(data, args.n)


if __name__ == "__main__":
    main()
