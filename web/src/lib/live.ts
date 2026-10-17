import type { Analysis } from "@/lib/api";

// written every 2 hours by the live workflow; raw GitHub serves it with open CORS and a 5 minute cache
export const LIVE_BASE = "https://raw.githubusercontent.com/IshanjotDhahan7868/ripple/live";

export type Grade = { hit: boolean; excess: number; from: string; to: string };

export type LivePick = { sources: string[]; direction: number; how: "rule" | "keywords"; matched: string[] };

export type LiveSummary = {
  id: string;
  headline: string;
  source: string;
  url: string;
  published: number | null;
  traced_at: number;
  pick: LivePick;
  earlier: { id: string; headline: string }[];
  grade: Record<string, Grade>;
  top: { ticker: string; direction: number }[];
};

export type LiveItem = LiveSummary & { analysis: Analysis };

export type LiveFeed = {
  updated: number;
  total: number;
  withdrawn?: number;
  checkup?: { at: number; note: string } | null;
  items: LiveSummary[];
  score: Record<"5" | "20", { graded: number; right: number; avg_excess: number | null }> & { waiting: number };
};

export async function getLiveFeed(): Promise<LiveFeed> {
  const r = await fetch(`${LIVE_BASE}/feed.json`, { cache: "no-store" });
  if (!r.ok) throw new Error(`live feed ${r.status}`);
  return r.json();
}

// every call ever made, including withdrawn ones (kept public on purpose)
export type LedgerItem = LiveSummary & { withdrawn?: { at: number; reason: string }; revises?: string; reached?: number };

export async function getLedger(): Promise<LedgerItem[]> {
  const r = await fetch(`${LIVE_BASE}/ledger.json`, { cache: "no-store" });
  if (!r.ok) throw new Error(`live ledger ${r.status}`);
  return r.json();
}

export async function getLiveItem(id: string): Promise<LiveItem> {
  const r = await fetch(`${LIVE_BASE}/items/${id}.json`);
  if (!r.ok) throw new Error(`live item ${r.status}`);
  return r.json();
}

export function ago(ts: number | null) {
  if (!ts) return "recently";
  const m = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60));
  if (m < 2) return "just now";
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
