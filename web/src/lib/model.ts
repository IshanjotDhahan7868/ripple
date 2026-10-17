// Turns raw engine output into the plain-English pieces every view shares:
// names instead of ids, strength and timing words, stock groups and cause-and-effect chains.
import type { Analysis, AssetExposure, GraphEdge, GraphNode } from "./api";
import { TICKER_NAMES } from "./tickers";

export type Lookup = {
  name: (id: string) => string;
  node: (id: string) => GraphNode | undefined;
  edge: (from: string, to: string) => GraphEdge | undefined;
};

export function makeLookup(graph: { nodes: GraphNode[]; edges: GraphEdge[] }): Lookup {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const edges = new Map(graph.edges.map((e) => [`${e.source}>${e.target}`, e]));
  return {
    name: (id) => nodes.get(id)?.name ?? id.replaceAll("_", " "),
    node: (id) => nodes.get(id),
    edge: (from, to) => edges.get(`${from}>${to}`),
  };
}

export type Strength = "Strong" | "Medium" | "Weak";

export function strength(score: number, max: number): Strength {
  const r = max > 0 ? Math.abs(score) / max : 0;
  return r >= 0.6 ? "Strong" : r >= 0.3 ? "Medium" : "Weak";
}

export function when(months: number): string {
  if (months <= 0) return "right away";
  if (months < 12) return `in about ${months} month${months === 1 ? "" : "s"}`;
  const y = Math.round((months / 12) * 2) / 2;
  return `in about ${y} year${y === 1 ? "" : "s"}`;
}

export const company = (ticker: string) => TICKER_NAMES[ticker] ?? ticker;

export type Group = {
  key: string;
  driver: string; // the economic force these stocks hang off
  name: string;
  up: boolean;
  tickers: { ticker: string; score: number; type: string }[];
  score: number; // strongest stock in the group
  months: number;
  hops: number;
  path: string[]; // driver chain from the news to `driver`
  strength: Strength;
};

// Stocks grouped by the force they are exposed through, split into falling and rising.
export function groupAssets(a: Analysis, L: Lookup): { downs: Group[]; ups: Group[]; max: number } {
  const max = Math.max(0, ...a.assets.map((x) => Math.abs(x.score)));
  const groups = new Map<string, Group>();
  for (const x of a.assets) {
    const driver = x.path[x.path.length - 1] ?? x.via[0];
    const up = x.direction > 0;
    const key = `${driver}:${up ? "up" : "down"}`;
    let g = groups.get(key);
    if (!g) {
      const direct = a.sources.includes(driver);
      g = { key, driver, name: direct ? `Tied directly to ${L.name(driver).toLowerCase()}` : L.name(driver), up, tickers: [], score: 0, months: x.lag_months, hops: x.hops, path: x.path, strength: "Weak" };
      groups.set(key, g);
    }
    g.tickers.push({ ticker: x.ticker, score: Math.abs(x.score), type: x.type });
    if (Math.abs(x.score) > g.score) {
      g.score = Math.abs(x.score);
      g.months = x.lag_months;
      g.hops = x.hops;
      g.path = x.path;
    }
  }
  const all = [...groups.values()].map((g) => ({
    ...g,
    tickers: g.tickers.sort((p, q) => q.score - p.score),
    strength: strength(g.score, max),
  }));
  all.sort((p, q) => q.score - p.score);
  return { downs: all.filter((g) => !g.up), ups: all.filter((g) => g.up), max };
}

export type Step = {
  id: string;
  label: string;
  up: boolean;
  months: number; // cumulative, from the engine
  why?: string; // the graph edge's own explanation of how the previous step causes this one
};

export function chain(path: string[], a: Analysis, L: Lookup): Step[] {
  const byId = new Map(a.drivers.map((d) => [d.id, d]));
  return path.map((id, i) => {
    const d = byId.get(id);
    return {
      id,
      label: L.name(id),
      up: (d?.direction ?? a.direction) > 0,
      months: d?.lag_months ?? 0,
      why: i > 0 ? L.edge(path[i - 1], id)?.why : undefined,
    };
  });
}

export type Selection = { path: string[]; tickers: string[]; up?: boolean };

export function verdict(downs: Group[], ups: Group[]): string {
  const first = [...downs, ...ups].sort((p, q) => p.months - q.months || q.score - p.score)[0];
  const d = downs[0];
  const u = ups[0];
  if (!d && !u) return "Nothing in the map is pushed hard enough to call.";
  const subject = (g: Group) =>
    g.name.startsWith("Tied directly") ? `stocks ${g.name.toLowerCase()} are` : `${g.name} ${g.tickers.length > 1 ? "stocks are" : "is"}`;
  const parts: string[] = [];
  if (d) parts.push(`${subject(d)} the most likely to fall`);
  if (u) parts.push(`${subject(u)} the most likely to rise`);
  const lead = parts.join(", while ");
  return `${lead[0].toUpperCase()}${lead.slice(1)}. The first effects land ${when(first.months)}.`;
}

// Claude's brief, cleaned for reading: driver ids become names, markdown emphasis goes.
export function tidy(text: string, L: Lookup): string {
  return text
    .replace(/\b[A-Z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g, (id) => L.name(id))
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "");
}

export function exposureCount(a: Analysis) {
  const up = a.assets.filter((x: AssetExposure) => x.direction > 0).length;
  return { up, down: a.assets.length - up };
}

// Every "see it as" view takes the same props, so they always show the same answer.
export type ViewProps = {
  a: Analysis;
  L: Lookup;
  downs: Group[];
  ups: Group[];
  max: number;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
};
