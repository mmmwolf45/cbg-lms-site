import { gsap } from 'gsap';
import type { Enhancer } from './setup';
import { DONE } from './reveal';
import { reducedMotion } from './tokens';

// T22: Hazard Scan on the course hero (templates/sections/course-hero.ts, src/styles/hazard.css).
// Laptop: a gold line sweeps the photo, each marker pops in as the line passes it with its label chip,
// then hover, focus or click a marker for a tip card. Phones and touch screens: after the sweep, a
// guided tour zooms the photo to one hazard at a time, with the text in the caption under it.
// The photo shows uncropped in a 3:2 box, so everything here works in % of the photo.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// The stage transform that fits a zoom area [x, y, w, h] (% of the photo) into the box: scale, then
// translate in % of the box, centred on the area but never past the photo's edges. Percentages of a
// box with the photo's own aspect, so it holds at every width without re-measuring.
export function zoomFor([x, y, w, h]: number[]) {
  const s = clamp(Math.min(100 / w, 100 / h), 1, 4);
  const t = (c: number) => clamp(50 - s * c, 100 - 100 * s, 0);
  return { s, x: t(x + w / 2), y: t(y + h / 2) };
}

// Top-left of a w x h tip beside a marker at (mx, my) in a W x H box: on the right unless it would
// overflow and the left has more room; always kept inside the box (pad from the edges).
export function tipPlace(mx: number, my: number, w: number, h: number, W: number, H: number, gap = 20, pad = 8) {
  const left = mx + gap + w > W - pad && mx > W / 2;
  return {
    left,
    x: clamp(left ? mx - gap - w : mx + gap, pad, W - w - pad),
    y: clamp(my - h / 2, pad, H - h - pad),
  };
}

// The next tour step: -1 is the whole photo, then 0..n-1; wraps both ways.
export const nextStep = (step: number, by: number, n: number) => ((step + 1 + by + n + 1) % (n + 1)) - 1;

const SWEEP = 2.5; // seconds for the line to cross the photo

