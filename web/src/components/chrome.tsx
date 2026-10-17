"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLiveFeed } from "@/lib/live";

const NAV = [
  { href: "/app", label: "Trace a headline" },
  { href: "/live", label: "Live tape" },
  { href: "/casebook", label: "Casebook" },
];

// header + amber ticker tape shared by every page of the product
export function SiteHeader({ active }: { active?: string }) {
  return (
    <>
      <header className="relative z-20 mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 border-[1.5px] border-gold bg-ground px-3 py-1.5">
          <Logo />
          <span className="font-display text-[22px] font-extrabold tracking-tight">ripple</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active === n.href ? "page" : undefined}
              className={`border-[1.5px] px-3 py-1.5 ${
                active === n.href ? "border-gold bg-gold text-ground" : "border-line bg-ground hover:border-gold"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <Tape />
    </>
  );
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="var(--signal)" strokeWidth="2" />
      <circle cx="10" cy="10" r="3.5" fill="var(--signal)" />
    </svg>
  );
}

// amber ticker tape of the robot's latest calls
function Tape() {
  const [calls, setCalls] = useState<[string, number][]>([]);
  useEffect(() => {
    getLiveFeed().then(
      (f) => setCalls(f.items.slice(0, 10).flatMap((i) => i.top.slice(0, 2).map((t) => [t.ticker, t.direction] as [string, number]))),
      () => {},
    );
  }, []);
  if (!calls.length) return <div className="h-[46px]" />;
  const one = calls.map(([t, d], i) => (
    <span key={i} className="flex items-center gap-2">
      {t} <span className={d > 0 ? "text-[#075c34]" : "text-[#b3180a]"}>{d > 0 ? "▲" : "▼"}</span>
      <span className="opacity-40">|</span>
    </span>
  ));
  return (
    <Link href="/live" aria-label="The robot's latest calls" className="relative z-10 block -rotate-[0.6deg] overflow-hidden border-y-2 border-ground bg-signal text-ground">
      <div className="tape-run flex w-max py-2.5 font-mono text-[15px] font-bold whitespace-nowrap">
        {[0, 1].map((k) => (
          <span key={k} className="flex gap-7 pr-7">
            {one}
          </span>
        ))}
      </div>
    </Link>
  );
}

