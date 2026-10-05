// Band A, "Constellation build": a star-chart panel in which, as the band scrolls up the screen, stars drift
// into place and thin gold lines join them, one by one, into a tower crane lifting a beam onto a building
// frame, with a small hard hat as a second constellation. Canvas 2D (crisp at any DPR, one redraw per frame).
// Scroll sets a target; the drawn progress follows it with heavy damping and a low top speed.

// The drawing, in a 1000 x 480 design space. Each edge joins two named stars; edges draw in this order.
const P = {
  g0: [120, 420], g1: [880, 420],                                   // ground
  m0: [290, 420], m1: [318, 420], m2: [290, 330], m3: [318, 330],   // crane mast (lattice)
  m4: [290, 240], m5: [318, 240], m6: [290, 150], m7: [318, 150],
  ap: [304, 62],                                                    // apex
  cj: [170, 150], cw: [200, 150], cb: [200, 172], cc: [170, 172],   // counter-jib + counterweight
  jt: [560, 150], je: [780, 150],                                   // jib tie point, jib end
  tr: [640, 150], hk: [640, 214], ld: [600, 222], le: [680, 222],   // trolley, hook, beam
  b0: [480, 420], b1: [580, 420], b2: [680, 420], b3: [780, 420],   // building frame
  c0: [480, 360], c1: [580, 360], c2: [680, 360], c3: [780, 360],
  d0: [480, 300], d1: [580, 300], d2: [680, 300], d3: [780, 300],
  e0: [480, 248], e1: [580, 248],
  h0: [848, 100], h1: [856, 74], h2: [880, 62], h3: [904, 74], h4: [912, 100], h5: [830, 100], h6: [936, 100], // hard hat
};
const E = (s) => s.split(' ').map((p) => p.split('-'));
const EDGES = E('g0-g1 m0-m2 m1-m3 m0-m3 m2-m4 m3-m5 m2-m5 m4-m6 m5-m7 m4-m7 m6-ap m7-ap m6-m7 m6-cj m7-jt jt-je'
  + ' ap-jt ap-cj cw-cb cb-cc cc-cj b0-c0 b1-c1 b2-c2 b3-c3 c0-c1 c1-c2 c2-c3 c0-d0 c1-d1 c2-d2 c3-d3 c0-d1 c1-d0'
  + ' d0-d1 d1-d2 d2-d3 d0-e0 d1-e1 e0-e1 tr-hk ld-le hk-ld hk-le h5-h6 h0-h1 h1-h2 h2-h3 h3-h4');

