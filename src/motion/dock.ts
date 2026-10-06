import { gsap } from 'gsap';
import { damp } from './glide';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { clamp01, fullMotion, reducedMotion, smooth } from './tokens';

// The "Questions? Talk to us" card shrinks into a small "Talk to us" dock (Maasoom's pick from a reel, 6 Oct 2026).
// Once the card is read, it holds still in the middle of the screen (sticky, dock.css) for a short stretch of scroll
// while it shrinks and glides into the dock at the bottom left; the dock then stays for the rest of the page and
// opens WhatsApp. Scrolling back up grows the card out of it again. Only the card's transform and opacities move
// (no layout, no repaint), heavily damped. Reduced motion, or a card too tall to hold on screen: the dock simply
// shows once the card has scrolled up past the middle of the screen.

const NAV = 56; // course.link's sticky navbar
const HOLD = 0.1; // the card first holds still at full size for this much scroll, in screen heights
const RUN = 0.42; // then the shrink takes this much (hold + run = the wrap's ::after, dock.css)
const TAU = 0.32; // s, each of the two damped stages
const FADE_AT = 0.82; // the card hands over to the dock from here to the end

type Rect = { x: number; y: number; w: number; h: number };

// The card's transform (origin at its centre) at shrink progress e (0..1): it first shrinks where it is, then
// glides to the dock while it finishes shrinking, ending the dock's size (by area) and centred on it.
export function morph(card: Rect, dock: Rect, e: number) {
  const end = Math.sqrt((dock.w * dock.h) / (card.w * card.h));
  const ts = smooth(clamp01(e / 0.85));
  const tp = smooth(clamp01((e - 0.25) / 0.75));
  return {
    x: (dock.x + dock.w / 2 - (card.x + card.w / 2)) * tp,
    y: (dock.y + dock.h / 2 - (card.y + card.h / 2)) * tp,
    s: Math.exp(Math.log(end) * ts), // even steps in size, never a sudden last shrink
  };
}

// The share of the shrink done when the page is scrolled to y: 0 until the card has stuck and held, 1 at the stretch's end.
export const shrinkAt = (y: number, start: number, run: number) => clamp01((y - start) / Math.max(1, run));

const ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 3.5c-4.7 0-8.5 3.4-8.5 7.6 0 2.4 1.2 4.5 3.1 5.9L6 20.5l3.7-2.1c.7.2 1.5.3 2.3.3 4.7 0 8.5-3.4 8.5-7.6S16.7 3.5 12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

function makeDock(href: string) {
  const a = document.createElement('a');
  a.className = 'cbg-dock';
  a.href = href;
  a.setAttribute('aria-label', 'Talk to us on WhatsApp');
  a.innerHTML = `${ICON}<span><b>Talk to us</b><small>WhatsApp</small></span>`;
  // Out of the flow inline (like ribbon.ts's layer): before our CSS lands it must not lengthen the page (a new
  // scrollbar would move course.link's navbar, e2e/native-home.spec.ts).
  a.style.position = 'fixed';
  document.body.append(a);
  return a;
}

