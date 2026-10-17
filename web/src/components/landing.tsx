"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import Link from "next/link";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animate, guilloche } from "@/lib/guilloche";
import { getLiveFeed, type LiveFeed } from "@/lib/live";

const EXAMPLES = [
  "Fed signals interest rates will stay higher for longer",
  "OPEC+ agrees deeper oil production cuts through next year",
  "Microsoft, Google and Meta raise 2027 AI capex guidance by $120B",
  "Pentagon requests largest defense budget increase in a decade",
];
const TAPE: [string, number][] = [
  ["TOL", -1], ["LEN", -1], ["IBKR", 1], ["XOM", 1], ["DAL", -1], ["NVDA", 1],
  ["FCX", -1], ["LMT", 1], ["UUP", 1], ["KRE", -1], ["VST", 1], ["UAL", -1],
];
const WORDS = ["Most people stop at the headline.", "Ripple follows it.", "Step by step,", "to the stocks it reaches."];

function rng(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// an illustrative chart: drifts up, then the news lands and it slides
function Candles() {
  const r = rng(7), n = 26, W = 400, H = 170;
  let p = 60;
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const drift = i < 9 ? 0.6 : -1.8;
    const o = p, c = p + drift * 2 + (r() - 0.5) * 9;
    pts.push([o, c, Math.max(o, c) + r() * 5, Math.min(o, c) - r() * 5]);
    p = c;
  }
  const all = pts.flat(), mn = Math.min(...all), mx = Math.max(...all);
  const y = (v: number) => 10 + ((mx - v) / (mx - mn)) * (H - 20), bw = W / n;
  return (
    <svg id="candles" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {[1, 2, 3].map((g) => <line key={g} x1="0" x2={W} y1={(g * H) / 4} y2={(g * H) / 4} stroke="#10141f" strokeOpacity=".12" />)}
      <line x1={9 * bw} x2={9 * bw} y1="0" y2={H} stroke="#ffab1f" strokeWidth="2" strokeDasharray="4 4" />
      {pts.map(([o, c, hi, lo], i) => {
        const x = i * bw + bw / 2, col = c >= o ? "#0d6b45" : "#e8412c";
        return (
          <g key={i} className="cd">
            <line x1={x} x2={x} y1={y(hi)} y2={y(lo)} stroke={col} strokeWidth="1.5" />
            <rect x={x - bw * 0.32} width={bw * 0.64} y={y(Math.max(o, c))} height={Math.max(2, Math.abs(y(o) - y(c)))} fill={col} />
          </g>
        );
      })}
    </svg>
  );
}

