// Scrubs the IOSH film frames with scroll through .story. No scroll listener: an IntersectionObserver
// starts a rAF loop only while the story is on screen; the loop reads the section's position, eases the
// film toward it on a critically damped spring (no overshoot) and cross-fades the two nearest frames.
// Reduced motion: the poster only, no frames load.
const N = 40;
const OMEGA = 4; // rad/s: settles ~1.2 s after the scroll stops

const story = document.querySelector('.story');
const film = document.querySelector('.film');
const canvas = film.querySelector('canvas');
const bar = document.querySelector('.track i');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const dpr = Math.min(devicePixelRatio || 1, 2);
const dir = film.clientWidth * dpr > 620 ? 'l' : 's';
const url = (i) => `./frames/${dir}/f${String(i + 1).padStart(2, '0')}.avif`;

const progress = () => {
  const r = story.getBoundingClientRect();
  return Math.max(0, Math.min(1, -r.top / (r.height - innerHeight)));
};

if (reduced) {
  bar.style.transform = 'scaleX(1)';
} else {
  const g = canvas.getContext('2d', { alpha: false });
  const frames = Array.from({ length: N }, (_, i) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = url(i);
    const f = { img, ok: false };
    img.decode().then(() => { f.ok = true; painted = -1; }, () => {});
    return f;
  });
  let cur = progress(), vel = 0, painted = -1, last = 0, raf = 0, onScreen = false;

  const size = () => {
    const w = Math.round(film.clientWidth * dpr);
    if (canvas.width !== w) { canvas.width = canvas.height = w; painted = -1; }
  };
  const nearest = (i) => { for (let d = 0; d < N; d++) for (const j of [i - d, i + d]) if (frames[j]?.ok) return j; return -1; };
  const paint = (p) => {
    if (Math.abs(p - painted) < 0.0005) return;
    const x = p * (N - 1), a = Math.min(N - 2, Math.floor(x)), t = x - a;
    if (frames[a].ok && frames[a + 1].ok) {
      g.globalAlpha = 1; g.drawImage(frames[a].img, 0, 0, canvas.width, canvas.height);
      if (t > 0.01) { g.globalAlpha = t; g.drawImage(frames[a + 1].img, 0, 0, canvas.width, canvas.height); }
    } else {
      const j = nearest(Math.round(x));
      if (j < 0) return;
      g.globalAlpha = 1; g.drawImage(frames[j].img, 0, 0, canvas.width, canvas.height);
    }
    painted = p;
    canvas.dataset.frame = x.toFixed(2); // screenshots read it
    film.classList.add('is-playing');
  };
  const tick = (now) => {
    raf = 0;
    const dt = (last ? Math.min(64, now - last) : 16.7) / 1000;
    last = now;
    const target = progress();
    vel += (OMEGA * OMEGA * (target - cur) - 2 * OMEGA * vel) * dt;
    cur += vel * dt;
    if (Math.abs(target - cur) < 0.0005 && Math.abs(vel) < 0.002) { cur = target; vel = 0; }
    bar.style.transform = `scaleX(${cur.toFixed(4)})`;
    paint(cur);
    if (onScreen || cur !== target) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !raf) raf = requestAnimationFrame(tick);
  }).observe(story);
  new ResizeObserver(size).observe(film);
  size();
  // Test hook: jump straight to the scroll position (no easing), for screenshots.
  window.__filmSettle = () => { cur = progress(); vel = 0; painted = -1; paint(cur); bar.style.transform = `scaleX(${cur})`; return canvas.dataset.frame; };
}
