"""One pass of the live loop: read the feeds, trace new headlines the map covers, grade old calls, write JSON.

    python -m live.run --out data/live          # needs a seeded FalkorDB (FALKORDB_HOST/PORT)

Free by design: no AI calls. Writes feed.json (what the site shows), ledger.json (every call ever, for the score), items/<id>.json (full analysis per
headline) and state.json (every headline already seen, so nothing is traced twice)."""

import argparse
import json
import time
from pathlib import Path

from ripple import db
from ripple import tools as T

from . import feeds, grade
from .pick import Matcher

PER_RUN = 8        # new traces per run; keeps the feed readable and the run short
KEEP = 80          # items shown in feed.json
MEMORY_DAYS = 30


def load(path: Path, default):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def summary(item: dict) -> dict:
    a = item["analysis"]
    top = sorted(a["assets"], key=lambda x: -x["score"])
    return {k: item.get(k) for k in ("id", "headline", "source", "url", "published", "traced_at", "pick", "earlier", "grade")} | {
        "top": [{"ticker": x["ticker"], "direction": x["direction"]} for x in top[:6]],
        "reached": a["reached"],
    }


def trace(g, matcher: Matcher, fresh: list[dict], history: list[dict]) -> list[dict]:
    out = []
    for it in fresh:
        p = matcher.pick(it["headline"])
        if not p:
            continue
        try:
            analysis = T.analyze_impact(g, p["sources"], p["direction"], depth=4)
        except T.ToolError as e:
            print(f"skip {it['headline'][:60]}: {e}")
            continue
        if not analysis["assets"]:
            continue
        since = time.time() - MEMORY_DAYS * 86400
        earlier = [{"id": h["id"], "headline": h["headline"]} for h in history
                   if not h.get("withdrawn") and (h.get("traced_at") or 0) >= since and set(h["pick"]["sources"]) & set(p["sources"])][:3]
        out.append(it | {"pick": p, "analysis": analysis, "earlier": earlier, "traced_at": int(time.time()), "grade": {}})
        if len(out) >= PER_RUN:
            break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/live")
    ap.add_argument("--no-fetch", action="store_true", help="only re-grade")
    args = ap.parse_args()
    out = Path(args.out)
    (out / "items").mkdir(parents=True, exist_ok=True)

    state = load(out / "state.json", {"seen": [], "runs": 0})
    history = load(out / "ledger.json", [])  # every traced headline, ever; feed.json shows the newest
    seen = set(state["seen"])

    new, counts = [], {}
    if not args.no_fetch:
        headlines = feeds.fetch(counts=counts)
        fresh = [h for h in headlines if h["id"] not in seen]
        new = trace(db.graph(), Matcher(), fresh, history)
        seen |= {h["id"] for h in headlines}
        print(f"{len(headlines)} headlines, {len(fresh)} unseen, {len(new)} traced")
        for item in new:
            (out / "items" / f"{item['id']}.json").write_text(json.dumps(item))

    items = [summary(i) for i in new] + history
    items = grade.update(items, out / "items")
    write(out, items, checkup=load(out / "feed.json", {}).get("checkup"))
    state = {"seen": sorted(seen)[-5000:], "runs": state["runs"] + 1, "last_run": int(time.time()),
             "last_new": len(new), "feeds": counts or state.get("feeds", {})}
    (out / "state.json").write_text(json.dumps(state))


def write(out: Path, items: list[dict], checkup: dict | None = None):
    """feed.json shows live calls only; withdrawn ones stay in the ledger and are counted, never hidden."""
    shown = [i for i in items if not i.get("withdrawn")]
    feed = {"updated": int(time.time()), "items": shown[:KEEP], "total": len(shown),
            "withdrawn": len(items) - len(shown), "score": grade.scoreboard(shown), "checkup": checkup}
    (out / "ledger.json").write_text(json.dumps(items))
    (out / "feed.json").write_text(json.dumps(feed, indent=1))
    print("score:", feed["score"])


if __name__ == "__main__":
    main()