const GOLD = '214,177,96';
// A soft warm glow, drawn once and stamped behind each joined (or pointer-lit) star.
const HALO = document.createElement('canvas');
HALO.width = HALO.height = 64;
{
  const h = HALO.getContext('2d'), r = h.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(246,231,196,0.9)'); r.addColorStop(0.25, 'rgba(214,177,96,0.35)'); r.addColorStop(1, 'rgba(214,177,96,0)');
  h.fillStyle = r; h.fillRect(0, 0, 64, 64);
}
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// A seeded random, so the scatter and the sky are the same on every load.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export default function mount(ctx) {
  const band = document.querySelector('#cbg-band');
  const wrap = band?.querySelector('.cbg-wrap');
  if (!wrap) return;

  const frame = document.createElement('div');
  frame.className = 'cbg-frame lab-constellation';
  frame.setAttribute('role', 'img');
  frame.setAttribute('aria-label', 'A star chart in which gold lines join the stars into a tower crane lifting a beam onto a building frame, with a small hard hat beside it.');
  frame.innerHTML = '<div class="lab-constellation-sky"><canvas aria-hidden="true"></canvas>'
    + '<p class="lab-constellation-cap" aria-hidden="true">Constellation<span>The Builder</span></p></div>';
  wrap.appendChild(frame);
  const sky = frame.firstChild;
  const canvas = sky.querySelector('canvas');
  const cap = sky.querySelector('.lab-constellation-cap');
  const g = canvas.getContext('2d');

  // Stars of the drawing: each starts nudged off its place and eases home when its first line starts.
  const span = 0.9 / EDGES.length;                // edges start over 0..0.9 of the way, each draws over 3 slots
  const stars = Object.fromEntries(Object.entries(P).map(([k, [x, y]]) => [k, {
    x, y, dx: (rnd() - 0.5) * 90, dy: (rnd() - 0.5) * 70, at: 1, b: 0,
  }]));
  EDGES.forEach(([a, b], i) => { for (const k of [a, b]) stars[k].at = Math.min(stars[k].at, i * span); });
  const drawn = Object.values(stars);
  // The background sky, in panel fractions (so it fills any shape), with slow independent twinkles.
  const dust = Array.from({ length: 170 }, () => ({
    u: rnd(), v: rnd(), r: 0.35 + rnd() * rnd() * 1.1, a: 0.18 + rnd() * 0.45,
    w: 0.25 + rnd() * 0.5, ph: rnd() * 6.28, b: 0,
  }));

  let W = 0, H = 0, S = 1, OX = 0, OY = 0, nSky = 0;
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, ctx.fine ? 1.5 : 1);
    W = sky.clientWidth; H = sky.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    nSky = Math.min(dust.length, Math.round((W * H) / 2500)); // same star density on any panel
    // Fit the drawing's bounds (x 120-940, y 55-425) inside the panel, a touch high to leave room for the caption.
    S = Math.min((W * (W < 600 ? 0.92 : 0.86)) / 820, (H * 0.78) / 370);
    OX = (W - 820 * S) / 2 - 120 * S; OY = (H - 370 * S) / 2 - 55 * S - H * 0.03;
  }

  let p = 0, mx = -1e4, my = -1e4, tx = -1e4, ty = -1e4, hover = 0, hoverT = 0, last = 0, t = 0;

  function draw() {
    g.clearRect(0, 0, W, H);
    const dot = (x, y, r, a) => { g.globalAlpha = a; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };
    const halo = (x, y, r, a) => { if (a > 0.01) { g.globalAlpha = a; g.drawImage(HALO, x - r, y - r, r * 2, r * 2); } };
    g.fillStyle = '#e9edf6';
    for (let i = 0; i < nSky; i++) {
      const s = dust[i], x = s.u * W, y = s.v * H;
      const tw = ctx.reduced ? 1 : 0.75 + 0.25 * Math.sin(t * s.w + s.ph);
      halo(x, y, 7, s.b * 0.5);
      dot(x, y, s.r + s.b * 0.4, Math.min(1, s.a * tw + s.b * 0.5));
    }
    // Lines: each draws from its first star to its second over three slots of progress.
    g.lineWidth = 1; g.lineCap = 'round';
    const pos = (s) => {
      const k = 1 - ease((p - s.at + 0.05) / 0.12);
      return [OX + (s.x + s.dx * k) * S, OY + (s.y + s.dy * k) * S];
    };
    EDGES.forEach(([a, b], i) => {
      const f = ease((p - i * span) / (span * 3));
      if (f <= 0) return;
      const [x0, y0] = pos(stars[a]), [x1, y1] = pos(stars[b]);
      g.strokeStyle = `rgba(${GOLD},${0.85 * Math.min(1, f * 1.5)})`;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f); g.stroke();
    });
    // Stars of the drawing: dim and white while scattered, warm and bright once joined.
    for (const s of drawn) {
      const [x, y] = pos(s);
      const on = ease((p - s.at) / 0.1);
      g.fillStyle = on > 0.5 ? '#f6e7c4' : '#e9edf6';
      halo(x, y, (6 + on * 6 + s.b * 6) * Math.max(S, 0.45), on * 0.35 + s.b * 0.55);
      dot(x, y, 0.9 + on * 0.9 + s.b * 0.5, Math.min(1, 0.45 + on * 0.5 + s.b * 0.4));
    }
    g.globalAlpha = 1;
    cap.style.opacity = String(ease((p - 0.88) / 0.12));
  }

  // Desktop: stars near the pointer brighten softly (the pointer itself is followed with heavy smoothing).
  function nearPointer(dt) {
    const k = 1 - Math.exp(-dt / 0.35);
    mx += (tx - mx) * k; my += (ty - my) * k;
    hover += (hoverT - hover) * (1 - Math.exp(-dt / 0.8));
    const R = 150, near = (x, y) => { const d = Math.hypot(x - mx, y - my); return d < R ? (1 - d / R) ** 2 * hover : 0; };
    const kb = 1 - Math.exp(-dt / 0.5);
    for (const s of dust) s.b += (near(s.u * W, s.v * H) - s.b) * kb;
    for (const s of drawn) s.b += (near(OX + s.x * S, OY + s.y * S) * 0.8 - s.b) * kb;
  }

  let raf = 0, visible = false;
  function frameLoop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
    // Follow the scroll with a long exponential ease, capped at a slow top speed (a full drawing >= 4s).
    const step = (st.progress - p) * (1 - Math.exp(-dt / 0.7));
    p += Math.sign(step) * Math.min(Math.abs(step), dt * 0.25);
    if (ctx.fine) nearPointer(dt);
    draw();
    if (visible && !document.hidden) raf = requestAnimationFrame(frameLoop);
  }
  const run = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frameLoop); } };

  size();
  new ResizeObserver(() => { size(); draw(); }).observe(sky);
  if (ctx.reduced) { p = 1; draw(); return; }        // a still, finished drawing
  // Scroll target: 0 as the panel's top passes 85% down the screen, 1 when its centre reaches the middle.
  const st = ctx.ScrollTrigger.create({ trigger: sky, start: 'top 85%', end: 'center center' });
  p = st.progress; draw();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(sky);
  document.addEventListener('visibilitychange', run);
  if (ctx.fine) {
    band.addEventListener('pointermove', (e) => {
      const r = sky.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (hoverT === 0 && mx < -1e3) { mx = tx; my = ty; }
      hoverT = 1;
    });
    band.addEventListener('pointerleave', () => { hoverT = 0; });
  }
}
