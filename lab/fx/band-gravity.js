// Band B, "Zero gravity" (lab prototype). The desk's three cut-outs float weightless in a night-sky panel
// above a lit construction site far below. A tiny physics loop: each object is a circle on an overdamped
// spring (it can never overshoot) to a home that drifts very slowly. Mouse: a soft field eases objects away,
// and an object can be dragged and let go: it glides at a capped, low speed for a few seconds, then drifts
// home. Objects and the panel edges push softly (overdamped contacts, no bounce). Touch: a tap nudges an
// object and turns it half round, slowly. Reduced motion: the still composition. Pauses off screen.

const OBJS = [
  // home: [x, y, width] as shares of the panel (desktop / phone); rz: resting tilt; depth: near > 1 > far
  { name: 'plans', srcs: [520, 1000], desk: [0.2, 0.42, 0.23], phone: [0.25, 0.32, 0.38], rz: -11, depth: 0.85 },
  { name: 'laptop', srcs: [560, 1100], desk: [0.5, 0.56, 0.3], phone: [0.53, 0.64, 0.5], rz: 5, depth: 1 },
  { name: 'helmet', srcs: [440, 840], desk: [0.8, 0.4, 0.19], phone: [0.8, 0.3, 0.32], rz: -7, depth: 1.12 },
];
const LABEL = 'Rolled construction plans, a laptop and a white hard hat floating weightless in a night sky, high above a lit construction site';

