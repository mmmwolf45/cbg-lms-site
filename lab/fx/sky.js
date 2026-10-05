// Night sky (lab fx). One fixed canvas 2D between the page background and the content: two depth layers of
// stars that twinkle slowly and drift a little with scroll, a few faint gold constellations, and (pure sky
// only) a rare, slow shooting star. Stars fade down to 10% behind text, so body text keeps its contrast.
// sky=waves: today's flow canvas, darkened in sky.css, stars on top. sky=pure: flow hidden, deep sky gradient.

const GOLD = '214,177,96';
// Constellations: points in a unit box, then edges. Plough, Cassiopeia, Orion, Cygnus.
const SHAPES = [
  [[[0, .35], [.17, .3], [.32, .36], [.46, .42], [.5, .62], [.72, .66], [.76, .44]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
  [[[0, .25], [.24, .62], [.46, .38], [.7, .72], [1, .32]], [[0, 1], [1, 2], [2, 3], [3, 4]]],
  [[[.5, 0], [.3, .18], [.7, .2], [.42, .5], [.5, .48], [.58, .46], [.34, .84], [.76, .86]], [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 6], [5, 7]]],
  [[[.5, 0], [.5, .38], [.5, .7], [.5, 1], [.08, .3], [.92, .46]], [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]]],
];
const PLACES = [[.04, .1], [.8, .08], [.82, .56], [.05, .6]]; // box top-left, as viewport fractions
const DIM = 0.1; // star brightness behind text
const PAD = 18; // px around each text line that counts as "behind text"
const ROW = 128; // text-rect bucket height (px)

