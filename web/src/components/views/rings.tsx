"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DriverImpact } from "@/lib/api";
import { strength, when, type ViewProps } from "@/lib/model";

// Drawing box; it is scaled down to fit narrower containers, and below COMPACT it becomes rows of pills.
const W = 920;
const H = 760;
const CX = W / 2;
const CY = H / 2;
const COMPACT = 540;
const CAPS = [0, 6, 8, 8, 6];
const RING_NAMES = ["", "Direct", "Knock-on", "Further out", "Far out"];
const PILL_H = 34;
const CENTRE = 140;
const MAX_MONTHS = 36;

type Pill = {
  d: DriverImpact;
  label: string;
  ring: number;
  bold: boolean;
  w: number;
  rx: number;
  ry: number;
  angle: number;
  x: number;
  y: number;
};
type Box = { x: number; y: number; w: number; h: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
const overlap = (a: Box, b: Box, gap = 6) =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w + gap * 2 && Math.abs(a.y - b.y) * 2 < a.h + b.h + gap * 2;

function radii(ring: number, count: number) {
  const t = count > 1 ? (ring - 1) / (count - 1) : 0.15;
  return { rx: 205 + (400 - 205) * t, ry: 150 + (335 - 150) * t };
}

function place(p: Pill) {
  p.x = Math.min(W - p.w / 2 - 4, Math.max(p.w / 2 + 4, CX + p.rx * Math.cos(rad(p.angle))));
  p.y = Math.min(H - PILL_H / 2 - 4, Math.max(PILL_H / 2 + 4, CY + p.ry * Math.sin(rad(p.angle))));
}

// Even spacing per ring, staggered by half a slot on alternate rings, then nudged apart until nothing overlaps.
function layout(rings: DriverImpact[][], name: (id: string) => string, max: number) {
  const count = rings.length - 1;
  const pills: Pill[] = [];
  const labels: Box[] = [];
  for (let ring = 1; ring <= count; ring++) {
    const { rx, ry } = radii(ring, count);
    labels.push({ x: CX, y: CY - ry, w: RING_NAMES[ring].length * 7 + 16, h: 20 });
    const slot = 360 / Math.max(rings[ring].length, 1);
    rings[ring].forEach((d, i) => {
      const label = name(d.id);
      const bold = strength(d.impact, max) === "Strong";
      const p: Pill = {
        d,
        label,
        ring,
        bold,
        w: label.length * (bold ? 7.9 : 7.4) + 38,
        rx,
        ry,
        angle: -90 + slot / 2 + (ring % 2 === 0 ? slot / 2 : 0) + i * slot,
        x: 0,
        y: 0,
      };
      place(p);
      pills.push(p);
    });
  }
  const centre: Box = { x: CX, y: CY, w: CENTRE + 16, h: CENTRE + 16 };
  const box = (p: Pill): Box => ({ x: p.x, y: p.y, w: p.w, h: PILL_H });
  const nudge = (p: Pill, from: { x: number; y: number }) => {
    const mine = Math.atan2(p.y - CY, p.x - CX);
    const theirs = Math.atan2(from.y - CY, from.x - CX);
    const diff = Math.atan2(Math.sin(mine - theirs), Math.cos(mine - theirs));
    p.angle += diff >= 0 ? 3 : -3;
    place(p);
  };
  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let i = 0; i < pills.length; i++) {
      for (const fixed of [centre, ...labels])
        if (overlap(box(pills[i]), fixed)) {
          nudge(pills[i], fixed);
          moved = true;
        }
      for (let j = i + 1; j < pills.length; j++)
        if (overlap(box(pills[i]), box(pills[j]))) {
          const [mover, other] = pills[j].ring >= pills[i].ring ? [pills[j], pills[i]] : [pills[i], pills[j]];
          nudge(mover, other);
          moved = true;
        }
    }
    if (!moved) break;
  }
  return { pills, count };
}

function span(m: number) {
  if (m <= 0) return "the day it breaks";
  if (m < 12) return `${m} month${m === 1 ? "" : "s"}`;
  const y = m / 12;
  return `${Number.isInteger(y) ? y : y.toFixed(1)} year${y === 1 ? "" : "s"}`;
}

