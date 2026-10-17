"""Grades live calls the same way eval/backtest.py grades history: for the top 5 stocks, does
direction x (stock return - SPY return) come out positive after 5 and 20 trading days?"""

import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

HORIZONS = (5, 20)
TOPN = 5
SYMBOL_MAP = {"COPPER": "HG=F", "BRENT": "BZ=F", "WTI": "CL=F", "NATGAS": "NG=F", "EATON": "ETN",
              "SK Hynix": "000660.KS", "Samsung": "005930.KS", "FORTUM": "FORTUM.HE", "ENEL": "ENEL.MI",
              "RBOB": "RB=F", "ULSD": "HO=F"}
NY = ZoneInfo("America/New_York")


def entry_day(published: int | None, traced_at: int):
    """The session whose close is the entry price: the first close after the call was made (same day if made
    before the 4pm close). Never the publish date when that's earlier: that would grade moves the call came after."""
    t = datetime.fromtimestamp(max(published or 0, traced_at), NY)
    return t.date() if t.hour < 16 else (t.date().fromordinal(t.date().toordinal() + 1))


def update(items: list[dict], items_dir: Path) -> list[dict]:
    todo = [i for i in items if not i.get("withdrawn") and any(str(h) not in (i.get("grade") or {}) for h in HORIZONS)]
    if not todo:
        return items
    try:
        import pandas as pd
        import yfinance as yf
    except ImportError:
        print("grading skipped: pandas/yfinance not installed")
        return items

    picks = {}
    for i in todo:
        f = items_dir / f"{i['id']}.json"
        if not f.exists():
            continue
        assets = sorted(json.loads(f.read_text())["analysis"]["assets"], key=lambda x: -x["score"])
        picks[i["id"]] = [(a["ticker"], a["direction"]) for a in assets]
    symbols = sorted({SYMBOL_MAP.get(t, t) for p in picks.values() for t, _ in p} | {"SPY"})
    start = min(entry_day(i.get("published"), i["traced_at"]) for i in todo) - pd.Timedelta(days=7)
    try:
        px = yf.download(symbols, start=str(start), auto_adjust=True, progress=False)["Close"]
    except Exception as e:
        print(f"grading skipped: {e}")
        return items
    if "SPY" not in px or px["SPY"].dropna().empty:
        return items
    spy = px["SPY"].dropna()
    px = px.reindex(spy.index).ffill()

    for i in todo:
        if i["id"] not in picks:
            continue
        e = spy.index.searchsorted(pd.Timestamp(entry_day(i.get("published"), i["traced_at"])))
        g = dict(i.get("grade") or {})
        for h in HORIZONS:
            if str(h) in g or e + h >= len(spy):
                continue
            scored = []
            for t, d in picks[i["id"]]:
                s = SYMBOL_MAP.get(t, t)
                if s not in px or pd.isna(px[s].iloc[e]) or pd.isna(px[s].iloc[e + h]):
                    continue
                r = px[s].iloc[e + h] / px[s].iloc[e] - 1
                m = spy.iloc[e + h] / spy.iloc[e] - 1
                scored.append({"ticker": t, "direction": d, "ret": round(float(r), 4), "excess": round(float(d * (r - m)), 4)})
                if len(scored) == TOPN:
                    break
            if scored:
                mean = sum(x["excess"] for x in scored) / len(scored)
                g[str(h)] = {"hit": mean > 0, "excess": round(mean, 4), "from": str(spy.index[e].date()),
                             "to": str(spy.index[e + h].date()), "stocks": scored}
        i["grade"] = g
    return items


def scoreboard(items: list[dict]) -> dict:
    out = {}
    for h in HORIZONS:
        done = [i["grade"][str(h)] for i in items if str(h) in (i.get("grade") or {})]
        out[str(h)] = {"graded": len(done), "right": sum(g["hit"] for g in done),
                       "avg_excess": round(sum(g["excess"] for g in done) / len(done), 4) if done else None}
    out["waiting"] = sum(1 for i in items if "5" not in (i.get("grade") or {}))
    return out
