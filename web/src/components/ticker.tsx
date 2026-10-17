"use client";

import Link from "next/link";
import { company } from "@/lib/model";

// a ticker chip that opens the stock's profile; stops the click reaching a card it sits on
export function Ticker({ t, dir, className = "" }: { t: string; dir?: number; className?: string }) {
  const tone =
    dir === undefined
      ? "border-line bg-panel-2 text-ink"
      : dir > 0
        ? "border-up/40 bg-up-soft text-up"
        : "border-down/40 bg-down-soft text-down";
  return (
    <Link
      href={`/stock/${encodeURIComponent(t)}`}
      title={`${company(t)}: open profile`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[13px] font-bold transition hover:-translate-y-px hover:border-gold ${tone} ${className}`}
    >
      {dir !== undefined && (dir > 0 ? "▲" : "▼")} {t}
    </Link>
  );
}
