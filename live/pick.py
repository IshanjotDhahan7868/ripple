"""Free headline -> driver matcher. Rulebook first, then the graph's own aliases plus the nearest rise/fall
word. No AI: anything it gets wrong is fixed at the next Claude Code checkup by adding a rule."""

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
UP = set("""rise rises rising rose surge surges surged soar soars soared jump jumps jumped climb climbs climbed gain gains
gained raise raises raised hike hikes hiked increase increases increased boost boosts boosted expand expands expanded
rally rallies rallied spike spikes spiked accelerate accelerates strengthen strengthens strong stronger higher
record beat beats tops grow grows grew growth booms boom ramp ramps add adds added escalate escalates escalation
attack attacks strike strikes approve approves approved wins win tighten tightens shortage""".split())
DOWN = set("""fall falls falling fell drop drops dropped decline declines declined plunge plunges plunged slump slumps
slumped cut cuts slash slashes slashed lower lowers lowered reduce reduces reduced shrink shrinks shrank slow slows
slowed slowdown weaken weakens weak weaker halt halts halted pause pauses paused ban bans banned miss misses missed
tumble tumbles tumbled sink sinks sank ease eases eased cool cools cooled contraction contracts slide slides slid
low lows loses lose lost retreat retreats crash crashes curb curbs delay delays scrap scraps cancel cancels
ceasefire truce peace deescalate temper tempers tempered hit end demise phase-out phaseout""".split())
NEGATE = {"not", "no", "never", "won't", "wont", "doesn't", "didn't", "isn't", "without", "unlikely", "rules", "against"}
# defaults only fire when the headline actually describes trouble, not a mere mention of the place
TROUBLE = set("""attack attacks strike strikes war missile missiles drills blockade sanctions tension tensions threat threatens
violent violence clash clashes invade invasion seize seized hack hacked breach outage disrupts disrupted escalate
escalation conflict fighting bombing shelling drone drones storm fire flood quake lawsuit sues probe fine fined""".split())
WORD = re.compile(r"[a-z0-9][a-z0-9'\-+&.]*")
BREAK = re.compile(r"[,;:|]|\b(and|but|while|as|after|despite|amid|though|even as)\b")


class Matcher:
    def __init__(self, graph_yaml: Path = ROOT / "seed" / "graph.yaml", rules_yaml: Path = ROOT / "live" / "rules.yaml"):
        nodes = yaml.safe_load(graph_yaml.read_text())["nodes"]
        book = yaml.safe_load(rules_yaml.read_text()) or {}
        self.ids = {n["id"] for n in nodes}
        inverse = {(d, a.lower()) for d, al in (book.get("inverse") or {}).items() for a in al}
        self.aliases = sorted(
            ((a.lower(), n["id"], -1 if (n["id"], a.lower()) in inverse else 1) for n in nodes for a in n.get("aliases") or []),
            key=lambda x: -len(x[0]))
        self.rules = [(re.compile(r["match"], re.I), r["drivers"]) for r in book.get("rules") or []]
        self.default = book.get("default") or {}
        self.skip = [re.compile(s, re.I) for s in book.get("skip") or []]
        self.ignore = [re.compile(s, re.I) for s in book.get("ignore") or []]
        bad = {d for _, ds in self.rules for d in ds} | set(self.default) | set(book.get("inverse") or {})
        if bad - self.ids:
            raise ValueError(f"rules.yaml names unknown drivers: {sorted(bad - self.ids)}")

    def pick(self, headline: str) -> dict | None:
        """{sources, direction, how, matched} or None when the headline isn't something the map covers."""
        if any(s.search(headline) for s in self.skip):
            return None
        for rx, drivers in self.rules:
            m = rx.search(headline)
            if m and drivers:
                d = list(drivers.items())
                flip = -1 if any(w in NEGATE for w in WORD.findall(m.group().lower())) else 1
                d = [(k, v * flip) for k, v in d]
                sign = d[0][1]
                return {"sources": [k for k, v in d if v == sign][:3], "direction": sign, "how": "rule", "matched": [rx.pattern]}

        text = headline.lower()
        for rx in self.ignore:  # phrases that look like an alias but aren't ("fiscal 2026")
            text = rx.sub(lambda m: " " * len(m.group()), text)
        words = [(m.group(), m.start()) for m in WORD.finditer(text)]
        cuts = [m.start() for m in BREAK.finditer(text)]
        clause = lambda pos: sum(c <= pos for c in cuts)  # noqa: E731
        trouble = any(w in TROUBLE for w, _ in words)
        hits, taken = [], []
        for alias, driver, polarity in self.aliases:
            for m in re.finditer(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", text):
                span = (m.start(), m.end())
                if any(a < span[1] and span[0] < b for a, b in taken):
                    continue
                taken.append(span)
                hits.append((driver, polarity, span, alias))
        if not hits:
            return None

        picks = []
        for driver, polarity, (a, b), alias in hits:
            # nearest rise/fall word in the alias's own clause; the whole headline only if the clause has none
            best = self._nearest(words, a, b, lambda pos: clause(pos) == clause(a)) or self._nearest(words, a, b, lambda pos: True)
            if best:
                picks.append((driver, best[1] * polarity, alias))
            elif driver in self.default and trouble:
                picks.append((driver, self.default[driver] * polarity, alias))
        if not picks:
            return None
        sign = picks[0][1]
        sources = list(dict.fromkeys(d for d, s, _ in picks if s == sign))[:3]
        return {"sources": sources, "direction": sign, "how": "keywords",
                "matched": [al for d, s, al in picks if s == sign]}

    @staticmethod
    def _nearest(words, a, b, keep):
        best = None
        for k, (w, pos) in enumerate(words):
            if a <= pos < b or not keep(pos):
                continue
            sign = 1 if w in UP else -1 if w in DOWN else 0
            if not sign:
                continue
            if k + 1 < len(words) and (words[k + 1][0] in UP or words[k + 1][0] in DOWN):
                continue  # "growth slowdown": the last word of the pair carries the meaning
            if any(x in NEGATE for x, _ in words[max(0, k - 3):k]):
                sign = -sign
            if best is None or abs(pos - a) < best[0]:
                best = (abs(pos - a), sign)
        return best
