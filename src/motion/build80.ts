import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { countText } from './counters';
import { DONE, all } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion } from './tokens';

// T24: the 80-hour build. [data-cbg-build] holds a drawing with one [data-cbg-floor] per unit (Unit 1 is
// the foundation) and the unit cards [data-cbg-unit]. No pin: on laptop the drawing is already
// position: sticky beside the list (course.css), inside our own column, so it can never reach the enrol card.

const clamp = gsap.utils.clamp(0, 1);
const GAP = 0.25; // phone: seconds between floors
const EACH = 0.8; // phone: seconds per floor

// Running totals: [21, 27, 12, 20] -> [21, 48, 60, 80].
export const cumulative = (glh: number[]) => {
  let n = 0;
  return glh.map((h) => (n += h));
};

// Laptop: how far each floor is drawn (0..1) when the point `p` (0..1 down the unit list) sits at the middle
// of the viewport. `spans` are each card's [top, bottom] as fractions of the list; a floor draws while the
// first 60% of its card crosses the middle.
export const scrubFloors = (p: number, spans: number[][]) => spans.map(([a, b]) => clamp((p - a) / ((b - a) * 0.6 || 1)));

// The active card at `p`: the last one whose top has reached the middle (the first before that).
export const activeUnit = (p: number, spans: number[][]) => Math.max(0, spans.filter(([a]) => a <= p).length - 1);

// Phone: floors build bottom-up, GAP apart, `t` seconds after the drawing came into view.
export const timedFloors = (t: number, n: number) => Array.from({ length: n }, (_, i) => clamp((t - i * GAP) / EACH));

// The hours shown: each floor adds its unit's GLH as it is drawn, so the figure climbs 0 -> 21 -> 48 -> 60 -> 80.
export const hoursAt = (fs: number[], glh: number[]) => fs.reduce((n, f, i) => n + f * (glh[i] ?? 0), 0);

