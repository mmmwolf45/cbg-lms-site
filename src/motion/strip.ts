import { gsap } from 'gsap';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { clamp01, fullMotion, smooth } from './tokens';
import { damp, finePointer, frameDt } from './glide';

// The course-names strip (#cbg-disciplines, decorative), plain theme (picked 6 Oct 2026). The template splits
// the titles into letters; night.css draws them outlined. Full motion: each title rises in letter by letter the
// first time it is on screen (a CSS transition, started by .is-in). Laptop mouse: letters near the cursor fill
// gold, driven by distance with a 0.6 s time constant, so the gold swells and fades instead of switching on and
// off. Colour only, no layout. The scroll drift stays motion.css's. Phones: the rise only. Reduced: still.

export const REACH = 190; // px from the cursor where the gold starts
export const TAU = 0.6; // s

// Gold (0..1) for a letter dx, dy px from the cursor. Vertical distance counts 1.4x: the strip is wide and short.
export const glow = (dx: number, dy: number) => smooth(clamp01(1 - Math.hypot(dx, dy * 1.4) / REACH));

// The rise: once per title, from 25% above the bottom of the screen (a margin, not a ratio: a long title on a
// phone is never wholly on screen). .is-in stays after a teardown, so a re-setup never hides a title again.
function rise(names: HTMLElement[]) {
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      e.target.classList.add('is-in');
    }
  }, { rootMargin: '0px 0px -25% 0px' });
  for (const n of names) if (!n.classList.contains('is-in')) io.observe(n);
  return () => io.disconnect();
}

function gold(marquee: HTMLElement) {
  const win = marquee.ownerDocument.defaultView!;
  const area = marquee.closest<HTMLElement>('section') ?? marquee;
  const track = marquee.querySelector<HTMLElement>('.cbg-marquee__track');
  const els = [...marquee.querySelectorAll<HTMLElement>('.cbg-strip__n > span')];
  if (!track || !els.length) return () => {};
  const n = els.length;
  const xs = new Float32Array(n), ys = new Float32Array(n), ks = new Float32Array(n);
  const FAR = -1e5;
  let px = FAR, py = FAR, ox = 0, oy = 0; // pointer and the track's origin, both in viewport px
  let raf = 0, last = 0, fresh = false;

  // Letter centres relative to the track (night.css makes it their offsetParent): offsets ignore transforms, so a
  // letter still rising and the scroll drift never skew them. The drift moves the track, read as its origin.
  // Measured when the mouse arrives (a late web font or a resize moves the letters), not per move.
  const measure = () => {
    for (let i = 0; i < n; i++) {
      const el = els[i]!;
      xs[i] = el.offsetLeft + el.offsetWidth / 2;
      ys[i] = el.offsetTop + el.offsetHeight / 2;
    }
  };
  const origin = () => {
    const r = track.getBoundingClientRect();
    ox = r.left;
    oy = r.top;
  };

  const frame = (now: number) => {
    const a = damp(frameDt(now, last), TAU);
    last = now;
    let busy = false;
    for (let i = 0; i < n; i++) {
      const goal = glow(ox + xs[i]! - px, oy + ys[i]! - py);
      let k = ks[i]!;
      if (k === goal) continue;
      if (Math.abs(goal - k) < 0.002) k = goal;
      else {
        k += (goal - k) * a;
        busy = true;
      }
      ks[i] = k;
      els[i]!.style.setProperty('--k', k.toFixed(3));
    }
    raf = busy ? win.requestAnimationFrame(frame) : 0;
  };
  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = win.requestAnimationFrame(frame);
  };

  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  area.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!fresh) measure();
    fresh = true;
    px = e.clientX;
    py = e.clientY;
    origin();
    wake();
  }, opts);
  area.addEventListener('pointerleave', () => {
    px = py = FAR;
    fresh = false;
    wake();
  }, opts);
  // The strip slides under a still mouse as the page scrolls.
  win.addEventListener('scroll', () => {
    if (px === FAR) return;
    origin();
    wake();
  }, opts);
  win.addEventListener('resize', () => (fresh = false), opts);

  return () => {
    off.abort();
    if (raf) win.cancelAnimationFrame(raf);
    for (const el of els) el.style.removeProperty('--k');
  };
}

export const strip: Enhancer = (roots) => {
  const marquee = all(roots, '.cbg-strip')[0];
  if (!marquee) return;
  const names = [...marquee.querySelectorAll<HTMLElement>('.cbg-strip__n')];
  const mm = gsap.matchMedia();
  mm.add(fullMotion, () => rise(names));
  mm.add(`${fullMotion} and ${finePointer}`, () => gold(marquee));
  return () => mm.revert();
};
