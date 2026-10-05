// Band D, "Film scrub": a short AI clip (night construction site, the camera cranes up past the tower
// crane into a clear starry sky) cut into frames and scrubbed by scroll while #cbg-band crosses the
// screen. No pinning: progress runs from the band's top entering at the bottom of the screen to its
// bottom leaving at the top, heavily damped so the film glides; the film plays from 35% to 80% of
// that, so its first frame (the lit steel frame) and last (the open sky) are seen with the band in view.
// The 48 frames sit at equal steps of camera travel (TRAVEL, from cut-frames.ts). Between two frames
// both are shifted to the in-between camera height before they blend, so the rise stays continuous with
// no double image (a plain cross-fade, as in src/motion/explode.ts, ghosts here: the picture moves).
// Reduced motion: the poster (first frame) only, nothing loads or moves.
// Sources: brand/assets/band-scrub/ (keyframes and mp4); frames: lab/assets/band-scrub/{l,s}/fNN.avif.

const N = 48;
// Camera height of each frame as a share of the frame height (brand/assets/band-scrub/cut-frames.ts).
const TRAVEL = [0, 0.0241, 0.0512, 0.0825, 0.1001, 0.1312, 0.1532, 0.18, 0.2033, 0.2311, 0.2563, 0.286, 0.3165,
  0.3322, 0.3652, 0.3819, 0.4154, 0.432, 0.4651, 0.4819, 0.5252, 0.5478, 0.5682, 0.5889, 0.6282, 0.6466, 0.667,
  0.7037, 0.7241, 0.7423, 0.7758, 0.7924, 0.8351, 0.8502, 0.8797, 0.9109, 0.9273, 0.9601, 0.9903, 1.0036,
  1.0297, 1.0593, 1.0884, 1.1072, 1.1337, 1.1653, 1.1911, 1.2154];
const TOP = TRAVEL[N - 1];
const SLACK = 0.05; // spare frame height above and below the crop, so a shifted frame never runs out
const PLAY = [0.35, 0.8]; // the stretch of the band's crossing (0..1) the film plays over
// The film follows the scroll on a critically damped spring (eases in and out, never overshoots) with a
// speed limit: a hard fling still takes at least MIN_S seconds to run the whole film.
const OMEGA = 3.2; // rad/s: settles about 1.5 s after the scroll stops
const MIN_S = 2.2;
const AR = 16 / 9; // the frames' aspect