function mount(section: HTMLElement, reduced: boolean): () => void {
  const wrap = section.querySelector<HTMLElement>('.cbg-wrap');
  const frame = section.querySelector<HTMLElement>('.cbg-frame');
  const plate = frame?.querySelector<HTMLElement>('.cbg-plate');
  const body = plate?.querySelector<HTMLElement>('.cbg-plate__body');
  const link = plate?.querySelector<HTMLAnchorElement>('.cbg-btn--primary');
  if (!wrap || !frame || !plate || !body || !link) return () => {};
  const win = section.ownerDocument.defaultView!;
  const dock = makeDock(link.href);
  let shown = false;
  const show = (on: boolean) => {
    if (on === shown) return;
    shown = on;
    dock.classList.toggle('is-on', on);
  };
  const off: (() => void)[] = [() => dock.remove()];

  // Reduced motion (and the fallback below): the dock shows once the card has scrolled above the screen's middle.
  const plain = () => {
    // (gone = above the middle of the screen: the page ends before the card is fully off it)
    const io = new IntersectionObserver(([e]) => e && show(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0)), { rootMargin: '-50% 0px 0px 0px' });
    io.observe(plate);
    return () => io.disconnect();
  };
  if (reduced) {
    off.push(plain());
    return () => off.forEach((f) => f());
  }

  // The hold changes the section's layout, so it is switched on only while the reader is above the section (as
  // gallery.ts waits to pin): a script arriving while the card is on screen would otherwise move it.
  let armed = section.getBoundingClientRect().top > win.innerHeight;
  const arm = new IntersectionObserver(([e]) => {
    if (armed || !e || e.isIntersecting || e.boundingClientRect.top < 0) return;
    armed = true;
    arm.disconnect();
    layout();
  });
  if (!armed) arm.observe(section);
  off.push(() => arm.disconnect());
  let fits = false;
  let start = 0; // scrollY at which the card sticks
  let run = 1;
  let card: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let target: Rect = card;
  let undoPlain: (() => void) | undefined;
  let m = 0; // first damped stage of the shrink
  let v = 0; // second stage
  let shownAt = -1; // what is drawn

  const draw = (e: number) => {
    if (e === shownAt || (Math.abs(e - shownAt) < 0.0005 && e > 0 && e < 1)) return; // the ends always land
    shownAt = e;
    const { x, y, s } = morph(card, target, e);
    plate.style.transform = e > 0 ? `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})` : '';
    plate.style.opacity = e > FADE_AT ? (1 - smooth((e - FADE_AT) / (1 - FADE_AT))).toFixed(3) : '';
    body.style.opacity = e > 0 ? (1 - smooth(clamp01(e / 0.3))).toFixed(3) : '';
    dock.style.opacity = e > FADE_AT ? smooth((e - FADE_AT) / (1 - FADE_AT)).toFixed(3) : '0';
    section.classList.toggle('is-docking', e > 0.02); // the card stops taking the pointer (dock.css)
    section.classList.toggle('is-docked', e > 0.999); // and, gone, leaves the tab order
    show(e > FADE_AT);
  };

  const layout = () => {
    const h = plate.offsetHeight;
    const vh = win.innerHeight;
    fits = armed && h <= vh - NAV - 32;
    if (!fits) {
      // Not yet armed, or too tall to hold on screen: no shrink, the dock just shows once the card has scrolled up
      // past the middle.
      if (!undoPlain) {
        section.classList.remove('is-dock', 'is-docking', 'is-docked');
        plate.style.transform = plate.style.opacity = body.style.opacity = dock.style.opacity = '';
        shownAt = -1;
        undoPlain = plain();
      }
      return;
    }
    undoPlain?.();
    undoPlain = undefined;
    const top = Math.max(NAV + 16, (vh + NAV - h) / 2);
    section.style.setProperty('--cbg-dock-top', `${top}px`);
    section.style.setProperty('--cbg-dock-run', `${Math.round(vh * (HOLD + RUN))}px`);
    section.classList.add('is-dock');
    run = Math.round(vh * RUN);
    start = wrap.getBoundingClientRect().top + win.scrollY - top + Math.round(vh * HOLD);
    card = { x: frame.getBoundingClientRect().left, y: top, w: plate.offsetWidth, h };
    const d = dock.getBoundingClientRect();
    target = { x: d.left, y: d.top, w: d.width, h: d.height };
    v = m = shrinkAt(win.scrollY, start, run);
    shownAt = -1;
    draw(m);
  };

  const sizes = new ResizeObserver(layout);
  sizes.observe(plate);
  sizes.observe(section.ownerDocument.documentElement); // the page above changing height moves the start
  win.addEventListener('resize', layout);
  off.push(() => {
    sizes.disconnect();
    win.removeEventListener('resize', layout);
    undoPlain?.();
    section.classList.remove('is-dock', 'is-docking', 'is-docked');
    section.style.removeProperty('--cbg-dock-top');
    section.style.removeProperty('--cbg-dock-run');
    plate.style.transform = plate.style.opacity = body.style.opacity = '';
  });
  layout();

  const tick = (_t: number, deltaMs: number) => {
    if (!fits) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const a = damp(dt, TAU);
    const p = shrinkAt(win.scrollY, start, run);
    m += (p - m) * a;
    v += (m - v) * a;
    if (Math.abs(v - p) < 0.0005) v = m = p;
    draw(v);
  };
  // Runs while the section is near the screen; away from it the shrink is simply done or undone.
  const io = new IntersectionObserver(([e]) => {
    if (!e) return;
    if (e.isIntersecting) gsap.ticker.add(tick);
    else {
      gsap.ticker.remove(tick);
      if (fits) draw((v = m = shrinkAt(win.scrollY, start, run)));
    }
  }, { rootMargin: '50% 0px' });
  io.observe(section);
  off.push(() => {
    io.disconnect();
    gsap.ticker.remove(tick);
  });
  return () => off.forEach((f) => f());
}

// The support section ([data-cbg-section="support"]). If the reduced-motion preference flips, matchMedia tears the
// dock down and builds it again in the other mode.
export const dock: Enhancer = (roots) => {
  const sections = all(roots, '[data-cbg-section="support"]');
  if (!sections.length) return;
  const mm = gsap.matchMedia();
  mm.add({ reduced: reducedMotion, full: fullMotion }, (ctx) => {
    const undo = sections.map((s) => mount(s, !!ctx.conditions?.reduced));
    return () => undo.forEach((f) => f());
  });
  return () => mm.revert();
};
