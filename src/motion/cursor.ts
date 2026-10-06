import { gsap } from 'gsap';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';
import { capStep, damp, finePointer, frameDt } from './glide';

// The home cursor (plain theme, picked 6 Oct 2026). Laptop mouse and full motion only. The real cursor stays; an
// off-white disc in difference blend trails it (so it inverts what is under it), shown only over the big text
// outside the hero and faded out everywhere else. Over a link in those places the disc fades to a small ring, so
// the link is never covered. Heavy damping (time constant 0.24 s) and a 1500 px/s cap: it never darts.
// It lives on <body> (like the sky canvas) so it is fixed to the screen whatever course.link wraps us in.
// While the page scrolls it steps aside (quickly) until the mouse moves again: a difference blend over a moving
// page made the Intel UHD laptop recomposite the whole screen through it every scroll frame (6 Oct 2026: 40 to
// 80 ms frames over the big text), and with the mouse still there is nothing for it to follow.

const REGIONS = [
  '[data-cbg-section="disciplines"]',
  '[data-cbg-section="how-it-works"] .cbg-section-head',
  '[data-cbg-section="courses"] .cbg-section-head',
  '[data-cbg-section="support"] h2', '[data-cbg-section="support"] .cbg-lead',
  '[data-cbg-section="about"] h2', '.cbg-about__body', '[data-cbg-section="about"] .cbg-link',
].join(',');
const STRIP = 'disciplines';
const PAD = 32; // px round a region's text that still counts as on it

export const TAU = 0.24; // s
export const MAX_SPEED = 1500; // px/s

export type CursorState = 'off' | 'on' | 'link';
type Box = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;

// Which state the pointer at (x, y) is in, given the region it is over (if any), that region's text box
// (the strip counts whole) and whether it is over a link or button.
export function stateAt(x: number, y: number, inRegion: boolean, box: Box | null, onLink: boolean): CursorState {
  if (!inRegion) return 'off';
  if (box && !(x > box.left - PAD && x < box.right + PAD && y > box.top - PAD && y < box.bottom + PAD)) return 'off';
  return onLink ? 'link' : 'on';
}

function follow(doc: Document) {
  const win = doc.defaultView!;
  const el = doc.createElement('div');
  el.className = 'cbg-cursor';
  el.setAttribute('aria-hidden', 'true');
  el.dataset.state = 'off';
  el.innerHTML = '<i class="cbg-cursor__disc"></i><i class="cbg-cursor__ring"></i>';
  doc.body.append(el);
  const r = 64; // half its 128px (night.css); measured, it would read 0 while it is display: none
  const range = doc.createRange();
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0, last = 0, dirty = false, seen = false;

  const hit = () => {
    const t = doc.elementFromPoint(tx, ty);
    const region = t?.closest<HTMLElement>(REGIONS);
    let box: Box | null = null;
    if (region && region.dataset.cbgSection !== STRIP) {
      range.selectNodeContents(region);
      box = range.getBoundingClientRect();
    }
    el.dataset.state = stateAt(tx, ty, !!region, box, !!t?.closest('a, button'));
  };

  const frame = (now: number) => {
    const dt = frameDt(now, last);
    last = now;
    if (dirty) {
      dirty = false;
      hit();
    }
    const k = damp(dt, TAU);
    const dx = (tx - x) * k, dy = (ty - y) * k;
    const c = capStep(dx, dy, MAX_SPEED * dt);
    x += dx * c;
    y += dy * c;
    el.style.transform = `translate3d(${(x - r).toFixed(1)}px,${(y - r).toFixed(1)}px,0)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.2 ? win.requestAnimationFrame(frame) : 0;
  };
  const wake = () => {
    dirty = true;
    if (raf) return;
    last = performance.now();
    raf = win.requestAnimationFrame(frame);
  };

  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  win.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX;
    ty = e.clientY;
    if (!seen) {
      seen = true;
      x = tx;
      y = ty;
    }
    wake();
  }, opts);
  win.addEventListener('scroll', () => { if (el.dataset.state !== 'off') el.dataset.state = 'hide'; }, opts);
  doc.documentElement.addEventListener('pointerleave', () => (el.dataset.state = 'off'), opts);

  return () => {
    off.abort();
    if (raf) win.cancelAnimationFrame(raf);
    el.remove();
  };
}

export const cursor: Enhancer = (roots) => {
  const doc = roots[0]?.ownerDocument;
  if (!doc || !doc.querySelector(REGIONS)) return;
  const mm = gsap.matchMedia();
  mm.add(`${fullMotion} and ${finePointer}`, () => follow(doc));
  return () => mm.revert();
};
