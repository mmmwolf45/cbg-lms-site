import { gsap } from 'gsap';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';
import { capStep, damp, finePointer, frameDt } from './glide';

// The support card (.cbg-plate), approved prototype (6 Oct 2026). Light layers are in the template; night.css
// draws them.
//   Everywhere with motion: a slow, faint gold light travels round the border (CSS), only while the card is on
//     screen (.is-on, set here), gone while the page scrolls (.is-moving, until 0.6 s after).
//   Laptop mouse: the photo layer tilts toward the pointer (4deg / 5deg at most, heavily damped, slower still on
//     the way back); the text and buttons stay flat, so they stay crisp and clickable. A soft gold spotlight
//     trails the cursor at no more than 800 px/s, and a faint glare drifts with it.
//   Reduced motion: a still gold edge (CSS), nothing here runs.

export const MAX_TILT = { x: 4, y: 5 }; // deg
export const SPOT_SPEED = 800; // px/s
export const GLIDE_IN_MS = 1400; // the spotlight takes this long to fade out (night.css)

// The tilt (deg) for a pointer at nx, ny (each 0..1 across the card): the side under the pointer dips away.
export const tiltX = (ny: number) => (0.5 - ny) * 2 * MAX_TILT.x;
export const tiltY = (nx: number) => (nx - 0.5) * 2 * MAX_TILT.y;

// On entering, the spotlight appears under the pointer, unless it is still fading out from a moment ago:
// then it glides over from where it is, so it never jumps.
export const startsUnderPointer = (sinceLeft: number) => sinceLeft > GLIDE_IN_MS;

function border(plate: HTMLElement) {
  const win = plate.ownerDocument.defaultView!;
  const io = new IntersectionObserver(([e]) => plate.classList.toggle('is-on', !!e?.isIntersecting));
  io.observe(plate);
  let still = 0;
  const moving = () => {
    if (!plate.classList.contains('is-on')) return;
    plate.classList.add('is-moving');
    clearTimeout(still);
    still = win.setTimeout(() => plate.classList.remove('is-moving'), 600);
  };
  win.addEventListener('scroll', moving, { passive: true });
  return () => {
    io.disconnect();
    win.removeEventListener('scroll', moving);
    clearTimeout(still);
    plate.classList.remove('is-on', 'is-moving');
  };
}

function light(plate: HTMLElement) {
  const win = plate.ownerDocument.defaultView!;
  const bg = plate.querySelector<HTMLElement>('.cbg-plate__bg');
  const spot = plate.querySelector<HTMLElement>('.cbg-plate__spot');
  const glare = plate.querySelector<HTMLElement>('.cbg-plate__glare');
  if (!bg || !spot || !glare) return () => {};
  plate.classList.add('is-fine');
  const half = spot.offsetWidth / 2;
  let w = 1, h = 1, px = 0, py = 0, inside = false, leftAt = -1e9;
  let x = 0, y = 0, rx = 0, ry = 0; // shown
  let raf = 0, last = 0;

  // While the page scrolls (.is-moving, border()) the card is flat and takes no pointer: a card scrolling under a
  // still mouse got synthetic pointer moves, and its live 3D tilt cost the Intel UHD laptop every scroll frame.
  const scrolling = () => plate.classList.contains('is-moving');
  const flat = () => {
    if (!bg.style.transform) return;
    rx = ry = 0;
    bg.style.transform = '';
  };
  const frame = (now: number) => {
    if (scrolling()) return void (raf = 0);
    const dt = frameDt(now, last);
    last = now;
    const kp = damp(dt, 0.31); // spotlight: a soft trail
    const kt = damp(dt, inside ? 0.5 : 0.9); // tilt: heavier, and slower on the way back
    let dx = (px - x) * kp, dy = (py - y) * kp;
    const c = capStep(dx, dy, SPOT_SPEED * dt);
    x += dx * c;
    y += dy * c;
    const gx = inside ? tiltX(py / h) : 0, gy = inside ? tiltY(px / w) : 0;
    rx += (gx - rx) * kt;
    ry += (gy - ry) * kt;
    bg.style.transform = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`; // the photo is 7% larger by layout (night.css)
    spot.style.transform = `translate3d(${(x - half).toFixed(1)}px,${(y - half).toFixed(1)}px,0)`;
    glare.style.transform = `translate3d(${((x / w - 0.5) * 30).toFixed(2)}%,0,0)`;
    const busy = Math.abs(px - x) + Math.abs(py - y) > 0.3 || Math.abs(gx - rx) + Math.abs(gy - ry) > 0.005;
    raf = busy ? win.requestAnimationFrame(frame) : 0;
    if (!busy && !inside) bg.style.transform = ''; // flat again: no standing 3D layer
  };
  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = win.requestAnimationFrame(frame);
  };
  const track = (e: PointerEvent) => {
    const r = plate.getBoundingClientRect();
    w = r.width || 1;
    h = r.height || 1;
    px = e.clientX - r.left;
    py = e.clientY - r.top;
  };

  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  plate.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || scrolling()) return;
    track(e);
    if (!inside && startsUnderPointer(performance.now() - leftAt)) {
      x = px;
      y = py;
    }
    inside = true;
    plate.classList.add('is-lit');
    wake();
  }, opts);
  plate.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || scrolling()) return;
    track(e);
    wake();
  }, opts);
  win.addEventListener('scroll', flat, opts);
  plate.addEventListener('pointerleave', () => {
    if (!inside) return;
    inside = false;
    leftAt = performance.now();
    plate.classList.remove('is-lit');
    wake();
  }, opts);

  return () => {
    off.abort();
    if (raf) win.cancelAnimationFrame(raf);
    plate.classList.remove('is-fine', 'is-lit');
    for (const el of [bg, spot, glare]) el.style.transform = '';
  };
}

export const support: Enhancer = (roots) => {
  const plates = all(roots, '.cbg-plate');
  if (!plates.length) return;
  const mm = gsap.matchMedia();
  mm.add(fullMotion, () => {
    const undo = plates.map(border);
    return () => undo.forEach((f) => f());
  });
  mm.add(`${fullMotion} and ${finePointer}`, () => {
    const undo = plates.map(light);
    return () => undo.forEach((f) => f());
  });
  return () => mm.revert();
};