// Feel. Springs in 1/s², drags in 1/s, speeds in px/s. Every spring below is overdamped (c >= 2*sqrt(k)).
const K = 1, C = 2.2, C_GLIDE = 1.1;          // home spring; drag at rest and while gliding (~3 s glide)
const KA = 0.8, CA = 2, CA_GLIDE = 0.9;       // the same for the in-plane turn (deg)
const K_DRAG = 14, C_DRAG = 7.6, V_DRAG = 650; // a held object trails the pointer, heavily damped
const V_THROW = 200, W_THROW = 14, V_MAX = 260; // release caps (px/s, deg/s) and the overall cap
const K_HIT = 4, C_HIT = 6;                   // soft contacts (objects and panel edges)
const PUSH = 64, TAP = 70, TURN_S = 4.5;      // cursor field (px), tap nudge (px/s), half-turn duration (s)

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const cap = (vx, vy, m) => { const s = Math.hypot(vx, vy); return s > m ? [vx * m / s, vy * m / s] : [vx, vy]; };
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export default function mount(ctx) {
  const band = document.querySelector('#cbg-band .cbg-wrap');
  if (!band) return;
  const site = (n, w, f) => `${ctx.site(`band-desk/${n}-${w}.${f}`)} ${w}w`;
  const frame = document.createElement('div');
  frame.className = 'lab-band-gravity cbg-frame';
  frame.setAttribute('role', 'img');
  frame.setAttribute('aria-label', LABEL);
  const tw = rng(3); // a few brighter stars that breathe slowly (CSS)
  frame.innerHTML = `<div class="lab-band-gravity__panel"><canvas class="lab-band-gravity__sky"></canvas>${
    Array.from({ length: 7 }, () => `<i class="lab-band-gravity__tw" style="left:${(4 + 92 * tw()).toFixed(1)}%;`
      + `top:${(5 + 62 * tw()).toFixed(1)}%;animation-delay:${(-12 * tw()).toFixed(1)}s"></i>`).join('')}${
    OBJS.map((o) => `<div class="lab-band-gravity__obj lab-band-gravity__obj--${o.name}"><picture>`
      + `<source type="image/avif" srcset="${o.srcs.map((w) => site(o.name, w, 'avif'))}" sizes="(max-width: 720px) 50vw, 30vw">`
      + `<img src="${ctx.site(`band-desk/${o.name}-${o.srcs[0]}.webp`)}" srcset="${o.srcs.map((w) => site(o.name, w, 'webp'))}"`
      + ` sizes="(max-width: 720px) 50vw, 30vw" alt="" draggable="false" decoding="async"></picture></div>`).join('')}</div>`;
  band.appendChild(frame);
  const panel = frame.firstElementChild;
  const canvas = panel.querySelector('canvas');
  const phoneMq = matchMedia('(max-width: 720px)');
  const bodies = OBJS.map((o, i) => {
    const el = panel.querySelectorAll('.lab-band-gravity__obj')[i];
    const r = rng(i * 977 + 13);
    return { ...o, el, x: 0, y: 0, vx: 0, vy: 0, a: o.rz, w: 0, spin: 0, turn: null, free: 99, drag: null,
      px: 26 + 14 * r(), py: 31 + 12 * r(), pa: 37 + 14 * r(), ph: 6 * r() };
  });

  // Layout: panel size, object widths and their (desktop or phone) homes. Positions scale with the panel.
  let W = 0, H = 0;
  function layout() {
    const w = panel.clientWidth, h = panel.clientHeight;
    if (!w || !h) return;
    const phone = phoneMq.matches;
    for (const b of bodies) {
      const [hx, hy, share] = phone ? b.phone : b.desk;
      b.el.style.width = `${share * 100}%`;
      b.bw = b.el.offsetWidth; b.bh = b.el.offsetHeight;
      b.r = 0.4 * (b.bw + b.bh) / 2;
      b.hx = hx * w; b.hy = hy * h;
      if (W) { b.x *= w / W; b.y *= h / H; } else { b.x = b.hx; b.y = b.hy; }
    }
    W = w; H = h;
    paintSky(canvas, W, H, Math.min(devicePixelRatio || 1, ctx.fine ? 1.5 : 1));
    render();
  }

  function render() {
    for (const b of bodies) {
      b.el.style.transform = `translate3d(${(b.x - b.bw / 2).toFixed(2)}px, ${(b.y - b.bh / 2).toFixed(2)}px, 0) `
        + `rotate(${(b.a + b.spin).toFixed(3)}deg)`;
    }
  }

  new ResizeObserver(layout).observe(panel);
  layout();
  if (ctx.reduced) return; // still, finished composition: no drift, no drag

  let pointer = null, t = 0, last = 0, raf = 0, onScreen = false;

  function step(dt) {
    t += dt;
    for (const b of bodies) {
      const s = b.drag ? 1 : smooth((b.free - 1.8) / 4.5); // after a throw: glide first, then home eases back in
      b.free += dt;
      // Where it drifts to: home plus a slow Lissajous wander, away from the cursor, and a little parallax.
      let tx = b.hx + W * 0.016 * Math.sin(t * 6.283 / b.px + b.ph);
      let ty = b.hy + H * 0.03 * Math.sin(t * 6.283 / b.py + b.ph * 1.7);
      if (pointer) {
        const dx = b.x - pointer.x, dy = b.y - pointer.y, d = Math.hypot(dx, dy) || 1;
        const f = smooth(1 - d / (b.r * 1.7 + 90)) * PUSH * b.depth;
        tx += (dx / d) * f - (pointer.x - W / 2) * 0.025 * b.depth;
        ty += (dy / d) * f - (pointer.y - H / 2) * 0.025 * b.depth;
      }
      let ax, ay;
      if (b.drag) {
        ax = K_DRAG * (b.drag.x - b.x) - C_DRAG * b.vx;
        ay = K_DRAG * (b.drag.y - b.y) - C_DRAG * b.vy;
      } else {
        const c = C_GLIDE + (C - C_GLIDE) * s;
        ax = K * s * (tx - b.x) - c * b.vx;
        ay = K * s * (ty - b.y) - c * b.vy;
      }
      // Panel edges: a soft, overdamped wall (about 40% of the object may tuck past the edge).
      const ex = b.bw * 0.3, ey = b.bh * 0.3;
      if (b.x < ex) ax += K_HIT * (ex - b.x) - C_HIT * Math.min(0, b.vx);
      if (b.x > W - ex) ax -= K_HIT * (b.x - W + ex) + C_HIT * Math.max(0, b.vx);
      if (b.y < ey) ay += K_HIT * (ey - b.y) - C_HIT * Math.min(0, b.vy);
      if (b.y > H - ey) ay -= K_HIT * (b.y - H + ey) + C_HIT * Math.max(0, b.vy);
      b.ax = ax; b.ay = ay;
      // Turning: a slow in-plane drift around the resting tilt; a held object leans into its motion.
      const ta = b.rz + 3 * Math.sin(t * 6.283 / b.pa + b.ph) + (b.drag ? Math.max(-8, Math.min(8, b.vx * 0.03)) : 0);
      b.w += (KA * s * (ta - b.a) - (CA_GLIDE + (CA - CA_GLIDE) * s) * b.w) * dt;
      b.a += b.w * dt;
      if (b.turn) {
        b.turn.t = Math.min(1, b.turn.t + dt / TURN_S);
        b.spin = b.turn.dir * 180 * (0.5 - 0.5 * Math.cos(Math.PI * b.turn.t)); // sine in-out, no overshoot
        if (b.turn.t === 1) { b.rz += b.spin; b.a += b.spin; b.spin = 0; b.turn = null; } // the half-turn becomes its new rest
      }
    }
    // Soft contacts between objects (a held object is immovable; the other yields fully).
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const p = bodies[i], q = bodies[j];
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, over = p.r + q.r - d;
        if (over <= 0) continue;
        const nx = dx / d, ny = dy / d, vn = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
        const f = K_HIT * over - C_HIT * Math.min(0, vn);
        const sp = p.drag ? 0 : q.drag ? 1 : 0.5;
        p.ax -= nx * f * sp; p.ay -= ny * f * sp;
        q.ax += nx * f * (1 - sp); q.ay += ny * f * (1 - sp);
      }
    }
    for (const b of bodies) {
      [b.vx, b.vy] = cap(b.vx + b.ax * dt, b.vy + b.ay * dt, b.drag ? V_DRAG : V_MAX);
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
  }

  const frameFn = (now) => {
    raf = 0;
    const dt = last ? Math.min(1 / 30, (now - last) / 1000) : 1 / 60;
    last = now;
    step(dt);
    render();
    kick();
  };
  function kick() {
    if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(frameFn);
    else if (!onScreen || document.hidden) last = 0;
  }
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; kick(); }).observe(panel);
  document.addEventListener('visibilitychange', kick);

  const at = (e) => { const r = panel.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  if (ctx.fine) {
    panel.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') pointer = at(e); });
    panel.addEventListener('pointerleave', () => { pointer = null; });
  }
  for (const b of bodies) {
    let down = null;
    b.el.addEventListener('pointerdown', (e) => {
      down = { ...at(e), t: performance.now() };
      if (!ctx.fine || e.pointerType !== 'mouse') return; // touch: taps only, the page keeps scrolling
      e.preventDefault();
      b.el.setPointerCapture(e.pointerId);
      b.grab = { x: b.x - down.x, y: b.y - down.y };
      b.drag = { x: b.x, y: b.y };
      frame.dataset.dragging = b.name;
      for (const o of bodies) o.el.style.zIndex = o === b ? 2 : '';
    });
    b.el.addEventListener('pointermove', (e) => {
      if (!b.drag) return;
      const p = at(e);
      b.drag.x = Math.max(0, Math.min(W, p.x + b.grab.x));
      b.drag.y = Math.max(0, Math.min(H, p.y + b.grab.y));
    });
    const up = (e) => {
      const p = at(e);
      const tap = down && Math.hypot(p.x - down.x, p.y - down.y) < 8 && performance.now() - down.t < 450;
      if (b.drag) {
        b.drag = null;
        delete frame.dataset.dragging;
        [b.vx, b.vy] = cap(b.vx, b.vy, V_THROW);
        b.w = Math.max(-W_THROW, Math.min(W_THROW, b.vx * 0.06));
        b.free = 0;
      }
      if (tap && e.type === 'pointerup') {
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
        b.vx += (dx / d) * TAP; b.vy += (dy / d) * TAP;
        b.free = 0;
        if (!b.turn) b.turn = { dir: p.x < b.x ? 1 : -1, t: 0 };
      }
      down = null;
    };
    b.el.addEventListener('pointerup', up);
    b.el.addEventListener('pointercancel', up);
  }
}

// The sky, painted once per size: soft stars, the dark curve of the ground far below with a thin blue
// rim of atmosphere, and the warm glow and lights of a construction site at night on it.
function paintSky(canvas, W, H, dpr) {
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = rng(7);
  for (let i = 0, n = Math.round(W * H / 2300); i < n; i++) {
    const big = r() < 0.08;
    g.globalAlpha = big ? 0.55 + 0.35 * r() : 0.12 + 0.4 * r();
    g.fillStyle = r() < 0.12 ? '#E9D9B0' : r() < 0.2 ? '#C9D6F2' : '#F3F5F9';
    g.beginPath(); g.arc(r() * W, r() * H, big ? 0.9 + 0.5 * r() : 0.35 + 0.5 * r(), 0, 6.283); g.fill();
  }
  g.globalAlpha = 1;
  const R = W * 1.5, cx = W * 0.56, top = H * 0.86, cy = top + R;
  const halo = g.createRadialGradient(cx, cy, R * 0.985, cx, cy, R * 1.05);
  halo.addColorStop(0, 'rgba(90,130,210,0)');
  halo.addColorStop(0.24, 'rgba(110,150,225,0.26)');
  halo.addColorStop(1, 'rgba(90,130,210,0)');
  g.fillStyle = halo; g.fillRect(0, 0, W, H);
  const ground = g.createLinearGradient(0, top, 0, H);
  ground.addColorStop(0, '#0F1F3D'); ground.addColorStop(1, '#081329');
  g.fillStyle = ground; g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.fill();
  g.strokeStyle = 'rgba(160,190,240,0.4)'; g.lineWidth = 1;
  g.beginPath(); g.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
  // The site: a warm glow on the horizon and a scatter of small lights, flattened by distance.
  const sx = W * 0.66, sy = top + H * 0.035;
  g.save(); g.translate(sx, sy); g.scale(1, 0.32);
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.2);
  glow.addColorStop(0, 'rgba(214,177,96,0.3)'); glow.addColorStop(1, 'rgba(214,177,96,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, W * 0.2, 0, 6.283); g.fill();
  g.restore();
  for (let i = 0; i < 46; i++) {
    const u = (r() + r() + r()) / 3 - 0.5, v = r();
    const x = sx + u * W * 0.26, y = sy - H * 0.012 + v * v * H * 0.07;
    g.globalAlpha = 0.35 + 0.55 * r();
    g.fillStyle = r() < 0.75 ? '#F1C877' : '#F3F5F9';
    g.beginPath(); g.arc(x, y, 0.5 + 0.7 * r() * (0.4 + v), 0, 6.283); g.fill();
  }
  g.globalAlpha = 1;
}
