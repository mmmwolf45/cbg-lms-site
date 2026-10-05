import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';

// When the course cards may pan sideways: laptops with a mouse and a screen at least 800px tall. Phones
// swipe the row, tablets and reduced motion get a grid, and nothing pins. home.css lays the cards out in
// one row only under .is-pan, which gallery() sets while it pins.
export const PAN = `${fullMotion} and (min-width: 1024px) and (min-height: 800px) and (pointer: fine)`;

// Where the pan must be (px, 0 to max) to show this card whole, centred when it can be.
export const panFor = (left: number, width: number, view: number, max: number) =>
  Math.min(max, Math.max(0, left - (view - width) / 2));

// Runs f once the browser is idle (at most 1s later); returns the cancel.
const whenIdle = (f: () => void) => {
  if ('requestIdleCallback' in window) {
    const id = requestIdleCallback(f, { timeout: 1000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(f, 200);
  return () => clearTimeout(id);
};

// [data-cbg-gallery]: the section pins at the top of the screen and vertical scroll pans the card row
// (.cbg-gallery__track) until the last card's edge meets the column's right edge; the gold bar under it
// shows how far. Keyboard focus on a card the pan has moved off screen scrolls the page to that card.
// The gallery starts below the fold, so the pin (and the refresh of every trigger it needs) waits for an
// idle moment instead of lengthening the task that loads this chunk.
export const gallery: Enhancer = (roots) => {
  // .is-story: the 3D course story (three-sections.ts, which runs first) has taken the section over.
  const sections = all(roots, '[data-cbg-gallery]:not(.is-story)');
  if (!sections.length) return;
  const mm = gsap.matchMedia();
  mm.add(PAN, (ctx) => {
    const off = new AbortController();
    // Pinning (and every refresh, which unpins and pins again) moves the section in and out of a spacer,
    // which drops keyboard focus inside it: note the focus before, put it back after.
    let focused: HTMLElement | null = null;
    const keep = () => {
      const a = document.activeElement;
      if (a instanceof HTMLElement && sections.some((s) => s.contains(a))) focused = a;
    };
    const restore = () => {
      if (focused?.isConnected && document.activeElement === document.body) focused.focus({ preventScroll: true });
      focused = null;
    };
    const pin = () => {
      keep();
      let pinned = false;
      for (const section of sections) {
        const track = section.querySelector<HTMLElement>('.cbg-gallery__track');
        if (!track) continue;
        section.classList.add('is-pan');
        // The pinned panel (heading, cards and bar under the 56px navbar) must fit the screen, or its
        // lower part could never be seen: otherwise keep the grid.
        if (section.offsetHeight > innerHeight) {
          section.classList.remove('is-pan');
          continue;
        }
        pinned = true;
        // Layout only, never the transform: scrollWidth ignores the pan.
        const max = () => Math.max(0, track.scrollWidth - track.clientWidth);
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${max()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            refreshPriority: 1, // created after the reveals below it (lazy chunk): refresh it first
          },
        });
        tl.to(track, { x: () => -max() }, 0);
        const bar = section.querySelector('.cbg-gallery__bar i');
        if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1 }, 0);

        section.addEventListener('focusin', (e) => {
          const card = (e.target as Element).closest('.cbg-gallery__track > li');
          const st = tl.scrollTrigger;
          if (!(card instanceof HTMLElement) || !st || !(e.target as Element).matches(':focus-visible')) return;
          const m = max();
          const x = panFor(card.offsetLeft, card.offsetWidth, track.clientWidth, m);
          window.scrollTo({ top: st.start + (m ? (x / m) * (st.end - st.start) : 0), behavior: 'instant' });
        }, { signal: off.signal });
      }
      if (!pinned) return;
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      restore();
    };
    ScrollTrigger.addEventListener('refreshInit', keep);
    ScrollTrigger.addEventListener('refresh', restore);
    // Pinning makes the page taller from the section down, so it waits until the whole section is below the
    // screen and nothing the reader sees can move. It starts there on load; a reader already past it (a
    // late chunk, a restored scroll position) keeps the grid until they are back above it.
    const waiting = new AbortController();
    let cancel = () => {};
    const tryPin = () => {
      cancel();
      cancel = whenIdle(() => {
        if (sections.some((s) => s.getBoundingClientRect().top < innerHeight)) return;
        waiting.abort();
        ctx.add(pin);
      });
    };
    addEventListener('scroll', tryPin, { passive: true, signal: waiting.signal });
    tryPin();
    return () => {
      cancel();
      waiting.abort();
      off.abort();
      ScrollTrigger.removeEventListener('refreshInit', keep);
      ScrollTrigger.removeEventListener('refresh', restore);
      for (const s of sections) s.classList.remove('is-pan');
    };
  });
  return () => mm.revert();
};
