"""Spend guard for the public demo: a running dollar total and a replay cache, both stored in FalkorDB."""

import hashlib
import json
import os
import time

# $ per million tokens: input, output, cache read, cache write (5-minute)
PRICES = {
    "claude-opus-5-5": (4.0, 20.0, 0.20, 5.0),
    "claude-sonnet-5-5": (2.0, 10.0, 0.20, 2.5),
    "claude-haiku-4-5": (1.0, 5.0, 0.10, 1.25),
}


def cost(model: str, usage) -> float:
    p = next((v for k, v in PRICES.items() if model.startswith(k)), PRICES["claude-opus-5-5"])
    return (usage.input_tokens * p[0] + usage.output_tokens * p[1]
            + (usage.cache_read_input_tokens or 0) * p[2]
            + (usage.cache_creation_input_tokens or 0) * p[3]) / 1e6


def limit() -> float:
    return float(os.getenv("RIPPLE_BUDGET_USD", "3.00"))


def spent(g) -> float:
    rows = g.ro_query("MATCH (m:Meter {id: 'llm'}) RETURN m.usd").result_set
    return float(rows[0][0]) if rows else 0.0


def charge(g, usd: float) -> float:
    rows = g.query("MERGE (m:Meter {id: 'llm'}) ON CREATE SET m.usd = 0.0 "
                   "SET m.usd = m.usd + $usd, m.at = $at RETURN m.usd",
                   {"usd": float(usd), "at": int(time.time())}).result_set
    return float(rows[0][0])


# bump when the brief's prompt or format changes, so stale replays are not served
BRIEF_VERSION = "2"


def _key(headline: str, depth: int) -> str:
    norm = " ".join(headline.lower().split())
    return hashlib.sha1(f"{norm}|{depth}|{os.getenv('RIPPLE_PROVIDER', 'gemini')}|{BRIEF_VERSION}".encode()).hexdigest()


def cached_run(g, headline: str, depth: int) -> list[dict] | None:
    rows = g.ro_query("MATCH (r:AgentRun {key: $key}) RETURN r.events",
                      {"key": _key(headline, depth)}).result_set
    return json.loads(rows[0][0]) if rows else None


def store_run(g, headline: str, depth: int, events: list[dict]) -> None:
    g.query("MERGE (r:AgentRun {key: $key}) SET r.headline = $headline, r.events = $events, r.at = $at",
            {"key": _key(headline, depth), "headline": headline,
             "events": json.dumps(events, default=str), "at": int(time.time())})