// One floor as a paused timeline of length 1: outline draws, then labels, then a soft gold fill (a clone
// of the outline, so the fill fades with opacity alone). The roof line closes the top floor.
function floorTl(g: SVGGElement, roof: SVGPathElement | null) {
  const rect = g.querySelector('rect')!;
  const fill = rect.cloneNode() as SVGRectElement;
  fill.classList.add('cbg-floor__fill');
  g.prepend(fill);
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const draw = (el: SVGGeometryElement, at: number, duration: number) => {
    const len = el.getTotalLength();
    gsap.set(el, { strokeDasharray: len });
    tl.fromTo(el, { strokeDashoffset: len }, { strokeDashoffset: 0, duration }, at);
  };
  draw(rect, 0, 0.7);
  tl.fromTo(g.querySelectorAll('path,text'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.35)
    .fromTo(fill, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.6);
  if (roof) draw(roof, 0.7, 0.3);
  return tl;
}

function section(sec: HTMLElement) {
  const build = sec.querySelector<HTMLElement>('.cbg-build');
  const plan = sec.querySelector<HTMLElement>('.cbg-build__plan');
  const list = sec.querySelector<HTMLElement>('.cbg-units');
  const floors = [...sec.querySelectorAll<SVGGElement>('[data-cbg-floor]')];
  const cards = [...sec.querySelectorAll<HTMLElement>('[data-cbg-unit]')];
  const num = sec.querySelector<HTMLElement>('.cbg-build__total [data-cbg-count]');
  if (!build || !plan || !list || !num || !floors.length || floors.length !== cards.length) return;
  const glh = floors.map((f) => parseInt(f.querySelector('.cbg-floor__glh')?.textContent ?? '') || 0);
  const total = cumulative(glh).pop()!;
  // The final text from the hook, not the DOM: the shared counter (counters.ts) may already be counting it.
  const final = num.dataset.cbgCount ?? String(total);
  // This figure is ours: the shared counter skips done elements. If it got here first (this module loads
  // in a later chunk), it keeps writing to its own text node, which replaceChildren below detaches.
  const owned = !num.classList.contains(DONE);
  num.classList.add(DONE);
  // One text node updated through .data (aria-hidden; screen readers read the sr-only copy).
  const text = document.createTextNode(final);
  num.replaceChildren(text);

  const start = (side: boolean) => {
    const ctx = gsap.context(() => {
      const tls = floors.map((g, i) => floorTl(g, i === floors.length - 1 ? sec.querySelector('.cbg-build__roof') : null));
      const render = (fs: number[]) => {
        fs.forEach((f, i) => {
          tls[i].progress(f);
          floors[i].classList.toggle('is-built', f >= 1);
        });
        const t = countText(hoursAt(fs, glh), total, final);
        if (t !== text.data) text.data = t;
      };
      if (side) {
        // Laptop: scrubbed by the unit list crossing the middle of the viewport.
        let spans: number[][] = [];
        let on = -1;
        const measure = () => {
          const box = list.getBoundingClientRect();
          spans = cards.map((c) => {
            const r = c.getBoundingClientRect();
            return [(r.top - box.top) / box.height, (r.bottom - box.top) / box.height];
          });
        };
        const activate = (self: ScrollTrigger) => {
          const i = self.isActive ? activeUnit(self.progress, spans) : -1;
          if (i === on) return;
          on = i;
          cards.forEach((c, j) => c.classList.toggle('is-active', j === i));
        };
        const state = { p: 0 };
        build.classList.add('is-scrub');
        gsap.to(state, {
          p: 1,
          ease: 'none',
          onUpdate: () => render(scrubFloors(state.p, spans)),
          scrollTrigger: {
            trigger: list,
            start: 'top center',
            end: 'bottom center',
            scrub: 0.4,
            onRefresh: (self) => {
              measure();
              render(scrubFloors(state.p, spans));
              activate(self);
            },
            onUpdate: activate,
            onToggle: activate,
          },
        });
      } else {
        // Phone or narrow column: the whole drawing builds once as it comes into view.
        const clock = { t: 0 };
        const end = GAP * (floors.length - 1) + EACH;
        render(timedFloors(0, floors.length));
        const play = gsap.to(clock, { t: end, duration: end, ease: 'none', paused: true, onUpdate: () => render(timedFloors(clock.t, floors.length)) });
        ScrollTrigger.create({ trigger: plan.querySelector('svg') ?? plan, start: 'bottom 92%', once: true, onEnter: () => void play.play() });
      }
    });
    return () => {
      ctx.revert();
      sec.querySelectorAll('.cbg-floor__fill').forEach((f) => f.remove());
      floors.forEach((f) => f.classList.remove('is-built'));
      cards.forEach((c) => c.classList.remove('is-active'));
      build.classList.remove('is-scrub');
      text.data = final;
    };
  };

  // Reduced motion: nothing runs and the drawing, list and figure stay in their final static state.
  const mm = gsap.matchMedia();
  mm.add(fullMotion, () => {
    // Side by side = laptop viewport and a column wide enough for the sticky drawing (a container query).
    const sideBySide = () => matchMedia('(min-width: 1024px)').matches && getComputedStyle(plan).position === 'sticky';
    let side = sideBySide();
    let stop = start(side);
    // A resize can cross the column breakpoint without crossing 1024px: switch modes after the refresh.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (sideBySide() === side) return;
        stop();
        stop = start((side = !side));
        ScrollTrigger.refresh();
      });
    };
    ScrollTrigger.addEventListener('refresh', check);
    return () => {
      clearTimeout(timer);
      ScrollTrigger.removeEventListener('refresh', check);
      stop();
    };
  });
  return () => {
    mm.revert();
    if (owned) num.classList.remove(DONE);
  };
}

export const build80: Enhancer = (roots) => {
  const undo = all(roots, '[data-cbg-build]').map(section);
  return () => undo.forEach((f) => f?.());
};
