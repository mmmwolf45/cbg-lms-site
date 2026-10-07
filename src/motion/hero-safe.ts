import { gsap } from 'gsap';
import { DONE } from './reveal';
import { reducedMotion } from './tokens';

// Make it safe (hero.visual: make-it-safe; templates/sections/course-hero-options.ts, hero-options.css).
// The photo as found, then a gold line wipes slowly left to right and leaves the site made safe behind it;
// each pin's label turns from its hazard to its control as the line passes. Then (and under reduced
// motion from the start) the student drags across the photo, or uses the arrow keys, to compare.
// --cut is the line's place, in % of the photo.

const WIPE = 4.5; // seconds for the line to cross the photo
const HOLD = 0.8; // seconds on the site as found before the line sets off

export function enhance(box: HTMLElement): () => void {
  const q = <T extends HTMLElement>(s: string) => box.querySelector(s) as T;
  const view = q('.cbg-safe__view');
  const range = q<HTMLInputElement>('.cbg-safe__range');
  const after = q('.cbg-safe__tag--after').textContent ?? '';
  const pins = [...box.querySelectorAll<HTMLElement>('.cbg-safe-pin')];
  const xs = pins.map((p) => Number(p.dataset.cbgX));
  const off = new AbortController();
  const at = { cut: 100 };
  let io: IntersectionObserver | undefined;

  const draw = () => {
    const c = at.cut;
    view.style.setProperty('--cut', `${c}%`);
    view.classList.toggle('is-split', c < 99.5);
    view.classList.toggle('is-found', c < 0.5);
    pins.forEach((p, i) => p.classList.toggle('is-risk', xs[i] > c));
    range.value = String(Math.round(c));
    range.setAttribute('aria-valuetext', `${after}: ${Math.round(c)}%`);
  };
  const settle = () => {
    io?.disconnect();
    box.classList.add(DONE);
  };

  const still = matchMedia(reducedMotion).matches || box.classList.contains(DONE);
  const wipe = gsap.to(at, { cut: 100, duration: WIPE, delay: HOLD, ease: 'sine.inOut', paused: true, onUpdate: draw, onComplete: settle });
  if (!still) {
    at.cut = 0;
    // Plays while the photo is on screen, pauses when it leaves.
    io = new IntersectionObserver(([e]) => void (e.isIntersecting ? wipe.play() : wipe.pause()), { threshold: 0.4 });
    io.observe(view);
  }
  draw();
  box.classList.add('is-on');
  range.hidden = false;

  // The student takes over: the wipe stops where it is and the line follows them.
  range.addEventListener('input', () => {
    wipe.kill();
    at.cut = Number(range.value);
    draw();
    settle();
  }, { signal: off.signal });

  return () => {
    off.abort();
    io?.disconnect();
    wipe.kill();
    range.hidden = true;
    box.classList.remove('is-on');
    view.classList.remove('is-split', 'is-found');
    view.style.removeProperty('--cut');
    pins.forEach((p) => p.classList.remove('is-risk'));
  };
}
