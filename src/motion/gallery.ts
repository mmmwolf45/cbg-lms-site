import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { all } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';

// When the course cards pan sideways. Mirrors home.css, which lays the cards out in one row under the
// same query (html.cbg-js only, so a failed setup falls back to the grid). Laptops with a mouse only:
// phones swipe the row, tablets and reduced motion get a grid, and nothing pins.
export const PAN = `${fullMotion} and (min-width: 1024px) and (min-height: 700px) and (pointer: fine)`;

// Where the pan must be (px, 0 to max) to show this card whole, centred when it can be.
export const panFor = (left: number, width: number, view: number, max: number) =>
  Math.min(max, Math.max(0, left - (view - width) / 2));

// [data-cbg-gallery]: the section pins at the top of the screen and vertical scroll pans the card row
// (.cbg-gallery__track) until the last card's edge meets the column's right edge; the gold bar under it
// shows how far. Keyboard focus on a card the pan has moved off screen scrolls the page to that card.
export const gallery: Enhancer = (roots) => {
  const sections = all(roots, '[data-cbg-gallery]');
  if (!sections.length) return;
  const mm = gsap.matchMedia();
  mm.add(PAN, () => {
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
    keep();
    for (const section of sections) {
      const track = section.querySelector<HTMLElement>('.cbg-gallery__track');
      if (!track) continue;
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
    ScrollTrigger.addEventListener('refreshInit', keep);
    ScrollTrigger.addEventListener('refresh', restore);
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    restore();
    return () => {
      off.abort();
      ScrollTrigger.removeEventListener('refreshInit', keep);
      ScrollTrigger.removeEventListener('refresh', restore);
    };
  });
  return () => mm.revert();
};