export function RingsView({ a, L, selected, onSelect }: ViewProps) {
  const holder = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [width, setWidth] = useState(W);
  const [month, setMonth] = useState<number | null>(null); // null = everything shown
  const [playing, setPlaying] = useState(false);
  const [shownFor, setShownFor] = useState(a);

  if (shownFor !== a) {
    setShownFor(a);
    setMonth(null);
    setPlaying(false);
  }

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => clearInterval(timer.current), [a]);

  const { rings, total, shown, maxImpact } = useMemo(() => {
    const effects = a.drivers.filter((d) => d.hops >= 1);
    const maxImpact = Math.max(0, ...effects.map((d) => d.impact));
    const rings: DriverImpact[][] = [[]];
    for (let ring = 1; ring <= 4; ring++) {
      const here = effects.filter((d) => d.hops === ring).sort((p, q) => q.impact - p.impact).slice(0, CAPS[ring]);
      if (!here.length) break;
      rings.push(here);
    }
    return { rings, total: effects.length, shown: rings.flat().length, maxImpact };
  }, [a]);

  const { pills, count } = useMemo(() => layout(rings, L.name, maxImpact), [rings, L, maxImpact]);

  const maxMonth = Math.max(6, Math.min(MAX_MONTHS, Math.max(0, ...rings.flat().map((d) => d.lag_months))));
  const now = month ?? maxMonth;
  const compact = width < COMPACT;
  const scale = Math.min(1, width / W);
  const onPath = new Set(selected?.path ?? []);
  const centreOn = a.sources.some((s) => onPath.has(s));

  const names = a.sources.map(L.name);
  const news = `${names.slice(0, 2).join(" + ")}${names.length > 2 ? ` +${names.length - 2}` : ""} ${a.direction > 0 ? "up" : "down"}`;

  const ticks = useMemo(() => {
    const every = maxMonth <= 12 ? 3 : maxMonth <= 24 ? 6 : 12;
    const out: number[] = [];
    for (let m = 0; m <= maxMonth; m += every) out.push(m);
    if (out[out.length - 1] !== maxMonth) {
      if (maxMonth - out[out.length - 1] < every / 2) out.pop();
      out.push(maxMonth);
    }
    return out;
  }, [maxMonth]);

  function stop() {
    clearInterval(timer.current);
    setPlaying(false);
  }

  function play() {
    if (playing) return stop();
    clearInterval(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMonth(null);
      return;
    }
    let m = 0;
    setMonth(0);
    setPlaying(true);
    timer.current = setInterval(() => {
      m += 1;
      if (m >= maxMonth) {
        clearInterval(timer.current);
        setMonth(null);
        setPlaying(false);
      } else setMonth(m);
    }, Math.max(70, 3600 / maxMonth));
  }

  const pillClass = (d: DriverImpact, bold: boolean) => {
    const arrived = d.lag_months <= now;
    const tone = !arrived
      ? "border-line bg-panel text-muted opacity-60"
      : d.direction > 0
        ? "border-up/80 bg-up-soft text-ink"
        : "border-down/80 bg-down-soft text-ink";
    const ring = onPath.has(d.id) ? "ring-2 ring-signal ring-offset-2 ring-offset-panel" : "";
    return `whitespace-nowrap rounded-full border-[1.5px] px-3 text-[14px] leading-none transition-[background-color,border-color,color,opacity] duration-300 hover:border-ink focus-visible:outline-2 ${bold ? "font-bold" : ""} ${tone} ${ring}`;
  };

  const pillButton = (p: { d: DriverImpact; label: string; bold: boolean }, style?: React.CSSProperties) => {
    const up = p.d.direction > 0;
    return (
      <button
        key={p.d.id}
        type="button"
        onClick={() => onSelect({ path: p.d.path, tickers: [], up })}
        aria-label={`${p.label}, goes ${up ? "up" : "down"}, ${when(p.d.lag_months)}`}
        aria-pressed={onPath.has(p.d.id)}
        className={pillClass(p.d, p.bold)}
        style={{ height: PILL_H, ...style }}
      >
        <span aria-hidden className={up ? "text-up" : "text-down"}>
          {up ? "↑" : "↓"}
        </span>{" "}
        {p.label}
      </button>
    );
  };

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-line bg-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[560px]">
          <h3 className="font-display text-[22px] font-bold leading-tight text-ink">How the shock spreads</h3>
          <p className="mt-1 text-[15px] text-muted">
            Each ring is one more step away from the news. Press play to watch effects arrive over time.
          </p>
        </div>
        <div className="flex gap-4 text-[14px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-up" aria-hidden />
            Goes up
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-down" aria-hidden />
            Goes down
          </span>
        </div>
      </div>

      <div ref={holder} className="w-full min-w-0 overflow-hidden">
        {compact ? (
          <div className="flex flex-col gap-4">
            <div
              className={`self-start rounded-2xl bg-signal px-4 py-3 text-[#1b2129] ${centreOn ? "ring-2 ring-ink ring-offset-2 ring-offset-panel" : ""}`}
            >
              <div className="text-[13px] font-bold">The news</div>
              <div className="font-display text-[18px] font-extrabold leading-tight">{news}</div>
            </div>
            {rings.slice(1).map((ring, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="text-[13px] text-muted">{RING_NAMES[i + 1]}</div>
                <div className="flex flex-wrap gap-2">
                  {ring.map((d) =>
                    pillButton({ d, label: L.name(d.id), bold: strength(d.impact, maxImpact) === "Strong" }),
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden" style={{ height: H * scale, width: W * scale, maxWidth: "100%", margin: "0 auto" }}>
            <div className="relative origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
              <svg width={W} height={H} className="absolute inset-0" aria-hidden>
                {Array.from({ length: count }, (_, i) => {
                  const { rx, ry } = radii(i + 1, count);
                  return (
                    <ellipse
                      key={i}
                      cx={CX}
                      cy={CY}
                      rx={rx}
                      ry={ry}
                      fill="none"
                      stroke="var(--line)"
                      strokeDasharray="5 6"
                      strokeWidth={1.2}
                    />
                  );
                })}
              </svg>
              {Array.from({ length: count }, (_, i) => {
                const { ry } = radii(i + 1, count);
                return (
                  <span
                    key={i}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md bg-panel px-1.5 text-[12px] text-muted"
                    style={{ left: CX, top: CY - ry }}
                  >
                    {RING_NAMES[i + 1]}
                  </span>
                );
              })}
              <div
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-signal p-3 text-center text-[#1b2129] shadow-[0_0_0_12px_var(--signal-soft),0_0_0_26px_rgba(255,209,102,0.07)] ${centreOn ? "ring-4 ring-ink" : ""}`}
                style={{ left: CX, top: CY, width: CENTRE, height: CENTRE }}
              >
                <span className="text-[12px] font-bold">The news</span>
                <span className="font-display text-[16px] font-extrabold leading-tight">{news}</span>
              </div>
              {pills.map((p) =>
                pillButton(p, { position: "absolute", left: p.x, top: p.y, transform: "translate(-50%, -50%)" }),
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={play}
          aria-label={playing ? "Pause" : "Play the ripple over time"}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-ground hover:bg-white"
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="ripple-time" className="sr-only">
            Time since the news
          </label>
          <input
            id="ripple-time"
            type="range"
            min={0}
            max={maxMonth}
            value={now}
            onChange={(e) => {
              stop();
              const v = Number(e.target.value);
              setMonth(v >= maxMonth ? null : v);
            }}
            className="w-full accent-[var(--signal)]"
          />
          <div className="relative h-4 text-[12px] text-muted" aria-hidden>
            {ticks.map((m) => (
              <span
                key={m}
                className="absolute whitespace-nowrap"
                style={{
                  left: `${(m / maxMonth) * 100}%`,
                  transform: m === 0 ? "none" : m === maxMonth ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                {m === 0 ? "Now" : span(m)}
              </span>
            ))}
          </div>
        </div>
        <div className="w-[96px] shrink-0 text-right font-note text-[22px] leading-tight text-signal" aria-live="polite">
          {now === 0 ? "Day one" : `${span(now)} in`}
        </div>
      </div>

      <p className="text-[14px] text-muted">
        {shown < total
          ? `Showing the strongest ${shown} of ${total} effects. Click any one to see why it moves.`
          : `Showing all ${total} effects. Click any one to see why it moves.`}
      </p>
    </section>
  );
}