function Spark({ dir, seed }: { dir: number; seed: number }) {
  const r = rng(seed), n = 24;
  let v = 0;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    v += (i > 6 ? dir * 1.1 : 0) + (r() - 0.5) * 2.2;
    pts.push(v);
  }
  const mn = Math.min(...pts), mx = Math.max(...pts);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${((i / (n - 1)) * 116 + 2).toFixed(1)},${(4 + ((mx - p) / (mx - mn || 1)) * 36).toFixed(1)}`).join("");
  return (
    <svg viewBox="0 0 120 44" aria-hidden>
      <path d={d} fill="none" stroke={dir > 0 ? "#0d6b45" : "#e8412c"} strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

function Seal() {
  const rings = [0, 1, 2].map((ring) => {
    const R = 62 + ring * 7, k = 20 + ring * 4;
    let d = "";
    for (let i = 0; i <= 240; i++) {
      const a = (i / 240) * Math.PI * 2, rr = R + Math.sin(a * k) * 4;
      d += `${i ? "L" : "M"}${(100 + Math.cos(a) * rr).toFixed(1)},${(100 + Math.sin(a) * rr).toFixed(1)}`;
    }
    return <path key={ring} d={d} fill="none" stroke="#d8b25a" strokeOpacity={0.9 - ring * 0.25} strokeWidth=".9" />;
  });
  return (
    <svg className="seal" viewBox="0 0 200 200" id="seal">
      <defs>
        <path id="sealPath" d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
      </defs>
      <circle cx="100" cy="100" r="88" fill="#0d6b45" />
      {rings}
      <circle cx="100" cy="100" r="50" fill="#10141f" stroke="#d8b25a" strokeWidth="2" />
      <text fill="#d8b25a" fontSize="12.5" fontWeight="700" letterSpacing="2.4" style={{ fontFamily: "var(--font-code)" }}>
        <textPath href="#sealPath">GRADED AGAINST REAL PRICES ✦ GRADED AGAINST REAL PRICES ✦</textPath>
      </text>
      <text x="100" y="98" textAnchor="middle" fill="#f6efe2" fontWeight="800" fontSize="30" style={{ fontFamily: "var(--font-display)" }}>
        7/10
      </text>
      <text x="100" y="118" textAnchor="middle" fill="#d8b25a" fontWeight="700" fontSize="11" style={{ fontFamily: "var(--font-body)" }}>
        past events right
      </text>
    </svg>
  );
}

function Tape({ items, id }: { items: [string, number][]; id: string }) {
  const one = items.flatMap(([k, d], i) => [
    <span key={`${i}a`}>
      {k} <span className={d > 0 ? "u" : "d"}>{d > 0 ? "▲" : "▼"}</span>
    </span>,
    <span key={`${i}b`} className="sep">|</span>,
  ]);
  return (
    <div className="run" id={id}>
      {[0, 1, 2, 3].map((k) => <span key={k} style={{ display: "contents" }}>{one}</span>)}
    </div>
  );
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [splash, setSplash] = useState(true);
  const [feed, setFeed] = useState<LiveFeed | null>(null);
  const [feedFailed, setFeedFailed] = useState(false);
  const examples = useRef(EXAMPLES);

  useEffect(() => {
    getLiveFeed().then((f) => {
      setFeed(f);
      if (f.items.length) examples.current = f.items.map((i) => i.headline).slice(0, 6).concat(EXAMPLES.slice(0, 2));
    }, () => setFeedFailed(true));
  }, []);

  // the whole page choreography
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const $ = (s: string) => root.current!.querySelector(s) as HTMLElement;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let typing = true;

    const splashF = guilloche($("#splashG") as unknown as HTMLCanvasElement, { alpha: 0.3, spin: 0 });
    const heroF = guilloche($("#heroG") as unknown as HTMLCanvasElement, { cx: 0.74, cy: 0.52, follow: true, alpha: 0.42 });
    const ctaF = guilloche($("#ctaG") as unknown as HTMLCanvasElement, { alpha: 0.35, gap: 18, petals: 24, inks: ["216,178,90", "246,239,226"] });

    // particles along the story chain
    const flow = $("#flow") as unknown as HTMLCanvasElement, fctx = flow.getContext("2d")!;
    let fw = 0, fh = 0, flowProgress = 0;
    const parts = Array.from({ length: 300 }, () => ({ s: Math.random(), v: 0.06 + Math.random() * 0.1, j: (Math.random() - 0.5) * 40, c: Math.random() }));
    const fsize = () => {
      const d = Math.min(2, devicePixelRatio || 1);
      fw = flow.clientWidth;
      fh = flow.clientHeight;
      flow.width = fw * d;
      flow.height = fh * d;
      fctx.setTransform(d, 0, 0, d, 0, 0);
    };
    fsize();
    addEventListener("resize", fsize);
    const anchors = () => {
      const pr = $("#paper").getBoundingClientRect(), sr = flow.getBoundingClientRect();
      const nodes = [...root.current!.querySelectorAll("#chain .node .dot")].map((d) => {
        const r = d.getBoundingClientRect();
        return [r.left + r.width / 2 - sr.left, r.top + r.height / 2 - sr.top];
      });
      return [[pr.right - sr.left - 30, pr.top + pr.height / 2 - sr.top], ...nodes];
    };
    const flowFrame = (dt: number) => {
      fctx.clearRect(0, 0, fw, fh);
      if (flowProgress <= 0) return;
      const A = anchors(), reach = Math.min(A.length - 1, flowProgress * (A.length - 1));
      for (const p of parts) {
        p.s += p.v * dt * 1.4;
        if (p.s > reach) p.s = Math.random() * 0.2;
        const k = Math.min(A.length - 2, Math.floor(p.s)), f = p.s - k;
        const [x0, y0] = A[k], [x1, y1] = A[k + 1];
        const bend = Math.sin(f * Math.PI) * p.j * (k === 0 ? 3 : 1);
        const x = x0 + (x1 - x0) * f + bend * 0.3, y = y0 + (y1 - y0) * f + Math.sin(f * 9 + p.j) * 4 + bend;
        fctx.fillStyle = p.c < 0.45 ? "rgba(13,107,69,.85)" : p.c < 0.8 ? "rgba(232,65,44,.8)" : "rgba(16,20,31,.8)";
        fctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
      }
    };

    const fields = [
      { f: splashF, el: $("#splashG") },
      { f: heroF, el: $("#heroG") },
      { f: ctaF, el: $("#ctaG") },
      { f: { frame: flowFrame }, el: flow as Element },
    ];
    const stopLoop = animate(fields);
    if (reduce) fields.forEach(({ f }) => f.frame(0));

    const ctx = gsap.context(() => {
      if (!reduce) gsap.to("#tickerRun", { xPercent: -25, duration: 30, ease: "none", repeat: -1 });

      function typeLoop() {
        const q = $("#q") as HTMLInputElement;
        let i = 0;
        (function next() {
          if (!typing) return;
          if (q.value || document.activeElement === q) {
            q.placeholder = "Paste any headline";
            timers.push(setTimeout(next, 3000));
            return;
          }
          const list = examples.current, text = list[i++ % list.length], st = { n: 0 };
          const show = () => (q.placeholder = text.slice(0, st.n | 0) + "▍");
          gsap.to(st, {
            n: text.length, duration: text.length * 0.035, ease: "none", onUpdate: show,
            onComplete: () => gsap.delayedCall(2.2, () => gsap.to(st, { n: 0, duration: 0.5, ease: "none", onUpdate: show, onComplete: next })),
          });
        })();
      }

      function heroIn() {
        heroF.hit(1.3);
        gsap.timeline()
          .from("#h1 .w b", { yPercent: 115, duration: 0.9, ease: "expo.out", stagger: 0.05 })
          .from(".kicker", { y: 16, opacity: 0, duration: 0.6 }, "<.1")
          .from("#clip", { y: 60, rotate: -14, scale: 0.7, opacity: 0, duration: 0.8, ease: "back.out(1.8)" }, "-=.5")
          .from("#collage > *", { y: 120, rotate: (i: number) => [-14, 12, -10, 20][i], opacity: 0, duration: 0.9, ease: "back.out(1.4)", stagger: 0.1 }, "-=.6")
          .from("#candles .cd", { scaleY: 0, transformOrigin: "50% 50%", opacity: 0, duration: 0.3, stagger: 0.03 }, "-=.6")
          .from("#lede, #ask, #hint", { y: 24, opacity: 0, duration: 0.7, stagger: 0.08, ease: "power3.out" }, "-=1.2")
          .add(typeLoop, "-=.2");
        if (!reduce) gsap.to("#seal", { rotate: "+=360", duration: 60, ease: "none", repeat: -1 });
      }

      // splash: once per visit
      let seen = false;
      try {
        seen = !!sessionStorage.getItem("ripple-splash");
        sessionStorage.setItem("ripple-splash", "1");
      } catch {}
      const el = $("#splash");
      let done = false;
      const endSplash = () => {
        if (done) return;
        done = true;
        gsap.to(el, { clipPath: "circle(0% at 50% 50%)", duration: 0.9, ease: "expo.inOut", onComplete: () => setSplash(false) });
        gsap.delayedCall(0.35, heroIn);
      };
      if (reduce || seen) {
        done = true;
        setSplash(false);
        heroIn();
      } else {
        el.style.clipPath = "circle(150% at 50% 50%)";
        gsap.timeline({ onComplete: endSplash })
          .to("#drop", { top: "calc(50% - 9px)", duration: 0.7, ease: "power3.in" })
          .add(() => {
            splashF.hit(1.5);
            timers.push(setTimeout(() => splashF.hit(0.9), 170), setTimeout(() => splashF.hit(0.5), 340));
          })
          .to("#drop", { scale: 0, duration: 0.2 })
          .to("#splashWord span", { y: 0, opacity: 1, duration: 0.8, ease: "expo.out", stagger: 0.05 }, "-=.1")
          .to("#splashRule", { scaleX: 1, duration: 0.7, ease: "expo.inOut" }, "-=.5")
          .to("#splashSub", { opacity: 1, duration: 0.6 }, "-=.3")
          .to("#splashTick", { opacity: 1, duration: 0.4 }, "<")
          .add(() => { gsap.to("#splashRun", { xPercent: -25, duration: 14, ease: "none" }); }, "<")
          .to({}, { duration: 1.1 });
        el.addEventListener("click", endSplash);
        addEventListener("keydown", endSplash, { once: true });
      }

      // story, pinned while you scroll
      const storyText = $("#storytext");
      gsap.timeline({
        scrollTrigger: {
          trigger: "#story", start: "top top", end: "+=2600", pin: true, scrub: 0.6,
          onUpdate: (s) => {
            flowProgress = Math.min(1, s.progress * 1.25);
            const w = WORDS[Math.min(3, Math.floor(s.progress * 4))];
            if (storyText.textContent !== w) storyText.textContent = w;
          },
        },
      })
        .from("#paper", { y: 80, rotate: -9, opacity: 0, duration: 0.6 })
        .to("#chain .node", { opacity: 1, x: 0, stagger: 0.5, duration: 0.5, ease: "back.out(1.4)" })
        .fromTo("#twist", { opacity: 0, y: 30, rotate: 4 }, { opacity: 1, y: 0, rotate: -1.2, duration: 0.5 });

      // proof
      ScrollTrigger.create({
        trigger: "#bt", start: "top 80%", once: true,
        onEnter: () => {
          gsap.to("#bt .fl", { width: (_: number, e: HTMLElement) => e.dataset.w + "%", duration: 1.2, ease: "power3.out", stagger: 0.2 });
          gsap.to("#events i", { background: (i: number) => (i < 7 ? "#0d6b45" : "#e8412c"), stagger: 0.07, delay: 0.5 });
        },
      });
      gsap.from("#bt", { scrollTrigger: { trigger: "#bt", start: "top 85%" }, y: 80, rotate: -6, opacity: 0, duration: 0.8, ease: "back.out(1.4)" });
      root.current!.querySelectorAll<HTMLElement>(".stat .n").forEach((n) => {
        const to = +n.dataset.to!, o = { v: 0 };
        ScrollTrigger.create({
          trigger: n, start: "top 88%", once: true,
          onEnter: () => gsap.to(o, { v: to, duration: 1.4, ease: "power2.out", onUpdate: () => { n.textContent = String(Math.round(o.v)); } }),
        });
      });
      gsap.from("#cta .note", { scrollTrigger: { trigger: "#cta", start: "top 70%" }, scale: 0.9, rotate: -2, opacity: 0, duration: 0.9, ease: "back.out(1.4)" });
    }, root);

    return () => {
      typing = false;
      timers.forEach(clearTimeout);
      stopLoop();
      [splashF, heroF, ctaF].forEach((f) => f.stop());
      removeEventListener("resize", fsize);
      ctx.revert();
    };
  }, []);

  // the live cards scroll once they've loaded
  useEffect(() => {
    if (!feed?.items.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tw = gsap.to("#track", { xPercent: -50, duration: Math.min(10, feed.items.length) * 6, ease: "none", repeat: -1 });
    ScrollTrigger.refresh();
    return () => { tw.kill(); };
  }, [feed]);

  const items = feed?.items.slice(0, 10) ?? [];
  const tape: [string, number][] = items.length
    ? items.flatMap((i) => i.top.slice(0, 2).map((t) => [t.ticker, t.direction] as [string, number])).slice(0, 14)
    : TAPE;
  const s5 = feed?.score["5"];
  const mins = feed ? Math.round((Date.now() / 1000 - feed.updated) / 60) : 0;

  return (
    <div className="lp" ref={root}>
      {splash && (
        <div id="splash" aria-hidden="true">
          <canvas className="fill" id="splashG" />
          <div className="drop" id="drop" />
          <div className="lock">
            <div className="word" id="splashWord">
              {"ripple".split("").map((c, i) => <span key={i}>{c}</span>)}
            </div>
            <div className="rule" id="splashRule" />
            <p className="sub serif" id="splashSub">Every headline moves a market. Here&rsquo;s which.</p>
          </div>
          <div className="tick tapeband" id="splashTick" style={{ transform: "none", margin: 0 }}>
            <Tape items={TAPE} id="splashRun" />
          </div>
          <button className="skip">Skip</button>
        </div>
      )}

      <nav>
        <Link href="/" className="logo"><i />ripple</Link>
        <div className="links">
          <a href="#story" className="t">How it works</a>
          <a href="#live" className="t">Live calls</a>
          <a className="btn" href="/app">Open Ripple</a>
        </div>
      </nav>

      <header id="hero">
        <canvas className="fill" id="heroG" />
        <div className="wrap">
          <div>
            <p className="kicker serif">The news moved. What moves next?</p>
            <h1 className="display" id="h1">
              {["Paste", "a", "headline.", "See", "which", "stocks"].map((w) => (
                <span key={w}><span className="w"><b>{w}</b></span> </span>
              ))}
              <span className="clip" id="clip">it hits next.</span>
            </h1>
            <p className="lede" id="lede">
              Ripple traces the news through a map of <b>79 parts of the economy</b> and <b>170 cause-and-effect links</b>, then
              shows which stocks are exposed, which way, how soon, and the chain behind every call.
            </p>
            <form className="ask" id="ask" action="/app">
              <input name="q" id="q" aria-label="A news headline" autoComplete="off" />
              <button className="btn" type="submit">Trace it</button>
            </form>
            <p className="hint" id="hint">
              Or <a href="/app?example=fed-higher">open a saved example</a>. Free, loads instantly.
            </p>
          </div>
          <div className="collage" id="collage" aria-hidden="true">
            <div className="news cut"><small>Markets, this morning</small>Fed signals rates will stay higher for longer</div>
            <div className="chart cut halftone">
              <span className="tape" />
              <div className="hd"><b>Homebuilders</b><span className="dn">▼ exposed, ~3 months</span></div>
              <Candles />
              <div className="cap">Illustration of the kind of move Ripple flags</div>
            </div>
            <div className="quote cut mono">
              {([["TOL", -1], ["LEN", -1], ["IBKR", 1], ["SCHW", 1]] as const).map(([t, d]) => (
                <div className="row" key={t}><b>{t}</b><span className={d > 0 ? "up" : "dn"}>{d > 0 ? "▲ rises" : "▼ falls"}</span></div>
              ))}
            </div>
            <Seal />
          </div>
        </div>
      </header>

      <div className="tapeband" aria-hidden="true"><Tape items={tape} id="tickerRun" /></div>

      <section id="story">
        <canvas id="flow" />
        <div className="wrap stage">
          <div>
            <p className="steplabel serif">One real headline, followed through the map</p>
            <div className="print halftone" id="paper">
              <span className="tape" />
              <div className="src"><span>Markets, this morning</span><span className="mono">FED</span></div>
              <div className="hl">Fed signals interest rates will stay higher for longer</div>
            </div>
            <p className="storytext display" id="storytext">{WORDS[0]}</p>
          </div>
          <div>
            <div className="chain" id="chain">
              <div className="node n1"><span className="dot">1</span><div><div className="t">Interest rates go up</div><div className="m">Right away</div></div><Spark dir={1} seed={11} /></div>
              <div className="node n2"><span className="dot">2</span><div><div className="t">Homebuilders slow down</div><div className="m">In about 3 months</div><div className="why">Higher mortgage rates price buyers out.</div></div><Spark dir={-1} seed={12} /></div>
              <div className="node n3"><span className="dot">3</span><div><div className="t">These stocks feel it</div><div className="chips">{["TOL", "LEN", "DHI", "NVR"].map((t) => <span key={t} className="chip dnc">▼ {t}</span>)}</div></div><Spark dir={-1} seed={13} /></div>
              <div className="node n4"><span className="dot">4</span><div><div className="t">Online brokers come out ahead</div><div className="m">Right away</div><div className="chips">{["IBKR", "SCHW"].map((t) => <span key={t} className="chip upc">▲ {t}</span>)}</div></div><Spark dir={1} seed={14} /></div>
            </div>
            <div className="twist" id="twist">
              <p className="serif">And the one you wouldn&rsquo;t guess: higher rates &rarr; a stronger dollar &rarr; <em>copper slips</em>, within a month.</p>
            </div>
          </div>
        </div>
      </section>

      {!feedFailed && (
        <section className="pad" id="live">
          <div className="wrap">
            <div className="livehead">
              <h2 className="display"><span className="pulse" />It&rsquo;s reading the news right now.</h2>
              <div className="board">
                <div className="bh"><span>RIPPLE LIVE</span><span>{feed ? (mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`) : "…"}</span></div>
                <div className="br"><span>Calls made</span><b>{feed?.total ?? "…"}</b></div>
                <div className="br"><span>Graded after 5 days</span><b>{!s5 ? "…" : s5.graded ? `${s5.right} of ${s5.graded} right` : "first grades soon"}</b></div>
                <div className="br"><span>Cost to run</span><b>$0</b></div>
              </div>
            </div>
            <p style={{ color: "var(--muted)", maxWidth: 620 }}>
              Every 2 hours a robot reads business news and traces what the map covers. Every call is graded against the S&amp;P
              500 after 5 and 20 trading days. Every few days Claude reviews its work and teaches it new rules.
            </p>
          </div>
          <div className="marquee">
            <div className="track" id="track">
              {[0, 1].flatMap((k) =>
                items.map((it) => (
                  <a key={`${k}${it.id}`} href={`/app?live=${it.id}`} className="print halftone" style={{ textDecoration: "none" }}>
                    <span className="tape" />
                    <div className="src"><span>{it.source}</span></div>
                    <div className="hl" style={{ fontSize: 22 }}>{it.headline}</div>
                    <div className="moves">
                      {it.top.slice(0, 4).map((t) => (
                        <span key={t.ticker} className={`chip ${t.direction > 0 ? "upc" : "dnc"}`}>{t.direction > 0 ? "▲" : "▼"} {t.ticker}</span>
                      ))}
                    </div>
                  </a>
                )),
              )}
            </div>
          </div>
        </section>
      )}

      <section className="pad" id="proof">
        <div className="wrap">
          <h2 className="display">Built so you can check it.</h2>
          <div className="proofgrid">
            <div className="bt" id="bt">
              <h3>Backtest: 10 past market events</h3>
              <p className="sub">Was the top call right 20 trading days later, against the S&amp;P 500?</p>
              <div className="bar"><span>Ripple</span><div className="tr"><div className="fl" data-w="70" style={{ background: "var(--money)" }} /></div><span className="v">7/10</span></div>
              <div className="bar"><span>Random picks</span><div className="tr"><div className="fl" data-w="50" style={{ background: "#b9ae98" }} /></div><span className="v">~5/10</span></div>
              <div className="events" id="events">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</div>
            </div>
            <div className="stats">
              <div className="stat"><div className="n" data-to="170">0</div><p>cause-and-effect links, each with a written reason you can read.</p></div>
              <div className="stat"><div className="n" data-to="79">0</div><p>parts of the economy on the map, from oil supply to homebuilders.</p></div>
              <div className="stat"><div className="n" data-to="0">0</div><p>facts invented by AI. Every stock and step comes from the map, or Ripple says there&rsquo;s no ripple.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="cta">
        <canvas className="fill" id="ctaG" />
        <div className="wrap">
          <div className="note">
            <div className="serial"><span>RPL 000170</span><span>SERIES 2026</span></div>
            <h2 className="display">Drop a headline in. See where it lands.</h2>
            <a className="btn" href="/app">Open Ripple</a>
          </div>
        </div>
      </section>

      <footer>Built on FalkorDB for Graph Hacks. Ripple describes exposure, not investment advice.</footer>
    </div>
  );
}
