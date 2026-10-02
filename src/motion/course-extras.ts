import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DONE, all, enterAt } from './reveal';
import type { Enhancer } from './setup';
import { dur, ease, fullMotion, stagger } from './tokens';

// T23 + T25: the hand of certificate cards, the assessment cards and quadrants, the field-guide shelf.
// The trainer duotone hover is CSS (course.css) and the bonus path's thread is thread.ts.
// Hidden starting states live in course-motion.css (html.cbg-js, motion allowed, not .cbg-done).

export type Box = { x: number; y: number; w: number; h: number };
export type Pose = { x: number; y: number; rotation: number; scale: number };

// FLIP: the translation that moves a box's bottom-centre (the transform origin) onto a point.
export const delta = (b: Box, px: number, py: number) => ({ x: px - (b.x + b.w / 2), y: py - (b.y + b.h) });

// The hand: every card scaled down and pivoted on one point near the grid's top-left, the first card
// (top of the stack) nearly upright, the ones under it tilted alternately left and right.
export function fanPoses(boxes: Box[], scale = 0.7): Pose[] {
  const minW = Math.min(...boxes.map((b) => b.w));
  const s = boxes.map((b) => scale * Math.min(1, (1.25 * minW) / b.w)); // wide cards shrink to a hand-held size
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const px = x0 + Math.max(...boxes.map((b, i) => b.w * (s[i] ?? 1))) / 2 + 24;
  const py = y0 + Math.max(...boxes.map((b, i) => b.h * (s[i] ?? 1))) + 8;
  return boxes.map((b, d) => {
    const side = d % 2 ? 1 : -1;
    return { ...delta(b, px + side * d * 10, py), rotation: d ? side * (2 + 4 * d) : -2, scale: s[d] ?? scale };
  });
}

// The closed shelf: every cover slid left onto the first one, each a few px further right.
export const stackOffsets = (lefts: number[], step = 3) => lefts.map((l, i) => (lefts[0] ?? 0) + i * step - l);

const box = (el: HTMLElement): Box => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });

// Starts when the element's top reaches this fraction of the viewport (never past the end of the page).
const at = (el: HTMLElement, f: number) => () =>
  Math.min(el.getBoundingClientRect().top + scrollY - innerHeight * f, ScrollTrigger.maxScroll(window) - 1);
const once = (el: HTMLElement, f: number, onEnter: () => void, onRefresh?: () => void) =>
  ScrollTrigger.create({ trigger: el, start: at(el, f), end: 1e9, once: true, onEnter, onRefresh });

const done = (el: Element) => el.classList.add(DONE);
const CLEAR = 'transform,transformOrigin,opacity,zIndex';

function hand(ul: HTMLElement, touched: Element[]) {
  const cards = [...ul.children] as HTMLElement[];
  touched.push(...cards);
  const boxes = cards.map(box);
  if (boxes.every((b) => b.x === boxes[0]?.x)) {
    // One column (phones): each card slides in from alternate sides as it arrives.
    cards.forEach((card, i) => {
      if (card.classList.contains(DONE)) return;
      gsap.fromTo(card, { x: i % 2 ? 64 : -64, opacity: 0 }, {
        x: 0, opacity: 1, duration: dur.base, ease: ease.out, clearProps: CLEAR,
        onComplete: () => (done(card), cards.every((c) => c.classList.contains(DONE)) && done(ul)),
        scrollTrigger: { trigger: card, start: enterAt(card), once: true },
      });
    });
    return;
  }
  // Grid: the hand waits near the top-left (visible while it scrolls in), then deals card by card.
  const deal = gsap.timeline({ paused: true, onComplete: () => (gsap.set(cards, { clearProps: CLEAR }), cards.forEach(done), done(ul)) })
    .to(cards, { x: 0, y: 0, rotation: 0, scale: 1, duration: dur.base, ease: ease.out, stagger: 0.08 });
  const place = () => {
    if (deal.progress()) return;
    const poses = fanPoses(cards.map(box));
    cards.forEach((c, i) => gsap.set(c, { ...poses[i], transformOrigin: '50% 100%', zIndex: cards.length - i, opacity: 1 }));
  };
  place();
  once(ul, 0.75, () => void deal.play(), place);
}

function shelf(el: HTMLElement, touched: Element[]) {
  const covers = [...el.querySelectorAll<HTMLElement>('.cbg-cover')];
  touched.push(...covers);
  if (getComputedStyle(el).overflowX !== 'visible') {
    // Scroll-snap row (phones, tablets): a gentle fade, nothing that moves the row or takes the scroll.
    gsap.fromTo(covers, { opacity: 0 }, {
      opacity: 1, duration: dur.base, ease: ease.out, stagger, clearProps: CLEAR, onComplete: () => done(el),
      scrollTrigger: { trigger: el, start: enterAt(el), once: true },
    });
    return;
  }
  // Laptop: the designed fan (course.css transforms) is the end state; it opens from a neat stack.
  const end = covers.map((c) => ({ x: +gsap.getProperty(c, 'x'), y: +gsap.getProperty(c, 'y'), rotation: +gsap.getProperty(c, 'rotation') }));
  const open = gsap.timeline({ paused: true, onComplete: () => (gsap.set(covers, { clearProps: CLEAR }), done(el)) })
    .to(covers, { x: (i) => end[i]?.x, y: (i) => end[i]?.y, rotation: (i) => end[i]?.rotation, duration: 0.9, ease: ease.out, stagger: 0.05 });
  const place = () => {
    if (open.progress()) return;
    const dx = stackOffsets(covers.map((c) => c.offsetLeft));
    covers.forEach((c, i) => gsap.set(c, { x: dx[i], y: 0, rotation: i % 2 ? 0.6 : -0.6, zIndex: covers.length - i, opacity: 1 }));
  };
  place();
  once(el, 0.8, () => void open.play(), place);
}

export const courseExtras: Enhancer = (roots) => {
  const mm = gsap.matchMedia();
  const touched: Element[] = [];
  mm.add(fullMotion, () => {
    for (const ul of all(roots, '[data-cbg-hand]')) if (!ul.classList.contains(DONE)) hand(ul, touched);
    // Assessment cards: reveal.ts fades and lifts them (data-cbg-reveal="stagger", set up after the enhancers).
    // On the same trigger and stagger this adds x, so they rise in from opposite sides. It ends a little
    // sooner, so reveal's clearProps is the last word on the transform.
    for (const ex of all(roots, '.cbg-exams[data-cbg-reveal="stagger"]')) {
      if (ex.classList.contains(DONE)) continue;
      touched.push(...ex.children);
      gsap.fromTo([...ex.children], { x: (i) => (i % 2 ? 56 : -56) }, {
        x: 0, duration: dur.base - 0.1, ease: ease.out, stagger,
        scrollTrigger: { trigger: ex, start: enterAt(ex), once: true },
      });
    }
    // Quadrants: .cbg-done starts the CSS sequence (each tile's pie draws, then its name and count rise).
    for (const q of all(roots, '[data-cbg-quadrants]')) if (!q.classList.contains(DONE)) once(q, 0.8, () => done(q));
    for (const el of all(roots, '[data-cbg-shelf]')) if (!el.classList.contains(DONE)) shelf(el, touched);
  });
  // Route change or re-setup: kill everything, drop our inline styles; finished elements stay done.
  return () => {
    mm.revert();
    if (touched.length) gsap.set(touched, { clearProps: CLEAR });
  };
};
