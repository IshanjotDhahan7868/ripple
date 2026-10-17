"use client";

import { useState } from "react";
import { when, type Group, type ViewProps } from "@/lib/model";

const W = 1000;
const LEFT = { x: 10, w: 150 };
const MID = { x: 420, w: 160 };
const RIGHT = { x: 770, w: 10 };
const BAND_GAP = 3;
const ROW_GAP = 16;
const MIN_ROW = 46;
const MAX_BAND = 56;
const MIN_BAND = 6;

type Band = { g: Group; t: number; src: string; mid: string | null; yl: number; ym: number; yr: number };
type Box = { id: string; y: number; h: number; up: number; down: number };

const keyOf = (path: string[], up?: boolean) => `${path.join(">")}:${up ? "up" : "down"}`;

// Split a label into at most two lines so it fits inside a node box.
function lines(text: string, max = 19): string[] {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  let first = "";
  while (words.length && (first + " " + words[0]).trim().length <= max) first = (first + " " + words.shift()).trim();
  const rest = words.join(" ");
  return [first || text.slice(0, max), rest.length > max + 2 ? rest.slice(0, max) + "…" : rest];
}

function layout(groups: Group[], max: number, name: (id: string) => string) {
  const bands: Band[] = groups.map((g) => ({
    g,
    t: Math.max(MIN_BAND, (g.score / (max || 1)) * MAX_BAND),
    src: g.path[0] ?? g.driver,
    mid: g.path.length >= 2 ? g.path[1] : null,
    yl: 0,
    ym: 0,
    yr: 0,
  }));

  // Order: groups that pass through a direct force first, grouped by that force, then direct ones.
  const midOrder: string[] = [];
  for (const b of bands) if (b.mid && !midOrder.includes(b.mid)) midOrder.push(b.mid);
  bands.sort((p, q) => {
    const pi = p.mid ? midOrder.indexOf(p.mid) : midOrder.length;
    const qi = q.mid ? midOrder.indexOf(q.mid) : midOrder.length;
    return pi - qi || q.g.score - p.g.score;
  });

  // Right column: one row per group.
  let y = 24;
  const rows = bands.map((b) => {
    const h = Math.max(MIN_ROW, b.t);
    const row = { y, h };
    b.yr = y + h / 2;
    y += h + ROW_GAP;
    return row;
  });
  const height = Math.max(y + 8, 200);

  // Middle column: boxes centred on their groups' rows, never overlapping.
  const mids: Box[] = [];
  let floor = 24;
  for (const id of midOrder) {
    const mine = bands.filter((b) => b.mid === id);
    const stack = mine.reduce((s, b) => s + b.t, 0) + BAND_GAP * (mine.length - 1);
    const h = Math.max(lines(name(id)).length > 1 ? 44 : 34, stack + 8);
    const centre = mine.reduce((s, b) => s + b.yr, 0) / mine.length;
    const top = Math.max(floor, centre - h / 2);
    let off = top + (h - stack) / 2;
    for (const b of mine) {
      b.ym = off + b.t / 2;
      off += b.t + BAND_GAP;
    }
    mids.push({ id, y: top, h, up: mine.filter((b) => b.g.up).length, down: mine.filter((b) => !b.g.up).length });
    floor = top + h + 14;
  }

  // Left column: one box per source, bands stacked in the same order.
  const srcOrder: string[] = [];
  for (const b of bands) if (!srcOrder.includes(b.src)) srcOrder.push(b.src);
  const lefts: Box[] = [];
  const stacks = srcOrder.map((id) => {
    const mine = bands.filter((b) => b.src === id);
    return { id, mine, stack: mine.reduce((s, b) => s + b.t, 0) + BAND_GAP * (mine.length - 1) };
  });
  const totalLeft = stacks.reduce((s, x) => s + Math.max(x.stack + 12, 52), 0) + 18 * (stacks.length - 1);
  let ly = Math.max(24, (height - totalLeft) / 2);
  for (const s of stacks) {
    const h = Math.max(s.stack + 12, 52);
    let off = ly + (h - s.stack) / 2;
    for (const b of s.mine) {
      b.yl = off + b.t / 2;
      off += b.t + BAND_GAP;
    }
    lefts.push({ id: s.id, y: ly, h, up: 0, down: 0 });
    ly += h + 18;
  }

  return { bands, rows, mids, lefts, height: Math.max(height, ly + 8) };
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const xm = (x1 + x2) / 2;
  return `M${x1},${y1} C${xm},${y1} ${xm},${y2} ${x2},${y2}`;
}