export const hazardScan: Enhancer = (roots) => {
  const box = roots.map((r) => r.querySelector<HTMLElement>('[data-cbg-hazard]')).find(Boolean);
  const dots = [...(box?.querySelectorAll<HTMLElement>('.cbg-hazard-dot') ?? [])];
  if (!box || !dots.length) return;
  const q = (s: string) => box.querySelector(s) as HTMLElement;
  const frame = q('.cbg-frame');
  const stage = q('.cbg-hazard__stage');
  const tip = q('.cbg-hazard-tip');
  const cap = q('.cbg-hazard-caption');
  const count = q('.cbg-hazard-count');
  const bar = q('.cbg-hazard-tour');
  const items = [...box.querySelectorAll('[data-cbg-hazard-list] > li')];
  const n = dots.length;
  const tourMq = matchMedia('(max-width: 639px), (pointer: coarse)');
  const off = new AbortController();
  const on = (t: EventTarget, type: string, fn: (e: Event) => void) => t.addEventListener(type, fn, { signal: off.signal });
  let tour = false;
  let step = -1;
  let shown = -1;
  let swept = matchMedia(reducedMotion).matches || box.classList.contains(DONE);
  let io: IntersectionObserver | undefined;

  // A copy of list item i (label + detail) into the tip or the caption.
  const fill = (el: HTMLElement, i: number) => el.replaceChildren(...items[i].cloneNode(true).childNodes);
  const dotOf = (e: Event) => dots.indexOf((e.target as Element).closest?.('.cbg-hazard-dot') as HTMLElement);

  const close = () => {
    shown = -1;
    tip.hidden = true;
    dots.forEach((d) => d.classList.remove('is-open'));
  };
  const open = (i: number) => {
    if (tour || i < 0 || i === shown) return;
    shown = i;
    fill(tip, i);
    tip.hidden = false;
    dots.forEach((d, j) => d.classList.toggle('is-open', j === i));
    const f = frame.getBoundingClientRect();
    const d = dots[i].getBoundingClientRect();
    const p = tipPlace(d.left + d.width / 2 - f.left, d.top + d.height / 2 - f.top, tip.offsetWidth, tip.offsetHeight, f.width, f.height);
    tip.classList.toggle('is-left', p.left);
    tip.style.translate = `${p.x}px ${p.y}px`;
  };
  // After the pointer leaves a marker: show the focused marker's tip, if any.
  const restore = () => {
    const i = dots.indexOf(document.activeElement as HTMLElement);
    if (i < 0) close();
    else open(i);
  };

  const go = (i: number) => {
    step = i;
    const z = i < 0 ? undefined : zoomFor(dots[i].dataset.cbgZoom!.split(' ').map(Number));
    stage.style.transform = z ? `translate(${z.x}%, ${z.y}%) scale(${z.s})` : '';
    stage.style.setProperty('--zs', String(z?.s ?? 1));
    dots.forEach((d, j) => d.classList.toggle('is-active', j === i));
    count.textContent = i < 0 ? `All ${n}` : `${i + 1} of ${n}`;
    if (i < 0) cap.replaceChildren();
    else fill(cap, i);
  };

  const mode = () => {
    tour = tourMq.matches;
    box.classList.toggle('is-tour', tour);
    bar.hidden = !tour;
    close();
    go(tour && swept ? 0 : -1);
  };

  const settle = () => {
    swept = true;
    io?.disconnect();
    box.classList.add(DONE);
    box.classList.remove('is-scan');
    if (tour && step < 0) go(0);
  };

  box.classList.add('is-on');
  dots.forEach((d) => (d.hidden = false));
  mode();
  on(tourMq, 'change', mode);

  const ctx = gsap.context(() => {
    if (swept) return;
    box.classList.add('is-scan');
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(q('.cbg-hazard__scan'), { xPercent: -100 }, { xPercent: 0, duration: SWEEP, ease: 'none' })
      .to(q('.cbg-hazard__scan'), { opacity: 0, duration: 0.4 })
      .call(settle);
    for (const d of dots) {
      const t = (SWEEP * parseFloat(d.style.getPropertyValue('--x'))) / 100;
      tl.call(() => d.classList.add('is-seen', 'is-chip'), [], t).call(() => d.classList.remove('is-chip'), [], t + 1.6);
    }
    // Plays while the photo is on screen, pauses when it leaves.
    io = new IntersectionObserver(([e]) => void (e.isIntersecting ? tl.play() : tl.pause()), { threshold: 0.3 });
    io.observe(frame);
  });

  on(frame, 'pointerover', (e) => {
    const i = dotOf(e);
    if (i >= 0) open(i);
    else if (!tip.contains(e.target as Node)) restore();
  });
  on(frame, 'pointerleave', restore);
  on(frame, 'focusin', (e) => open(dotOf(e)));
  on(frame, 'focusout', (e) => dots.includes((e as FocusEvent).relatedTarget as HTMLElement) || close());
  on(frame, 'click', (e) => {
    const i = dotOf(e);
    if (i >= 0 && tour) go(i);
    else open(i);
  });
  on(bar, 'click', (e) => {
    const by = Number((e.target as Element).closest<HTMLElement>('[data-cbg-hazard-step]')?.dataset.cbgHazardStep);
    if (by) go(nextStep(step, by, n));
  });
  on(document, 'keydown', (e) => (e as KeyboardEvent).key === 'Escape' && shown >= 0 && close());
  on(window, 'resize', close);

  return () => {
    off.abort();
    io?.disconnect();
    ctx.revert();
    close();
    go(-1);
    count.textContent = '';
    stage.style.removeProperty('--zs');
    box.classList.remove('is-on', 'is-scan', 'is-tour');
    bar.hidden = true;
    dots.forEach((d) => {
      d.hidden = true;
      d.classList.remove('is-seen', 'is-chip');
    });
  };
};
