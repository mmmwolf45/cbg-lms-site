import { gsap } from 'gsap';
import { PATHS, PHONE_CROP, SOURCE, type Group } from './blueprint-paths';
import { DONE } from './reveal';
import type { Enhancer } from './setup';
import { fullMotion, reducedMotion } from './tokens';

// T15: "From blueprint to built". Gold lines (blueprint-paths.ts, in source pixels of the hero photo)
// draw the structure while the photo waits in the dark, then the photo lights up beneath them and the
// lines settle to a faint overlay. On a laptop with a mouse, the line layer and the photo drift apart
// a little with the pointer for depth.
// - The photo is the LCP element, so it is never hidden: home.css darkens it with a filter from first
//   paint (html.cbg-js, full motion, until the visual is marked done), and the timeline lifts that.
// - Reduced motion: lines shown at once at their settled opacity, photo lit by CSS, no parallax.
// - No JS / cbg-off: the svg stays empty and the photo is plain.

export type Box = readonly [x: number, y: number, w: number, h: number];
export const FULL_BOX: Box = [0, 0, SOURCE.w, SOURCE.h];
export const PHONE_BOX: Box = [PHONE_CROP.x, PHONE_CROP.y, PHONE_CROP.w, PHONE_CROP.h];
// The <picture>'s art-direction query (templates/sections/home-hero.ts).
const PHONE_MEDIA = '(max-width: 1023px)';
export const PARALLAX = `${fullMotion} and (min-width: 1024px) and (pointer: fine)`;

export const DARK = 'brightness(0.35) saturate(0.7)'; // mirrors home.css
const LIT = 'brightness(1) saturate(1)';
export const SETTLED = 0.3; // the lines' resting opacity
const STROKE_PX = 1.25; // on-screen line width, whatever the photo's scale
const LINES_PX = 12; // parallax travel: lines with the pointer, photo against it
const PHOTO_PX = 5;
const BLEED = 1.012; // both layers scale up a touch so the photo's edge never shows while it drifts

// The viewBox showing what the <img> currently shows: the full frame, or the phone crop of it.
// Before the browser has picked a source, the art-direction query decides.
export function viewBoxFor(currentSrc: string, phoneQuery: boolean): Box {
  if (currentSrc) return /hero-structure-phone/.test(currentSrc) ? PHONE_BOX : FULL_BOX;
  return phoneQuery ? PHONE_BOX : FULL_BOX;
}

// Source pixels to CSS pixels under object-fit: cover (preserveAspectRatio slice).
export const coverScale = (w: number, h: number, box: Box) => Math.max(w / box[2], h / box[3]);

// When each step of a group starts drawing (seconds), how long a line takes, and the stagger inside a step.
// Columns rise first, beams follow floor by floor, the braces, the crane last; then the photo lights up.
export const TIMING: Readonly<Record<Group, { at: number; step: number; dur: number }>> = {
  column: { at: 0, step: 0.08, dur: 0.75 },
  beam: { at: 0.5, step: 0.12, dur: 0.5 },
  brace: { at: 1.05, step: 0.15, dur: 0.4 },
  crane: { at: 1.35, step: 0.15, dur: 0.5 },
};
export const EACH = 0.04;
export const LIGHT_AT = 2.05;
export const LIGHT_DUR = 0.9;
export const startAt = (g: Group, order: number) => TIMING[g].at + order * TIMING[g].step;
export const GROUPS = Object.keys(PATHS) as Group[];

const NS = 'http://www.w3.org/2000/svg';
const MARK = 'data-cbg-blueprint';

// One <g> of <line>s, grouped into drawing steps in sequence order.
function build(svg: SVGSVGElement) {
  svg.querySelector(`[${MARK}]`)?.remove(); // never two sets, whatever happened before
  const g = svg.ownerDocument.createElementNS(NS, 'g');
  g.setAttribute(MARK, '');
  const steps: { at: number; dur: number; lines: SVGLineElement[] }[] = [];
  for (const group of GROUPS) {
    const byOrder: SVGLineElement[][] = [];
    for (const [x1, y1, x2, y2, order] of PATHS[group]) {
      const line = svg.ownerDocument.createElementNS(NS, 'line');
      const at = { x1, y1, x2, y2, pathLength: 1 };
      for (const [k, v] of Object.entries(at)) line.setAttribute(k, String(v));
      (byOrder[order] ??= []).push(line);
      g.append(line);
    }
    byOrder.forEach((lines, order) => lines && steps.push({ at: startAt(group, order), dur: TIMING[group].dur, lines }));
  }
  svg.append(g);
  return { g, steps, lines: [...g.children] as SVGLineElement[] };
}

export const blueprint: Enhancer = (roots) => {
  const visual = roots.map((r) => r.querySelector<HTMLElement>('[data-cbg-hero] .cbg-hero__visual')).find(Boolean);
  const svg = visual?.querySelector<SVGSVGElement>('svg.cbg-hero__lines');
  const media = visual?.querySelector<HTMLElement>('.cbg-hero__media');
  const img = media?.querySelector('img');
  const hero = visual?.closest<HTMLElement>('[data-cbg-hero]');
  if (!visual || !svg || !media || !img || !hero) return;
  try {
    return enhance(hero, visual, svg, media, img);
  } catch (err) {
    visual.classList.add(DONE); // never leave the photo in the dark
    svg.querySelector(`[${MARK}]`)?.remove();
    throw err;
  }
};

