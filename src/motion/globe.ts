import { gsap } from 'gsap';
import createGlobe from 'cobe';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion, reducedMotion } from './tokens';
import { damp, finePointer, frameDt } from './glide';

// The About panel's CBG mark in front of a dark dotted globe (cobe, MIT; picked 6 Oct 2026): gold markers on Doha
// (largest), the Gulf capitals and the Indian cities CBG works in, gold arcs from Doha to India. It turns once
// every 75 s, can be dragged sideways (damped, with a capped glide after a flick), and on a laptop leans a few
// degrees toward the cursor. Paused off screen and in a background tab. Reduced motion: one still frame facing
// the Gulf. No WebGL: the flat mark stays (night.css shows the globe only once .is-ready).

const rad = (d: number) => (d * Math.PI) / 180;
// cobe's phi that brings a longitude to the front (from cobe's own "focus" demo).
export const facing = (lon: number) => Math.PI - (rad(lon) - Math.PI / 2);

type LatLon = [number, number];
const GOLD: [number, number, number] = [0.84, 0.69, 0.38];
const DOHA: LatLon = [25.29, 51.53];
const GULF: [LatLon, number][] = [
  [DOHA, 0.06],
  [[25.2, 55.27], 0.035], [[24.71, 46.68], 0.035], [[23.59, 58.38], 0.032], // Dubai, Riyadh, Muscat
  [[29.38, 47.98], 0.032], [[26.23, 50.59], 0.02], // Kuwait City, Manama
];
const INDIA: [LatLon, number][] = [
  [[9.93, 76.27], 0.035], [[19.08, 72.88], 0.035], [[28.7, 77.1], 0.035], [[12.97, 77.59], 0.032], // Kochi, Mumbai, Delhi, Bengaluru
];

const PHI0 = facing(80); // the Gulf on the lit left, India at centre; the turn carries them slowly rightward
const THETA0 = 0.3;
export const SPIN = (Math.PI * 2) / 75; // rad/s: one turn every 75 s
export const MAX_FLICK = 0.9; // rad/s: the most a flick adds
export const DRAG_PX = 260; // px of drag per radian

// A flick's speed after letting go: the drag's smoothed speed, capped.
export const flick = (v: number) => Math.max(-MAX_FLICK, Math.min(MAX_FLICK, v));

// The lean target (-1..1) for a pointer `d` px from the panel's centre, over half the screen `half` px.
export const lean = (d: number, half: number) => Math.max(-1, Math.min(1, d / Math.max(1, half)));

type Conditions = { full?: boolean; reduce?: boolean; fine?: boolean };

