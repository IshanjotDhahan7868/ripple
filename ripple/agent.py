"""Agent loop: the model picks tools from a fixed catalog and fills parameters; tools validate against the
graph; the final brief is checked so it can only name tickers and drivers the graph actually returned."""

import json
import os
import re
from typing import Callable

from . import budget
from . import queries as Q
from . import tools as T

MAX_TURNS = 8
Emit = Callable[[dict], None]

SYSTEM = """You are Ripple, an analyst agent that traces how a news headline propagates through an explicit \
causal graph of the economy stored in FalkorDB, then acts on it by filing an alert.

Rules:
- You never invent graph facts. Driver ids must come from the catalog below (or search_drivers). Tickers, \
paths, strengths and lags must come from tool results.
- Workflow: (1) choose the 1-3 drivers the headline most directly moves and whether it raises (1) or lowers \
(-1) each one's level; (2) analyze_impact; (3) recall_events on the same drivers (last 30 days); \
(4) record_alert with the top tickers; (5) reply with the brief.
- If no driver in the catalog is plausibly moved by the headline, do not call analyze_impact. Reply exactly \
"NOT_IN_GRAPH: " followed by one sentence on why. Saying the graph does not model something is correct behaviour.
- Brief: 3-5 sentences, plain English. Lead with the strongest second-order effect (hops >= 2), cite its \
path with arrows, name tickers with their direction (up/down) and lag window. If recall_events found earlier \
events on the same drivers, say the pressure is compounding and name them. Describe exposure, never advice.

Driver catalog (id | theme):
{catalog}"""

PLAIN_SYSTEM = ("You are a markets analyst. Given a headline, list the assets most exposed to it and why, "
                "in 3-5 sentences.")

TICKER = re.compile(r"\b[A-Z][A-Z0-9]{0,5}(?:\.[A-Z]{1,2})?\b")
DRIVER = re.compile(r"\b[A-Z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b")


def catalog(g) -> tuple[str, set[str], set[str]]:
    drivers = g.ro_query("MATCH (d:Driver) RETURN d.id, d.theme ORDER BY d.theme, d.id").result_set
    tickers = {r[0] for r in g.ro_query("MATCH (a:Asset) RETURN a.ticker").result_set}
    text = "\n".join(f"{i} | {t}" for i, t in drivers)
    return text, {r[0] for r in drivers}, tickers


def check_brief(text: str, allowed_tickers: set[str], allowed_drivers: set[str],
                universe: set[str]) -> list[str]:
    """Names in the brief that the graph did not return this run."""
    invented = {t for t in TICKER.findall(text) if t in universe and t not in allowed_tickers}
    invented |= {d for d in DRIVER.findall(text) if d not in allowed_drivers}
    return sorted(invented)


class Run:
    """State for one headline: tool results the brief is allowed to cite, and the answer type."""

    def __init__(self, g, headline: str, depth: int, emit: Emit):
        self.g, self.headline, self.depth, self.emit = g, headline, depth, emit
        self.analysis: dict | None = None
        self.memory: list[dict] = []
        self.unknown_ids = False
        self.usd = 0.0

    def call(self, name: str, args: dict) -> tuple[dict, bool]:
        if name not in T.FUNCS:
            return {"error": f"No tool named {name}"}, True
        if name == "analyze_impact":
            args = {**args, "depth": self.depth}
        self.emit({"type": "tool_call", "name": name, "input": args})
        try:
            result, is_error = T.FUNCS[name](self.g, **args), False
        except T.ToolError as e:
            result, is_error = {"error": str(e)}, True
            self.unknown_ids = True
        except TypeError as e:
            result, is_error = {"error": f"Bad arguments: {e}"}, True
        if name == "analyze_impact" and not is_error:
            self.analysis = result
        if name == "recall_events" and not is_error:
            self.memory = result["events"]
        self.emit({"type": "tool_result", "name": name, "error": is_error, "result": result,
                   "queries": self.g.drain()})
        return result, is_error

    def allowed(self) -> tuple[set[str], set[str]]:
        if not self.analysis:
            return set(), set()
        tickers = {a["ticker"] for a in self.analysis["assets"]}
        drivers = {d["id"] for d in self.analysis["drivers"]} | {n for a in self.analysis["assets"] for n in a["path"]}
        for e in self.memory:
            drivers |= set(e["drivers"])
        return tickers, drivers

    def answer_type(self, text: str) -> str:
        if self.analysis:
            return "compounding" if self.memory else "answered"
        if self.unknown_ids:
            return "unknown_entity"
        return "not_in_graph"

    def fallback_brief(self) -> str:
        a = self.analysis
        top = next((d for d in a["drivers"] if d["hops"] >= 2), a["drivers"][0])
        tick = ", ".join(f'{x["ticker"]} ({"up" if x["direction"] > 0 else "down"})' for x in a["assets"][:5])
        return (f'Strongest second-order effect: {" → ".join(top["path"])} '
                f'(~{top["lag_months"]} months). Most exposed: {tick}.')


# ---------- providers ----------