// Setup only writes (no style or layout reads), so it stays a few ms even on a slow phone.
function enhance(hero: HTMLElement, visual: HTMLElement, svg: SVGSVGElement, media: HTMLElement, img: HTMLImageElement) {
  const win = svg.ownerDocument.defaultView ?? window;
  const off = new AbortController();
  const signal = off.signal;
  const { g, steps, lines } = build(svg);

  // Keep the viewBox on whatever the photo shows. A new art-direction source fires `load` when it
  // replaces the old one; the media query covers the time before a source is picked. The line width
  // follows the photo's scale, with sizes from the ResizeObserver (it also reports the first size).
  const phone = win.matchMedia(PHONE_MEDIA);
  let box = FULL_BOX;
  let size: readonly [number, number] = [0, 0];
  const stroke = () => {
    const [w, h] = size;
    if (w && h) g.setAttribute('stroke-width', (STROKE_PX / coverScale(w, h, box)).toFixed(2));
  };
  const fit = () => {
    box = viewBoxFor(img.currentSrc, phone.matches);
    svg.setAttribute('viewBox', box.join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    stroke();
  };
  fit();
  img.addEventListener('load', fit, { signal });
  phone.addEventListener('change', fit, { signal });
  const ro = new ResizeObserver(([e]) => {
    if (!e) return;
    size = [e.contentRect.width, e.contentRect.height];
    stroke();
  });
  ro.observe(svg);

  // Nothing runs while the hero is off-screen: the intro waits (or pauses) and the layers re-centre.
  let visible = false;
  let intro: gsap.core.Timeline | undefined;
  let recentre: (() => void) | undefined;
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    if (intro && intro.progress() < 1) {
      if (visible) intro.play();
      else intro.pause();
    }
    if (!visible) recentre?.();
  });
  io.observe(visual);

  const mm = gsap.matchMedia();
  mm.add({ full: fullMotion, reduce: reducedMotion }, (ctx) => {
    if (!ctx.conditions?.full || visual.classList.contains(DONE)) {
      gsap.set(g, { opacity: SETTLED });
      return;
    }
    // Dash attributes (pathLength 1, so 1 = hidden, 0 = drawn) and GSAP's attr plugin: no style reads.
    const dash = (on: boolean) => {
      for (const l of lines) {
        if (on) {
          l.setAttribute('stroke-dasharray', '1');
          l.setAttribute('stroke-dashoffset', '1');
        } else {
          l.removeAttribute('stroke-dasharray');
          l.removeAttribute('stroke-dashoffset');
        }
      }
    };
    dash(true);
    const tl = gsap.timeline({
      paused: !visible,
      defaults: { ease: 'power2.inOut', immediateRender: false },
      onComplete: () => {
        visual.classList.add(DONE); // CSS stops darkening the photo for good
        gsap.set(media, { clearProps: 'filter' });
      },
    });
    for (const s of steps) tl.to(s.lines, { attr: { 'stroke-dashoffset': 0 }, duration: s.dur, stagger: EACH }, s.at);
    tl.fromTo(media, { filter: DARK }, { filter: LIT, duration: LIGHT_DUR }, LIGHT_AT);
    tl.fromTo(g, { opacity: 1 }, { opacity: SETTLED, duration: LIGHT_DUR }, LIGHT_AT);
    intro = tl;
    return () => {
      intro = undefined;
      dash(false);
    };
  });

  // Depth: the lines follow the pointer, the photo moves the other way. Built on the first move, so it
  // costs nothing at load; quickTo then reuses one tween per axis, and nothing runs once they settle.
  // Both layers scale up a touch so the photo's edge never shows while it drifts; at rest they align.
  mm.add(PARALLAX, (ctx) => {
    let to: ((nx: number, ny: number) => void) | undefined;
    const init = () => {
      const o = { duration: 0.9, ease: 'power3.out' };
      gsap.to([svg, img], { scale: BLEED, ...o });
      const lx = gsap.quickTo(svg, 'x', o);
      const ly = gsap.quickTo(svg, 'y', o);
      const px = gsap.quickTo(img, 'x', o);
      const py = gsap.quickTo(img, 'y', o);
      to = (nx, ny) => {
        lx(nx * LINES_PX);
        ly(ny * LINES_PX * 0.6);
        px(-nx * PHOTO_PX);
        py(-ny * PHOTO_PX * 0.6);
      };
    };
    let rect: DOMRect | undefined;
    const clamp = gsap.utils.clamp(-1, 1);
    const move = (e: PointerEvent) => {
      if (!visible || e.pointerType === 'touch') return;
      if (!to) ctx.add(init); // recorded in this context, so mm.revert() undoes it
      rect ??= hero.getBoundingClientRect(); // once per hover (and after a scroll), never per frame
      to?.(clamp(((e.clientX - rect.left) / rect.width) * 2 - 1), clamp(((e.clientY - rect.top) / rect.height) * 2 - 1));
    };
    recentre = () => {
      rect = undefined;
      to?.(0, 0);
    };
    const local = new AbortController(); // aborted by the cleanup below, which mm.revert() runs
    const opts = { signal: local.signal, passive: true };
    hero.addEventListener('pointermove', move, opts);
    hero.addEventListener('pointerleave', recentre, opts);
    win.addEventListener('scroll', () => (rect = undefined), opts);
    return () => {
      recentre = undefined;
      local.abort();
    };
  });

  return () => {
    // Torn down mid-intro (route change): leave the photo lit rather than dark.
    if (intro && intro.progress() < 1) visual.classList.add(DONE);
    off.abort();
    io.disconnect();
    ro.disconnect();
    mm.revert();
    g.remove();
    svg.removeAttribute('viewBox');
    svg.removeAttribute('preserveAspectRatio');
  };
}
