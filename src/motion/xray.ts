import { gsap } from 'gsap';
import type { Enhancer } from './setup';
import { reducedMotion } from './tokens';

// Rebar X-ray on the QS page (templates/sections/course-xray.ts, src/styles/xray.css). The script only
// writes --x (the band's centre, % of the photo) on the figure and lights the labels inside the band.
// Laptop (hover + fine pointer): the band sweeps to the middle once when the photo comes into view,
// then follows the cursor. Phone and touch: the scroll sweeps it from left to right as the photo
// passes up the screen. Both: the photo is a slider, arrow keys move the band. Reduced motion: the
// script does nothing and the CSS static split (every label showing) stays.

export const clamp = (v: number) => Math.min(100, Math.max(0, v));

// A label lights while its point is inside the band.
export const inBand = (lx: number, x: number, w: number) => Math.abs(lx - x) < w / 2;

// The slider's spoken value: where the band is and which labelled steel it shows.
export const valueText = (x: number, names: string[]) =>
  `Scan at ${Math.round(x)}%: ${names.length ? names.join(', ') : 'no labelled steel'}`;

// Slider keys: arrows by 5, Page Up/Down by 20, Home and End to the edges. Other keys: undefined.
export function keyTarget(key: string, x: number) {
  const by: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 20, PageDown: -20 };
  if (key === 'Home') return 0;
  if (key === 'End') return 100;
  return key in by ? clamp(x + by[key]) : undefined;
}

const PARK = 50; // where the laptop intro sweep leaves the band: over the column, every label lit

export const xray: Enhancer = (roots) => {
  const box = roots.map((r) => r.querySelector<HTMLElement>('[data-cbg-xray]')).find(Boolean);
  const hit = box?.querySelector<HTMLElement>('.cbg-xray__hit');
  if (!box || !hit) return;
  const tags = [...box.querySelectorAll<HTMLElement>('.cbg-xray__tag')];
  const lx = tags.map((t) => Number(t.dataset.cbgX));
  const names = tags.map((t) => t.textContent ?? '');
  const still = matchMedia(reducedMotion);
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  const live = () => {
    const off = new AbortController();
    const on = (t: EventTarget, type: string, fn: (e: Event) => void) => t.addEventListener(type, fn, { signal: off.signal });
    box.classList.add('is-live');
    hit.hidden = false;
    let w = 22;
    const measure = () => (w = parseFloat(getComputedStyle(box).getPropertyValue('--w')) || w);
    measure();
    const p = { x: 0 };
    let target = 0;
    let touched = false; // the student has moved the band: the intro sweep no longer runs
    let said = -1;
    const lit = tags.map(() => false);
    // Keys and the pointer say their target once, so a screen reader hears one value per press rather
    // than every step of the glide; the intro sweep and the scroll say where the band is as it moves.
    const say = (x: number) => {
      const v = Math.round(x);
      if (v === said) return;
      said = v;
      hit.setAttribute('aria-valuenow', String(v));
      hit.setAttribute('aria-valuetext', valueText(v, names.filter((_, i) => inBand(lx[i], x, w))));
    };
    const apply = (speak = false) => {
      box.style.setProperty('--x', p.x.toFixed(2));
      tags.forEach((t, i) => {
        const now = inBand(lx[i], p.x, w);
        if (now !== lit[i]) t.classList.toggle('is-lit', (lit[i] = now));
      });
      if (speak) say(p.x);
    };
    apply(true);

    let intro: gsap.core.Tween | undefined;
    let io: IntersectionObserver | undefined;
    let rect: DOMRect | undefined;
    const ctx = gsap.context(() => {
      // GSAP's ticker runs the follow once per frame, however often the pointer or keys fire.
      const to = gsap.quickTo(p, 'x', { duration: 0.45, ease: 'power3', onUpdate: () => apply() });
      const go = (x: number) => {
        intro?.kill();
        intro = undefined;
        touched = true;
        target = x;
        say(x);
        to(x);
      };
      on(hit, 'keydown', (e) => {
        if (intro) target = p.x; // a key during the intro sweep counts from where the band is
        const x = keyTarget((e as KeyboardEvent).key, target);
        if (x === undefined) return;
        e.preventDefault();
        go(x);
      });
      if (fine.matches) {
        io = new IntersectionObserver(([e]) => {
          if (!e.isIntersecting) return;
          io?.disconnect();
          if (!touched) intro = gsap.to(p, { x: PARK, duration: 1.6, ease: 'power2.inOut', onUpdate: () => apply(true), onComplete: () => void (target = PARK) });
        }, { threshold: 0.6 });
        io.observe(hit);
        on(hit, 'pointerenter', () => void (rect = hit.getBoundingClientRect()));
        on(hit, 'pointermove', (e) => {
          rect ??= hit.getBoundingClientRect();
          go(clamp((((e as PointerEvent).clientX - rect.left) / rect.width) * 100));
        });
      } else {
        // From the photo's top at 80% of the screen to its bottom at 30%: about 1.5 screens of scroll on a phone.
        gsap.fromTo(p, { x: 0 }, {
          x: 100, ease: 'none', onUpdate: () => ((target = p.x), apply(true)),
          scrollTrigger: { trigger: hit, start: 'top 80%', end: 'bottom 30%', scrub: 0.4 },
        });
      }
    });
    on(window, 'resize', () => {
      rect = undefined;
      measure();
      apply();
    });

    return () => {
      off.abort();
      io?.disconnect();
      intro?.kill(); // made in the observer callback, outside the context
      ctx.revert();
      box.classList.remove('is-live');
      box.style.removeProperty('--x');
      tags.forEach((t) => t.classList.remove('is-lit'));
      hit.hidden = true;
      hit.setAttribute('aria-valuenow', '50');
      hit.removeAttribute('aria-valuetext');
    };
  };

  let undo: (() => void) | undefined;
  const start = () => {
    undo?.();
    undo = still.matches ? undefined : live();
  };
  start();
  still.addEventListener('change', start);
  fine.addEventListener('change', start);
  return () => {
    still.removeEventListener('change', start);
    fine.removeEventListener('change', start);
    undo?.();
    undo = undefined;
  };
};
