"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLiveFeed } from "@/lib/live";
import { TICKER_NAMES } from "@/lib/tickers";

const NAV = [
  { href: "/app", label: "Trace a headline" },
  { href: "/live", label: "Live tape" },
  { href: "/casebook", label: "Casebook" },
];

// header + amber ticker tape shared by every page of the product
export function SiteHeader({ active }: { active?: string }) {
  return (
    <>
      <header className="relative z-40 mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 border-[1.5px] border-gold bg-ground px-3 py-1.5">
          <Logo />
          <span className="font-display text-[22px] font-extrabold tracking-tight">ripple</span>
        </Link>
        <StockSearch />
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


const ALL = Object.entries(TICKER_NAMES);

// type a ticker or company name, jump to its profile
function StockSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const t = q.trim().toLowerCase();
  const hits = t
    ? ALL.filter(([k, n]) => k.toLowerCase().startsWith(t) || n.toLowerCase().includes(t))
        .sort((a, b) => Number(b[0].toLowerCase() === t) - Number(a[0].toLowerCase() === t) || Number(b[0].toLowerCase().startsWith(t)) - Number(a[0].toLowerCase().startsWith(t)))
        .slice(0, 7)
    : [];
  const go = (k: string) => {
    setQ("");
    router.push(`/stock/${encodeURIComponent(k)}`);
  };
  return (
    <div className="relative order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-[320px]">
      <label htmlFor="stock-search" className="sr-only">
        Find a stock
      </label>
      <input
        id="stock-search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setHi(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setHi((h) => Math.min(h + 1, hits.length - 1));
          else if (e.key === "ArrowUp") setHi((h) => Math.max(h - 1, 0));
          else if (e.key === "Enter" && hits[hi]) go(hits[hi][0]);
          else if (e.key === "Escape") setQ("");
          else return;
          e.preventDefault();
        }}
        placeholder="Find a stock: TOL, Exxon, Nvidia…"
        autoComplete="off"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls="stock-hits"
        className="h-10 w-full border-[1.5px] border-line bg-panel px-3 text-[15px] outline-none placeholder:text-muted focus:border-gold"
      />
      {hits.length > 0 && (
        <ul id="stock-hits" role="listbox" className="absolute inset-x-0 top-full z-40 mt-1 border-[1.5px] border-gold bg-ground shadow-[6px_6px_0_rgba(0,0,0,.5)]">
          {hits.map(([k, n], i) => (
            <li key={k} role="option" aria-selected={i === hi}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(k);
                }}
                onMouseEnter={() => setHi(i)}
                className={`flex w-full items-baseline gap-3 px-3 py-2 text-left ${i === hi ? "bg-panel-2" : ""}`}
              >
                <b className="min-w-16 shrink-0 font-mono text-[14px] text-signal">{k}</b>
                <span className="truncate text-[14px] text-muted">{n}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