export function FlowView({ a, L, downs, ups, max, selected, onSelect }: ViewProps) {
  const [hover, setHover] = useState<string | null>(null);
  const groups = [...downs, ...ups].sort((p, q) => q.score - p.score).slice(0, 8);

  if (!groups.length)
    return (
      <div className="rounded-2xl bg-panel p-6 text-muted">
        No stocks are linked to this ripple yet, so there is nothing to flow into.
      </div>
    );

  const { bands, rows, mids, lefts, height } = layout(groups, Math.max(max, ...groups.map((g) => g.score)), L.name);
  const sel = selected ? keyOf(selected.path, selected.up) : null;
  const active = hover ?? sel;
  const pick = (g: Group) => onSelect({ path: g.path, tickers: g.tickers.map((t) => t.ticker), up: g.up });
  const newsUp = a.direction > 0;

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[22px] font-bold">Where the push flows</h3>
        <p className="text-[14px] text-muted">Thicker band means a stronger push. Click a band to see why.</p>
      </div>
      <div className="flex text-[13px] text-muted">
        <span className="w-[16%]">The news</span>
        <span className="w-[42%] text-center">What it moves first</span>
        <span className="flex-1 text-right sm:text-left sm:pl-[6%]">Stocks in the way</span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="block w-full min-w-[640px]"
          role="img"
          aria-label="How the news flows through the economy into groups of stocks"
        >
          {bands.map((b) => {
            const k = keyOf(b.g.path, b.g.up);
            const on = active === k;
            const opacity = active ? (on ? 0.78 : 0.1) : 0.32;
            const color = b.g.up ? "var(--up)" : "var(--down)";
            const xr = RIGHT.x;
            const paths = b.mid
              ? [curve(LEFT.x + LEFT.w, b.yl, MID.x, b.ym), curve(MID.x + MID.w, b.ym, xr, b.yr)]
              : [curve(LEFT.x + LEFT.w, b.yl, xr, b.yr)];
            return (
              <g
                key={k}
                role="button"
                tabIndex={0}
                aria-label={`${b.g.name}: ${b.g.up ? "rises" : "falls"}, ${b.g.strength.toLowerCase()}`}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setHover(k)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(k)}
                onBlur={() => setHover(null)}
                onClick={() => pick(b.g)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pick(b.g)}
              >
                {paths.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeOpacity={opacity}
                    strokeWidth={b.t}
                    style={{ transition: "stroke-opacity 250ms ease" }}
                  />
                ))}
              </g>
            );
          })}

          {lefts.map((n) => (
            <g key={n.id}>
              <rect x={LEFT.x} y={n.y} width={LEFT.w} height={n.h} rx={10} fill="var(--signal)" />
              {lines(`${L.name(n.id)} ${newsUp ? "up" : "down"}`, 16).map((t, i, all) => (
                <text
                  key={i}
                  x={LEFT.x + LEFT.w / 2}
                  y={n.y + n.h / 2 + (i - (all.length - 1) / 2) * 17 + 5}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={700}
                  fill="#1b2129"
                >
                  {t}
                </text>
              ))}
            </g>
          ))}

          {mids.map((n) => {
            const fill = n.up && n.down ? "var(--panel-2)" : n.up ? "var(--up-fill)" : "var(--down-fill)";
            return (
              <g key={n.id}>
                <rect x={MID.x} y={n.y} width={MID.w} height={n.h} rx={10} fill={fill} />
                {lines(L.name(n.id)).map((t, i, all) => (
                  <text
                    key={i}
                    x={MID.x + MID.w / 2}
                    y={n.y + n.h / 2 + (i - (all.length - 1) / 2) * 16 + 5}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={700}
                    fill="#ffffff"
                  >
                    {t}
                  </text>
                ))}
              </g>
            );
          })}

          {bands.map((b, i) => {
            const k = keyOf(b.g.path, b.g.up);
            const row = rows[i];
            const dim = active && active !== k;
            const shown = b.g.tickers.slice(0, 4).map((t) => t.ticker);
            const extra = b.g.tickers.length - shown.length;
            const sameAsMid = b.mid && L.name(b.mid) === b.g.name;
            const detail = `${b.g.up ? "Rises" : "Falls"}, ${b.g.strength.toLowerCase()}, ${when(b.g.months)}`;
            return (
              <g
                key={k}
                className="cursor-pointer"
                opacity={dim ? 0.45 : 1}
                onMouseEnter={() => setHover(k)}
                onMouseLeave={() => setHover(null)}
                onClick={() => pick(b.g)}
                style={{ transition: "opacity 250ms ease" }}
              >
                <rect
                  x={RIGHT.x}
                  y={b.yr - b.t / 2}
                  width={RIGHT.w}
                  height={b.t}
                  rx={3}
                  fill={b.g.up ? "var(--up-fill)" : "var(--down-fill)"}
                />
                <text x={RIGHT.x + 22} y={row.y + row.h / 2 - 4} fontSize={16} fontWeight={700} fill={b.g.up ? "var(--up)" : "var(--down)"}>
                  {shown.join("  ")}
                  {extra > 0 ? `  +${extra}` : ""}
                </text>
                <text x={RIGHT.x + 22} y={row.y + row.h / 2 + 15} fontSize={13} fill="var(--muted)">
                  {sameAsMid ? detail : `${b.g.name.length > 22 ? b.g.name.slice(0, 21) + "…" : b.g.name}: ${detail.toLowerCase()}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
