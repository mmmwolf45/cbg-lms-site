// The course-names strip (#cbg-disciplines, decorative, aria-hidden), lab prototype (lab/README.md).
// plain: large outlined names; letters near the mouse fill gold (driven by distance instead of :hover, with
//   heavy damping, so it fades smoothly; colour only, no layout). Each name rises in letter by letter the
//   first time it is seen (a CSS transition, strip.css). The scroll drift is still home.css/motion.css's.
// blueprint: a star map. A star per course (gold for live courses), its name beside it, gold hairlines
//   joining the stars; drift and line draw-in are CSS scroll-driven animations (strip.css).
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export default function mount(ctx) {
  const section = document.querySelector('#cbg-disciplines');
  const marquee = section?.querySelector('.cbg-marquee');
  if (!marquee) return;
  if (ctx.state.theme === 'blueprint') starMap(marquee);
  else kinetic(ctx, section, marquee);
}

function starMap(marquee) {
  const names = [...marquee.querySelectorAll('.cbg-marquee__set:first-child > span')].map((s) => s.textContent);
  const live = new Set([...document.querySelectorAll('.cbg-course--live .cbg-h3')].map((h) => h.textContent.trim()));
  const Y = [0.66, 0.3, 0.6, 0.24, 0.7, 0.36];
  const pts = names.map((_, i) => [0.1 + (0.78 * i) / Math.max(1, names.length - 1), Y[i % Y.length]]);
  const map = document.createElement('div');
  map.className = 'lab-strip-map';
  map.innerHTML = '<svg aria-hidden="true"></svg>' + names.map((n, i) => `<span class="lab-strip-star${live.has(n) ? ' is-live' : ''}" style="--i:${i};left:${pts[i][0] * 100}%;top:${pts[i][1] * 100}%"><i></i><b></b></span>`).join('');
  map.querySelectorAll('b').forEach((b, i) => { b.textContent = names[i]; });
  marquee.classList.add('lab-strip-sky');
  marquee.append(map);
  const svg = map.querySelector('svg');
  // Background stars from a fixed seed, so every load draws the same sky.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dust = Array.from({ length: 44 }, () => [rnd(), rnd(), 0.5 + rnd() * 0.8, 0.12 + rnd() * 0.35]);
  // Pixel coordinates so the hairlines stay 1px and pathLength draws them evenly; redrawn on resize.
  new ResizeObserver(() => {
    const w = map.clientWidth, h = map.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = dust.map(([x, y, r, o]) => `<circle cx="${(x * w).toFixed(1)}" cy="${(y * h).toFixed(1)}" r="${r.toFixed(2)}" fill="#F3F5F9" opacity="${o.toFixed(2)}"/>`).join('')
      + pts.slice(1).map(([x, y], i) => `<line class="lab-strip-seg" style="--i:${i}" pathLength="1" x1="${pts[i][0] * w}" y1="${pts[i][1] * h}" x2="${x * w}" y2="${y * h}"/>`).join('');
  }).observe(map);
}

function kinetic(ctx, section, marquee) {
  marquee.classList.add('lab-strip-plain');
  const track = marquee.querySelector('.cbg-marquee__track');
  const words = [...marquee.querySelectorAll('.cbg-marquee__set > span')].map((name) => {
    const text = name.textContent, n = text.replace(/ /g, '').length;
    name.textContent = '';
    const ls = [];
    for (const ch of text) {
      if (ch === ' ') { name.append(Object.assign(document.createElement('span'), { textContent: ' ' })); continue; } // the name is a flex box: bare spaces collapse
      const l = document.createElement('span');
      l.className = 'lab-strip-l';
      l.textContent = ch;
      l.style.setProperty('--d', `${((0.6 * ls.length) / Math.max(1, n - 1)).toFixed(3)}s`); // stagger: 0.6 s across the name
      name.append(l);
      ls.push({ el: l, k: 0, x: 0, y: 0 });
    }
    return { name, ls };
  });
  if (ctx.reduced) return;
  const letters = words.flatMap((w) => w.ls);

  // Hidden until seen, then each name rises in letter by letter (strip.css, about 1.5 s in all).
  marquee.classList.add('lab-strip-reveal');
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      e.target.classList.add('is-in');
      if (ctx.fine) setTimeout(measure, 1600); // re-measure once the letters have risen to rest
    }
  }, { threshold: 0, rootMargin: '0px 0px -25% 0px' }); // not a ratio: a long name on a phone never reaches one
  words.forEach((w) => io.observe(w.name));

  // Letter centres at rest, relative to the track (the drift moves the track, not the letters).
  function measure() {
    const t = track.getBoundingClientRect();
    for (const l of letters) {
      const r = l.el.getBoundingClientRect();
      l.x = r.left + r.width / 2 - t.left;
      l.y = r.top + r.height / 2 - t.top;
    }
  }
  if (!ctx.fine) return;
  let px = -1e5, py = -1e5;
  document.fonts.ready.then(measure);
  addEventListener('resize', measure, { passive: true });
  section.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { px = e.clientX; py = e.clientY; wake(); } });
  section.addEventListener('pointerleave', () => { px = py = -1e5; wake(); });
  section.addEventListener('wheel', wake, { passive: true }); // the strip slides under a still mouse

  // Gold fill near the mouse: colour only, damped with a 0.6 s time constant; the loop sleeps when settled.
  let raf = 0, last = 0;
  function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let busy = false;
    const tr = track.getBoundingClientRect(), a = 1 - Math.exp(-dt / 0.6), R = 190;
    for (const l of letters) {
      const dx = tr.left + l.x - px, dy = (tr.top + l.y - py) * 1.4;
      const target = smooth(1 - Math.hypot(dx, dy) / R);
      if (Math.abs(target - l.k) < 0.002) { if (l.k !== target) { l.k = target; l.el.style.setProperty('--k', target); } continue; }
      l.k += (target - l.k) * a;
      l.el.style.setProperty('--k', l.k.toFixed(3));
      busy = true;
    }
    raf = busy ? requestAnimationFrame(frame) : 0;
  }
}
