// banknote-style engraved rings that ripple out from a point; shared by the landing page and the app

export type GuillocheOpts = {
  cx?: number;
  cy?: number;
  gap?: number;
  petals?: number;
  amp?: number;
  inks?: [string, string];
  alpha?: number;
  hit?: string;
  spin?: number;
  follow?: boolean;
};

export type Field = { frame: (dt: number) => void; hit: (s?: number) => void; stop: () => void };

export function guilloche(canvas: HTMLCanvasElement, opts: GuillocheOpts = {}): Field {
  const ctx = canvas.getContext("2d")!;
  const o = { cx: 0.5, cy: 0.5, gap: 22, petals: 18, amp: 6, inks: ["216,178,90", "39,196,126"], alpha: 0.45, hit: "255,171,31", spin: 0.05, follow: false, ...opts };
  let w = 0, h = 0, t = 0, mx = 0, my = 0;
  let impulses: { r: number; s: number }[] = [];
  const size = () => {
    const d = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * d;
    canvas.height = h * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  };
  const move = (e: PointerEvent) => {
    mx = e.clientX / innerWidth - 0.5;
    my = e.clientY / innerHeight - 0.5;
  };
  size();
  addEventListener("resize", size);
  if (o.follow) addEventListener("pointermove", move);

  function frame(dt: number) {
    t += dt;
    ctx.clearRect(0, 0, w, h);
    const cx = w * (o.cx + mx * 0.04), cy = h * (o.cy + my * 0.04);
    const max = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    for (let r = 30, i = 0; r < max; r += o.gap, i++) {
      let push = 0;
      for (const p of impulses) {
        const d = Math.abs(r - p.r);
        if (d < 80) push += (1 - d / 80) * p.s;
      }
      const fade = Math.min(1, r / 140) * (1 - (r / max) * 0.6);
      for (let pass = 0; pass < 2; pass++) {
        const ph = t * o.spin * (pass ? -1 : 1) + i * 0.35 + (pass * Math.PI) / o.petals;
        ctx.beginPath();
        for (let k = 0; k <= 360; k++) {
          const a = (k / 360) * Math.PI * 2;
          const rr = r + Math.sin(a * o.petals + ph) * o.amp * (1 + r / 400) + push * 14;
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = push > 0.05 ? `rgba(${o.hit},${Math.min(1, push)})` : `rgba(${o.inks[pass]},${o.alpha * fade})`;
        ctx.lineWidth = push > 0.05 ? 2 : 0.8;
        ctx.stroke();
      }
    }
    impulses = impulses.filter((p) => ((p.r += dt * 520), (p.s *= 0.985), p.r < max));
  }

  return {
    frame,
    hit: (s = 1) => impulses.push({ r: 0, s }),
    stop: () => {
      removeEventListener("resize", size);
      removeEventListener("pointermove", move);
    },
  };
}

// runs fields only while they're on screen; returns a cleanup
export function animate(fields: { f: { frame: (dt: number) => void }; el: Element }[]) {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last = performance.now(), raf = 0;
  const loop = (now: number) => {
    const dt = still ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const { f, el } of fields) {
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) f.frame(dt);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