export default function mount(ctx) {
  const band = document.querySelector('#cbg-band');
  const view = band?.querySelector('.cbg-band__view');
  if (!view) return;

  const root = document.createElement('div');
  root.className = 'lab-band-scrub';
  root.setAttribute('aria-hidden', 'true');
  const poster = new Image();
  poster.className = 'lab-band-scrub__poster';
  poster.alt = '';
  poster.decoding = 'async';
  const canvas = document.createElement('canvas');
  canvas.className = 'lab-band-scrub__canvas';
  root.append(poster, canvas);
  view.appendChild(root);
  view.classList.add('lab-band-scrub-on'); // hides the desk (CSS), keeps it in the DOM
  view.setAttribute('aria-label', 'At night, a camera rises past a lit steel frame and tower crane into a clear starry sky');

  // Frame set: enough pixels for the cover-cropped width at the capped DPR.
  const dpr = Math.min(window.devicePixelRatio || 1, ctx.fine ? 1.5 : 1);
  const need = () => Math.max(view.clientWidth, view.clientHeight * AR) * dpr;
  const dir = need() > 900 ? 'l' : 's';
  const url = (i) => ctx.asset(`band-scrub/${dir}/f${String(i + 1).padStart(2, '0')}.avif`);
  poster.src = url(0);
  if (ctx.reduced) return; // a still, finished state

  const g = canvas.getContext('2d', { alpha: false });
  const frames = new Array(N);
  const ready = (j) => j >= 0 && j < N && frames[j]?.ok;
  let target = 0, cur = 0, vel = 0, painted = -1, raf = 0, last = 0;

  // Cover fit, like object-fit: cover, centred, keeping SLACK spare above and below.
  let sx = 0, sy = 0, sw = 1, sh = 1, ih = 1;
  const size = () => {
    const w = Math.round(view.clientWidth * dpr), h = Math.round(view.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const img = frames.find((f) => f?.ok)?.img;
    if (!img) return;
    const iw = img.naturalWidth;
    ih = img.naturalHeight;
    const s = Math.max(w / iw, h / (ih * (1 - 2 * SLACK)));
    sw = w / s; sh = h / s; sx = (iw - sw) / 2; sy = (ih - sh) / 2;
    painted = -1;
  };
  // Draw frame j as seen from camera height u: its picture moves down as the camera rises past it.
  const draw = (j, u, alpha) => {
    const dy = Math.max(-SLACK, Math.min(SLACK, u - TRAVEL[j])) * ih;
    g.globalAlpha = alpha;
    g.drawImage(frames[j].img, sx, sy - dy, sw, sh, 0, 0, canvas.width, canvas.height);
  };
  const nearest = (i) => { for (let d = 0; d < N; d++) for (const j of [i - d, i + d]) if (ready(j)) return j; return -1; };
  const paint = (u) => {
    if (Math.abs(u - painted) < 0.0004 || sw === 1) return;
    let a = 0;
    while (a < N - 2 && TRAVEL[a + 1] <= u) a++;
    const t = Math.max(0, Math.min(1, (u - TRAVEL[a]) / (TRAVEL[a + 1] - TRAVEL[a])));
    if (ready(a) && ready(a + 1)) {
      draw(a, u, 1);
      if (t > 0.004) draw(a + 1, u, t);
    } else {
      const j = nearest(t < 0.5 ? a : a + 1);
      if (j < 0) return;
      draw(j, u, 1);
    }
    g.globalAlpha = 1;
    painted = u;
    canvas.dataset.frame = (a + t).toFixed(2); // tests read it
    root.classList.add('is-playing');
  };

  const tick = (now) => {
    raf = 0;
    const dt = (last ? Math.min(64, now - last) : 16.7) / 1000;
    last = now;
    const vmax = TOP / MIN_S;
    vel += (OMEGA * OMEGA * (target - cur) - 2 * OMEGA * vel) * dt;
    vel = Math.max(-vmax, Math.min(vmax, vel));
    cur += vel * dt;
    if (Math.abs(target - cur) < 0.0005 && Math.abs(vel) < 0.002) { cur = target; vel = 0; }
    paint(cur);
    if (cur !== target) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  const at = (p) => Math.max(0, Math.min(1, (p - PLAY[0]) / (PLAY[1] - PLAY[0]))) * TOP;
  ctx.ScrollTrigger.create({
    trigger: view,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => { target = at(self.progress); kick(); },
    onRefresh: (self) => { target = at(self.progress); size(); kick(); },
  });

  // Load once the band is near (the hero's frames come first): frame 1, every 4th, then the rest.
  const load = (i) => new Promise((done) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => img.decode().catch(() => {}).finally(() => {
      frames[i] = { img, ok: true };
      if (i === 0 || sw === 1) size();
      painted = -1;
      kick();
      done();
    });
    img.onerror = () => done();
    img.src = url(i);
    frames[i] = { img, ok: false };
  });
  const order = [0];
  for (const step of [4, 1]) for (let i = 0; i < N; i += step) if (!order.includes(i)) order.push(i);
  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    cur = target; vel = 0; // start where the page already is, no glide from frame 0
    await load(order[0]);
    if (!ready(0)) return; // AVIF unsupported or offline: the poster stays
    for (let k = 1; k < order.length; k += 5) await Promise.all(order.slice(k, k + 5).map(load));
  }, { rootMargin: '100% 0px' });
  io.observe(view);
  window.addEventListener('resize', () => { size(); paint(cur); }, { passive: true }); // resizing clears the canvas
}
