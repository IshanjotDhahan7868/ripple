export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export type GraphNode = { id: string; name: string; theme: string; type: string; description: string };
export type GraphEdge = {
  source: string;
  target: string;
  weight: number;
  confidence: number;
  lag_months: number;
  polarity: number;
  why: string;
};
export type DriverImpact = {
  id: string;
  impact: number;
  direction: number;
  hops: number;
  lag_months: number;
  path: string[];
};
export type AssetExposure = {
  ticker: string;
  type: string;
  score: number;
  direction: number;
  via: string[];
  path: string[];
  lag_months: number;
  hops: number;
};
export type QueryTrace = { name: string; cypher: string; params: Record<string, unknown>; rows: number; ms: number };
export type Analysis = {
  sources: string[];
  direction: number;
  depth: number;
  drivers: DriverImpact[];
  assets: AssetExposure[];
  reached: number;
};
export type MemoryEvent = { id: string; headline: string; at: number; direction: number; drivers: string[] };
export type AnswerType = "answered" | "compounding" | "not_in_graph" | "unknown_entity";

export type StreamEvent =
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; error: boolean; result: Record<string, unknown>; queries: QueryTrace[] }
  | { type: "guard"; invented: string[]; action: string }
  | { type: "brief"; answer_type: AnswerType; text: string; analysis: Analysis | null; memory: MemoryEvent[] }
  | { type: "error"; message: string }
  | { type: "done" };

export async function getGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const r = await fetch(`${API}/api/graph`);
  if (!r.ok) throw new Error(`Graph request failed (${r.status})`);
  return r.json();
}

export async function getRipple(
  source: string,
  direction: number,
  depth: number,
): Promise<Analysis & { queries: QueryTrace[] }> {
  const q = new URLSearchParams({ source, direction: String(direction), depth: String(depth) });
  const r = await fetch(`${API}/api/ripple?${q}`);
  if (!r.ok) throw new Error((await r.json()).detail ?? `Ripple request failed (${r.status})`);
  return r.json();
}

export async function getEvents(): Promise<MemoryEvent[]> {
  const r = await fetch(`${API}/api/events`);
  if (!r.ok) return [];
  return (await r.json()).events;
}

export async function streamAnalyze(
  headline: string,
  depth: number,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch(`${API}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headline, depth }),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`Analyze request failed (${r.status})`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i).trim();
      buf = buf.slice(i + 2);
      if (chunk.startsWith("data:")) onEvent(JSON.parse(chunk.slice(5)));
    }
  }
}

export async function compare(headline: string): Promise<string> {
  const r = await fetch(`${API}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headline }),
  });
  if (!r.ok) throw new Error(`Compare request failed (${r.status})`);
  return (await r.json()).plain;
}

export const pretty = (id: string) => id.replaceAll("_", " ");