// Seeded so every variant shows the same sky (mulberry32).
const seeded = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const sprite = (rgb) => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.22, `rgba(${rgb},.6)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 32, 32);
  return c;
};

export default function mount(ctx) {
  const pure = ctx.state.sky === 'pure';
  const blueprint = ctx.state.theme === 'blueprint';
  const reduced = ctx.reduced;
  const phone = !ctx.fine || innerWidth < 768;
  const dpr = Math.min(devicePixelRatio || 1, phone ? 1 : 1.5);
  const cv = document.createElement('canvas');
  cv.className = 'lab-sky';
  cv.setAttribute('aria-hidden', 'true');
  document.body.append(cv); // after the flow canvas: same z-index, so above it and below all content
  const g = cv.getContext('2d');
  const cool = sprite('228,235,250');
  const warm = sprite('238,206,140');
  const text = document.querySelector('[data-cbg]') || document.body;

  let W = 0, H = 0, stars = [], figs = [];
  let sy = scrollY, rows = [], mAt = -1e9, mY = NaN;
  let raf = 0, last = 0, shot = null, nextShot = 14 + Math.random() * 16;

  function build() {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w === W && h === H) return;
    W = w; H = h;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const rnd = seeded(7);
    const n = Math.round(Math.min(300, Math.max(110, (W * H) / 4800)));
    stars = [];
    for (let i = 0; i < n; i++) {
      const near = rnd() < 0.28, hero = rnd() < 0.04;
      let x = rnd() * W, y = rnd() * H;
      if (pure && !near && rnd() < 0.4) { // the faint Milky Way band in sky.css (115deg): crowd far stars along it
        const diag = Math.hypot(W, H), along = (rnd() * 2 - 1) * diag * 0.5, off = (rnd() + rnd() + rnd() - 1.5) * 0.09 * diag;
        x = W / 2 - 0.423 * along + 0.906 * off;
        y = H / 2 + 0.906 * along + 0.423 * off;
      }
      stars.push({
        x, y, near,
        r: hero ? 1.3 + rnd() * 0.3 : near ? 0.6 + rnd() * 0.55 : 0.35 + rnd() * 0.4,
        a: hero ? 0.95 : near ? 0.5 + rnd() * 0.4 : 0.28 + rnd() * 0.37,
        warm: rnd() < 0.07,
        tw: near ? 0.35 : 0.25, // twinkle depth
        f: (2 * Math.PI) / (4 + rnd() * 5), // a 4 to 9 s period
        ph: rnd() * 6.3,
        d: 1,
      });
    }
    const size = Math.min(W, H) * (phone ? 0.34 : 0.24);
    figs = SHAPES.slice(0, phone ? 2 : 4).map(([pts, edges], k) => {
      const [px, py] = phone ? [[.06, .12], [.6, .66]][k] : PLACES[k];
      const nodes = pts.map(([u, v]) => ({
        x: px * W + u * size, y: py * H + v * size, fixed: true,
        r: 0.9 + rnd() * 0.35, a: 0.8, warm: rnd() < 0.15, tw: 0.15, f: (2 * Math.PI) / (5 + rnd() * 4), ph: rnd() * 6.3, d: 1,
      }));
      stars.push(...nodes);
      return edges.map(([i, j]) => ({ a: nodes[i], b: nodes[j], d: 1 }));
    });
  }

  // Line boxes of every text node in the home block, in page coordinates, bucketed by row.
  function measure(now) {
    mAt = now;
    mY = scrollY;
    rows = [];
    const walk = document.createTreeWalker(text, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.data.trim() && !n.parentElement.closest('[class*="sr-only"]') ? 1 : 3), // sr-only text reports a huge box
    });
    const range = document.createRange();
    for (let n; (n = walk.nextNode());) {
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (!r.width) continue;
        const b = [r.left - PAD, r.top + mY - PAD, r.right + PAD, r.bottom + mY + PAD];
        for (let i = Math.max(0, Math.floor(b[1] / ROW)); i <= b[3] / ROW; i++) (rows[i] ||= []).push(b);
      }
    }
  }

  const behind = (x, y) => {
    const py = y + scrollY;
    for (const b of rows[Math.floor(py / ROW)] || []) if (x > b[0] && x < b[2] && py > b[1] && py < b[3]) return DIM;
    return 1;
  };
  // Dims quickly (text is arriving), brightens slowly (a calm return).
  const settle = (o, target, snap) => { o.d = snap ? target : o.d + (target - o.d) * (target < o.d ? 0.3 : 0.035); };

  function draw(ms, snap) {
    const t = ms / 1000;
    const y = scrollY;
    if (reduced || ms - mAt > 1500 || (ms - mAt > 120 && y !== mY)) measure(ms);
    sy = reduced ? 0 : sy + (y - sy) * 0.06;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const span = H + 20;
    for (const s of stars) {
      const drift = sy * (s.near ? 0.035 : 0.012);
      s.vx = s.x;
      s.vy = s.fixed ? s.y - drift : ((((s.y - drift) % span) + span) % span) - 10;
      settle(s, behind(s.vx, s.vy), snap);
      const tw = reduced ? 1 - s.tw / 2 : 1 - s.tw * (0.5 + 0.5 * Math.sin(t * s.f + s.ph));
      g.globalAlpha = s.a * tw * s.d;
      const z = s.r * 6;
      g.drawImage(s.warm ? warm : cool, s.vx - z / 2, s.vy - z / 2, z, z);
    }

    // Constellation lines: very faint in plain; a little stronger in blueprint, drawing in as the page scrolls.
    const progress = sy / Math.max(1, document.documentElement.scrollHeight - innerHeight);
    g.strokeStyle = `rgb(${GOLD})`;
    g.lineWidth = 1;
    figs.forEach((edges, k) => {
      const shown = reduced || !blueprint ? 1 : Math.min(1, Math.max(0, (progress - k * 0.13) / 0.32)) * edges.length;
      edges.forEach((e, i) => {
        const f = Math.min(1, Math.max(0, shown - i));
        if (!f) return;
        const x = e.a.vx + (e.b.vx - e.a.vx) * f, yy = e.a.vy + (e.b.vy - e.a.vy) * f;
        settle(e, Math.min(e.a.d, e.b.d, behind((e.a.vx + x) / 2, (e.a.vy + yy) / 2)), snap);
        g.globalAlpha = (blueprint ? 0.2 : 0.07) * e.d;
        g.beginPath();
        g.moveTo(e.a.vx, e.a.vy);
        g.lineTo(x, yy);
        g.stroke();
      });
    });

    if (pure && !reduced) shoot(t);
    g.globalAlpha = 1;
  }

  // A shooting star every 25 to 45 s: a long sine ease across 220 to 380 px in 2 to 2.8 s, faint, no flash.
  function shoot(t) {
    if (!shot) {
      if (t < nextShot) return;
      const dir = Math.random() < 0.5 ? 1 : -1, ang = (18 + Math.random() * 14) * (Math.PI / 180);
      shot = {
        t0: t, dur: 2 + Math.random() * 0.8, len: (220 + Math.random() * 160) * Math.min(1, W / 1200),
        x: W * (0.5 + dir * (0.12 + Math.random() * 0.18)), y: H * (0.06 + Math.random() * 0.3), // heads outward, away from the centred hero
        dx: Math.cos(ang) * dir, dy: Math.sin(ang), d: 1,
      };
    }
    const k = (t - shot.t0) / shot.dur;
    if (k >= 1) { shot = null; nextShot = t + 25 + Math.random() * 20; return; }
    const e = (0.5 - 0.5 * Math.cos(Math.PI * k)) * shot.len, fade = Math.sin(Math.PI * k);
    const hx = shot.x + shot.dx * e, hy = shot.y + shot.dy * e, tail = 30 + 110 * fade;
    const gr = g.createLinearGradient(hx, hy, hx - shot.dx * tail, hy - shot.dy * tail);
    gr.addColorStop(0, 'rgba(236,240,250,1)');
    gr.addColorStop(1, 'rgba(236,240,250,0)');
    settle(shot, behind(hx, hy));
    g.globalAlpha = 0.5 * fade * shot.d;
    g.strokeStyle = gr;
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(hx - shot.dx * tail, hy - shot.dy * tail);
    g.stroke();
  }

  const loop = (ms) => {
    raf = requestAnimationFrame(loop);
    if (phone && ms - last < 32) return; // about 30 fps on phones
    last = ms;
    draw(ms, false);
  };
  const once = () => { raf = 0; build(); draw(performance.now(), true); };
  const kick = () => { if (!raf) raf = requestAnimationFrame(once); };

  build();
  draw(performance.now(), true);
  cv.classList.add('is-on'); // fades in over the old background (sky.css)
  addEventListener('resize', reduced ? kick : build, { passive: true });
  if (reduced) { // a still sky: redrawn only so the text dimming follows the page
    addEventListener('scroll', kick, { passive: true });
    return;
  }
  raf = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    raf = document.hidden ? 0 : requestAnimationFrame(loop);
  });
}