function mount(panel: HTMLElement, stage: HTMLElement, { full, fine }: Conditions) {
  const win = panel.ownerDocument.defaultView!;
  const canvas = stage.querySelector('canvas');
  const medal = stage.querySelector<HTMLElement>('.cbg-globe__medal');
  if (!canvas) return () => {};
  let size = canvas.offsetWidth || 400;
  const globe = createGlobe(canvas, {
    devicePixelRatio: Math.min(win.devicePixelRatio || 1, fine ? 1.5 : 1), width: size, height: size,
    phi: PHI0, theta: THETA0,
    dark: 1, diffuse: 1.1, mapSamples: 16000, mapBrightness: 3, mapBaseBrightness: 0.02,
    baseColor: [0.16, 0.24, 0.42], markerColor: GOLD, glowColor: [0.1, 0.18, 0.38],
    markerElevation: 0.01, arcColor: GOLD, arcWidth: 0.35, arcHeight: 0.18,
    markers: [...GULF, ...INDIA].map(([location, s]) => ({ location, size: s })),
    arcs: INDIA.map(([to]) => ({ from: DOHA, to })),
  });
  if (!(canvas.getContext('webgl2') || canvas.getContext('webgl'))) return () => globe.destroy();
  panel.classList.add('is-ready');

  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  const sizes = new ResizeObserver(() => {
    const s = canvas.offsetWidth;
    if (s && s !== size) {
      size = s;
      globe.update({ width: s, height: s });
    }
  });
  sizes.observe(canvas);
  let raf = 0, last = 0, onScreen = false;
  let io: IntersectionObserver | undefined;
  const done = () => {
    off.abort();
    sizes.disconnect();
    io?.disconnect();
    if (raf) win.cancelAnimationFrame(raf);
    globe.destroy();
    panel.classList.remove('is-ready', 'is-dragging');
    if (medal) medal.style.transform = '';
  };

  // Reduced motion: the still frame, redrawn when the panel arrives (cobe's first draw can predate its map).
  if (!full) {
    io = new IntersectionObserver(([e]) => e?.isIntersecting && globe.update({}));
    io.observe(panel);
    return done;
  }

  // Everything eases toward targets with long time constants.
  let phiT = PHI0, phi = PHI0, v = 0; // target and shown turn; flick speed, decaying
  let leanX = 0, leanY = 0, lx = 0, ly = 0; // lean target and shown
  let drag: { x: number; t: number; v: number } | null = null;
  const view = { phi: PHI0, theta: THETA0 }; // reused every frame

  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, t: performance.now(), v: 0 };
    canvas.setPointerCapture(e.pointerId);
    panel.classList.add('is-dragging');
  }, opts);
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const now = performance.now();
    const d = (e.clientX - drag.x) / DRAG_PX;
    phiT += d;
    drag.v = drag.v * 0.7 + (d / Math.max(16, now - drag.t)) * 1000 * 0.3;
    drag.x = e.clientX;
    drag.t = now;
  }, opts);
  const release = () => {
    if (!drag) return;
    v = flick(drag.v);
    drag = null;
    panel.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', release, opts);
  canvas.addEventListener('pointercancel', release, opts); // phones: a vertical swipe becomes a scroll

  if (fine) {
    const area = panel.closest<HTMLElement>('section') ?? panel;
    area.addEventListener('pointermove', (e) => {
      const r = panel.getBoundingClientRect();
      leanX = lean(e.clientX - (r.left + r.width / 2), win.innerWidth / 2);
      leanY = lean(e.clientY - (r.top + r.height / 2), win.innerHeight / 2);
    }, opts);
    area.addEventListener('pointerleave', () => (leanX = leanY = 0), opts);
  }

  const frame = (now: number) => {
    const dt = frameDt(now, last);
    last = now;
    if (!drag) {
      phiT += (SPIN + v) * dt;
      v *= 1 - damp(dt, 1.6); // a flick glides for a few seconds
    }
    phi += (phiT - phi) * damp(dt, 0.35);
    const k = damp(dt, 1.1); // heavy lean smoothing
    lx += (leanX - lx) * k;
    ly += (leanY - ly) * k;
    view.phi = phi + lx * rad(6);
    view.theta = THETA0 + ly * rad(4);
    globe.update(view);
    // The medallion drifts a few px against the lean, so it reads as nearer than the globe.
    if (medal && fine) medal.style.transform = `translate3d(calc(-50% + ${(lx * -6).toFixed(2)}px),${(ly * -4).toFixed(2)}px,0)`;
    raf = win.requestAnimationFrame(frame);
  };
  const run = () => {
    const go = onScreen && !panel.ownerDocument.hidden && !off.signal.aborted;
    if (go && !raf) {
      last = performance.now();
      raf = win.requestAnimationFrame(frame);
    } else if (!go && raf) {
      win.cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  io = new IntersectionObserver(([e]) => {
    onScreen = !!e?.isIntersecting;
    run();
  });
  io.observe(panel);
  panel.ownerDocument.addEventListener('visibilitychange', run, opts);
  return done;
}

export const globe: Enhancer = (roots) => {
  const stage = all(roots, '[data-cbg-globe]')[0];
  const panel = stage?.parentElement;
  if (!stage || !panel) return;
  const mm = gsap.matchMedia();
  mm.add({ full: fullMotion, reduce: reducedMotion, fine: finePointer }, (ctx) => mount(panel, stage, ctx.conditions as Conditions));
  return () => mm.revert();
};