_UNSUPPORTED_IN_STRICT = {"maxItems", "minimum", "maximum", "minLength", "maxLength"}


def _strict_schema(schema):
    """Strict tool use rejects some bounds; drop them here. The tools enforce the same bounds themselves."""
    if isinstance(schema, dict):
        return {k: _strict_schema(v) for k, v in schema.items() if k not in _UNSUPPORTED_IN_STRICT}
    if isinstance(schema, list):
        return [_strict_schema(v) for v in schema]
    return schema


def _anthropic_loop(run: Run, system: str, user: str) -> str:
    import anthropic

    client = anthropic.Anthropic()
    model = os.getenv("RIPPLE_CLAUDE_MODEL", "claude-opus-5-5")
    tool_spec = [{**t, "input_schema": _strict_schema(t["input_schema"]), "strict": True} for t in T.SPEC]
    messages = [{"role": "user", "content": user}]
    for _ in range(MAX_TURNS):
        resp = client.beta.messages.create(
            model=model, max_tokens=8000, system=system, tools=tool_spec, messages=messages,
            output_config={"effort": os.getenv("RIPPLE_EFFORT", "low")},
            cache_control={"type": "ephemeral"},
            betas=["server-side-fallback-2026-07-01"], fallbacks="default",
        )
        run.usd += budget.cost(resp.model, resp.usage)
        if resp.stop_reason == "refusal":
            return "NOT_IN_GRAPH: the request was declined."
        messages.append({"role": "assistant", "content": resp.content})
        uses = [b for b in resp.content if b.type == "tool_use"]
        if not uses:
            return "".join(b.text for b in resp.content if b.type == "text").strip()
        results = []
        for b in uses:
            out, err = run.call(b.name, dict(b.input))
            results.append({"type": "tool_result", "tool_use_id": b.id, "content": json.dumps(out), "is_error": err})
        messages.append({"role": "user", "content": results})
    return ""


def _gemini_loop(run: Run, system: str, user: str) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    model = os.getenv("RIPPLE_GEMINI_MODEL", "gemini-2.5-flash")
    decls = [types.FunctionDeclaration(name=t["name"], description=t["description"],
                                       parameters_json_schema=t["input_schema"]) for t in T.SPEC]
    config = types.GenerateContentConfig(
        system_instruction=system, tools=[types.Tool(function_declarations=decls)],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))
    contents = [types.Content(role="user", parts=[types.Part.from_text(text=user)])]
    for _ in range(MAX_TURNS):
        resp = client.models.generate_content(model=model, contents=contents, config=config)
        calls = resp.function_calls or []
        if not calls:
            return (resp.text or "").strip()
        contents.append(resp.candidates[0].content)
        parts = []
        for c in calls:
            out, err = run.call(c.name, dict(c.args or {}))
            parts.append(types.Part.from_function_response(name=c.name, response={"error" if err else "result": out}))
        contents.append(types.Content(role="user", parts=parts))
    return ""


def _plain(system: str, user: str) -> str:
    if os.getenv("RIPPLE_PROVIDER", "gemini") == "anthropic":
        import anthropic
        resp = anthropic.Anthropic().messages.create(
            model=os.getenv("RIPPLE_CLAUDE_MODEL", "claude-opus-5-5"), max_tokens=2000, system=system,
            output_config={"effort": "low"}, messages=[{"role": "user", "content": user}])
        _plain.usd = budget.cost(resp.model, resp.usage)
        return "".join(b.text for b in resp.content if b.type == "text").strip()
    from google import genai
    from google.genai import types
    resp = genai.Client(api_key=os.environ["GEMINI_API_KEY"]).models.generate_content(
        model=os.getenv("RIPPLE_GEMINI_MODEL", "gemini-2.5-flash"), contents=user,
        config=types.GenerateContentConfig(system_instruction=system))
    return (resp.text or "").strip()


# ---------- entry points ----------

def analyze(g, headline: str, depth: int, emit: Emit) -> dict:
    cat, _, universe = catalog(g)
    g.drain()
    run = Run(g, headline, max(1, min(int(depth), Q.MAX_DEPTH)), emit)
    loop = _anthropic_loop if os.getenv("RIPPLE_PROVIDER", "gemini") == "anthropic" else _gemini_loop
    system = SYSTEM.format(catalog=cat)
    text = loop(run, system, f"Headline: {headline}")

    if run.analysis:
        tickers, drivers = run.allowed()
        invented = check_brief(text, tickers, drivers, universe)
        if invented:
            emit({"type": "guard", "invented": invented, "action": "replaced with graph-derived brief"})
            text = run.fallback_brief()
    elif text.startswith("NOT_IN_GRAPH:"):
        text = text.removeprefix("NOT_IN_GRAPH:").strip()

    result = {"type": "brief", "answer_type": run.answer_type(text), "text": text,
              "analysis": run.analysis, "memory": run.memory, "usd": round(run.usd, 4)}
    emit(result)
    return result


def plain_answer(headline: str) -> str:
    return _plain(PLAIN_SYSTEM, f"Headline: {headline}")
