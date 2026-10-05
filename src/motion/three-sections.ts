// The home page's two 3D sections (approved 6 Oct 2026), on one shared canvas (src/three/stage.ts):
//   band    [data-cbg-site3d]: a night construction site; the band holds (sticky) for a stretch of scroll
//           and that scroll walks the camera once around the site.
//   courses [data-cbg-story]:  the "Your courses" pin becomes a story, one 3D scene per course card; the
//           card's own text (and its Open course link) shows beside the scene while its chapter plays.
// Only with full motion, WebGL2 and no data saver: otherwise nothing here runs and the sections keep
// their still forms (the band's fallback, the card gallery). The three.js chunk loads when either section
// is within about two screens; each course scene loads as its chapter approaches.
import { all } from './reveal';
import type { Enhancer } from './setup';
import { clamp01, fullMotion } from './tokens';
import type { Stage, StageScene } from '../three';

const NEAR = '200% 0px'; // start loading this far ahead

function capable(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (!matchMedia(fullMotion).matches || nav.connection?.saveData) return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

// Scroll progress through a sticky section: 0 when its top reaches the top of the screen, 1 when its
// bottom does.
const through = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return clamp01(-r.top / Math.max(1, r.height - innerHeight));
};
const inView = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight;
};

export const threeSections: Enhancer = (roots) => {
  const band = all(roots, '[data-cbg-site3d]')[0];
  const story = all(roots, '[data-cbg-story]')[0];
  if ((!band && !story) || !capable()) return;

  const bandSection = band?.closest<HTMLElement>('section');
  const chapters = story ? [...story.querySelectorAll<HTMLElement>('[data-scene]')] : [];
  const storyHost = story?.querySelector<HTMLElement>('.cbg-story__stage');
  const bar = story?.querySelector<HTMLElement>('.cbg-gallery__bar i');
  bandSection?.classList.add('is-3d');
  if (story && storyHost && chapters.length) {
    story.classList.add('is-story');
    story.style.setProperty('--chapters', String(chapters.length));
  }

  const off = new AbortController();
  let dead = false;
  let stage: Stage | undefined;
  let lib: typeof import('../three') | undefined;
  const built = new Map<string, Promise<StageScene | undefined>>();
  let current = -1;

  const scene = (name: string) => {
    if (!built.has(name)) {
      built.set(name, (async () => {
        const load = lib?.sceneLoader(name);
        if (!load || !stage) return undefined;
        const s = await (await load())(stage.kit);
        await stage.prepare(s);
        return s;
      })().catch((err) => { console.warn('[cbg] 3D scene', name, err); return undefined; }));
    }
    return built.get(name)!;
  };

  const chapterAt = (p: number) => Math.min(chapters.length - 1, Math.floor(p * chapters.length));

  // Which section has the canvas, and what it plays. Runs on scroll (two rect reads) and when a scene lands.
  async function route() {
    if (dead || !stage) return;
    if (bandSection && band && inView(bandSection)) {
      const s = await scene('site');
      if (dead || !s || !inView(bandSection)) return;
      stage.mount(band);
      stage.play(s, () => through(bandSection));
    } else if (story && storyHost && inView(story)) {
      const at = through(story);
      if (bar) bar.style.transform = `scaleX(${at})`;
      const i = chapterAt(at);
      if (i !== current) {
        current = i;
        chapters.forEach((c, k) => c.classList.toggle('is-active', k === i));
        const next = chapters[i + 1]?.dataset.scene;
        if (next) void scene(next); // fetch and compile one chapter ahead
      }
      const s = await scene(chapters[i].dataset.scene!);
      if (dead || !s || current !== i) return;
      stage.mount(storyHost);
      stage.play(s, () => clamp01(through(story) * chapters.length - i));
    }
  }

  // Keyboard: a hidden chapter's link can take focus; scroll the story so that chapter is the one showing.
  story?.addEventListener('focusin', (e) => {
    const k = chapters.findIndex((c) => c.contains(e.target as Node));
    if (k < 0 || k === current) return;
    const r = story.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top + ((k + 0.5) / chapters.length) * (r.height - innerHeight), behavior: 'auto' });
  }, { signal: off.signal });

  const io = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.isIntersecting) || lib) return;
    io.disconnect();
    try {
      lib = await import('../three');
      if (dead) return;
      stage = lib.createStage(undefined, new URL('./', import.meta.url).href);
      addEventListener('scroll', () => void route(), { passive: true, signal: off.signal });
      addEventListener('resize', () => void route(), { passive: true, signal: off.signal });
      if (band) void scene('site');
      void route();
    } catch (err) {
      console.warn('[cbg] 3D', err); // the sections keep their still forms
      bandSection?.classList.remove('is-3d');
      story?.classList.remove('is-story');
    }
  }, { rootMargin: NEAR });
  for (const el of [bandSection, story]) if (el) io.observe(el);

  return () => {
    dead = true;
    off.abort();
    io.disconnect();
    for (const p of built.values()) void p.then((s) => s?.dispose?.());
    stage?.dispose();
    bandSection?.classList.remove('is-3d');
    story?.classList.remove('is-story');
    story?.style.removeProperty('--chapters');
    chapters.forEach((c) => c.classList.remove('is-active'));
    bar?.style.removeProperty('transform');
  };
};
