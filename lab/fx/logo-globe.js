// logo=globe: the About panel's CBG mark in front of a dark dotted cobe globe with gold markers on Doha, the
// Gulf capitals and the Indian cities CBG works in. Turns once every ~75 s, drags with heavy inertia, leans a few
// degrees toward the cursor. Paused off screen. Reduced motion: one still frame facing the Gulf.
import createGlobe from '../vendor/cobe.js';

const rad = (d) => (d * Math.PI) / 180;
// cobe's phi that brings a longitude to the front (from cobe's own "focus" demo)
const facing = (lon) => Math.PI - (rad(lon) - Math.PI / 2);

const GOLD = [0.84, 0.69, 0.38];
const DOHA = [25.29, 51.53];
const PLACES = [
  [DOHA, 0.06],
  [[25.2, 55.27], 0.035], [[24.71, 46.68], 0.035], [[23.59, 58.38], 0.032], // Dubai, Riyadh, Muscat
  [[29.38, 47.98], 0.032], [[26.23, 50.59], 0.02],                          // Kuwait City, Manama
  [[9.93, 76.27], 0.035], [[19.08, 72.88], 0.035], [[28.7, 77.1], 0.035], [[12.97, 77.59], 0.032], // Kochi, Mumbai, Delhi, Bengaluru
];

export default function mount(ctx) {
  const panel = document.querySelector('#cbg-about .cbg-logos');
  const img = panel?.querySelector('.cbg-logo');
  if (!panel || !img) return;

  panel.classList.add('lab-logo-globe');
  const stage = document.createElement('div');
  stage.className = 'lab-logo-globe-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = `<div class="lab-logo-globe-orb"><canvas class="lab-logo-globe-canvas"></canvas>
<span class="lab-logo-globe-medal"><img src="${ctx.site('brand/cbg-mark-900.webp')}" alt="" width="900" height="900" decoding="async"></span></div>`;
  panel.prepend(stage);
  const canvas = stage.querySelector('canvas');

  const dpr = Math.min(devicePixelRatio || 1, ctx.fine ? 1.5 : 1);
  let size = canvas.offsetWidth || 400;
  const PHI0 = facing(80); // the Gulf on the lit left, India at centre; the spin carries them slowly rightward
  const THETA0 = 0.3;

  const globe = createGlobe(canvas, {
    devicePixelRatio: dpr, width: size, height: size,
    phi: PHI0, theta: THETA0,
    dark: 1, diffuse: 1.1, mapSamples: 16000, mapBrightness: 3, mapBaseBrightness: 0.02,
    baseColor: [0.16, 0.24, 0.42], markerColor: GOLD, glowColor: [0.1, 0.18, 0.38],
    markerElevation: 0.01, arcColor: GOLD, arcWidth: 0.35, arcHeight: 0.18,
    markers: PLACES.map(([location, s]) => ({ location, size: s })),
    arcs: PLACES.slice(6).map(([to]) => ({ from: DOHA, to })),
  });
  // No WebGL: cobe hands back no-ops; keep today's flat mark.
  if (!(canvas.getContext('webgl2') || canvas.getContext('webgl'))) { panel.classList.remove('lab-logo-globe'); stage.remove(); return; }
  panel.classList.add('is-ready');

  new ResizeObserver(() => {
    const s = canvas.offsetWidth;
    if (s && s !== size) { size = s; globe.update({ width: s, height: s }); }
  }).observe(canvas);

  // Reduced motion: one still frame facing the Gulf, drawn when the panel arrives (cobe's first draw can predate
  // its map texture).
  if (ctx.reduced) { new IntersectionObserver(([e]) => e.isIntersecting && globe.update({})).observe(panel); return; }

  // ---- motion: everything eases toward targets with long time constants ----
  const SPIN = (Math.PI * 2) / 75;     // rad/s: one turn every 75 s
  const MAX_V = 0.9;                   // rad/s cap on a flick
  let phiT = PHI0, phi = PHI0;         // target and shown rotation
  let v = 0;                           // flick velocity, decays slowly
  let leanX = 0, leanY = 0, lx = 0, ly = 0; // cursor lean target and shown
  let drag = null;                     // { x, t, v }

  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, t: performance.now(), v: 0 };
    canvas.setPointerCapture(e.pointerId);
    panel.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const now = performance.now();
    const d = (e.clientX - drag.x) / 260; // 260 px of drag ≈ 1 rad
    phiT += d;
    drag.v = drag.v * 0.7 + (d / Math.max(16, now - drag.t)) * 1000 * 0.3;
    drag.x = e.clientX; drag.t = now;
  });
  const release = () => {
    if (!drag) return;
    v = Math.max(-MAX_V, Math.min(MAX_V, drag.v));
    drag = null;
    panel.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release); // phones: a vertical swipe becomes a scroll

  if (ctx.fine) {
    const about = document.getElementById('cbg-about');
    about.addEventListener('pointermove', (e) => {
      const r = panel.getBoundingClientRect();
      leanX = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
      leanY = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
    });
    about.addEventListener('pointerleave', () => { leanX = leanY = 0; });
  }

  let raf = 0, last = 0, onScreen = false;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!drag) {
      phiT += (SPIN + v) * dt;
      v *= Math.exp(-dt / 1.6); // a flick glides for a few seconds
    }
    phi += (phiT - phi) * (1 - Math.exp(-dt / 0.35));
    const k = 1 - Math.exp(-dt / 1.1); // heavy lean smoothing
    lx += (leanX - lx) * k; ly += (leanY - ly) * k;
    globe.update({ phi: phi + lx * rad(6), theta: THETA0 + ly * rad(4) });
    stage.style.setProperty('--lx', lx.toFixed(4));
    stage.style.setProperty('--ly', ly.toFixed(4));
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    const go = onScreen && !document.hidden;
    if (go && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!go && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(); }).observe(panel);
  document.addEventListener('visibilitychange', run);
}
