import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { counters } from './counters';
import { reveal } from './reveal';
import { thread } from './thread';
import { fullMotion } from './tokens';

gsap.registerPlugin(ScrollTrigger);

const ROOT = '[data-cbg]';

// If motion setup breaks (an enhancer throws, a lazy chunk fails to load), drop cbg-js so nothing stays
// in its hidden starting state, and keep it off for the rest of the visit: `failed` stops later page
// changes from putting it back.
export let failed = false;
export function failOpen(err: unknown, doc: Document = document) {
  failed = true;
  doc.documentElement.classList.remove('cbg-js');
  console.warn('[cbg]', err);
}

// A page-specific enhancer (hero lines, hazard scan, login button...): gets the current roots, returns
// its cleanup. Runs outside the reduced-motion query, so each one handles reduced motion itself.
export type Enhancer = (roots: HTMLElement[]) => (() => void) | void;

// Runs reveal, thread and counters on every [data-cbg] block in the document and returns the teardown.
// gsap.matchMedia() is a gsap.context per query: under reduced motion nothing is created and the CSS
// already shows the final state. If the media query flips, GSAP reverts one side and runs the other.
// course.link renders blocks inside React, which can add them late or replace them, so a DOM watcher
// re-runs the setup when the set of roots changes. Finished elements are marked done, so a re-run never
// repeats a reveal or a count.
export function setupMotion(doc: Document = document, enhancers: Enhancer[] = []): () => void {
  const off = new AbortController();
  let mm: gsap.MatchMedia | undefined;
  let roots: HTMLElement[] = [];
  let cleanups: (() => void)[] = [];
  const undoEnhancers = () => {
    cleanups.forEach((f) => f());
    cleanups = [];
  };
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let watchTimer: ReturnType<typeof setTimeout> | undefined;

  const refreshSoon = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 100);
  };

  const run = () => {
    mm?.revert();
    mm = undefined;
    undoEnhancers();
    roots = [...doc.querySelectorAll<HTMLElement>(ROOT)];
    if (!roots.length) return;
    for (const enhance of enhancers) {
      try {
        const undo = enhance(roots);
        if (undo) cleanups.push(undo);
      } catch (err) {
        failOpen(err, doc); // show everything in its final state; the other enhancers still run
      }
    }
    mm = gsap.matchMedia();
    // Also runs later when the preference flips, so it catches its own errors.
    mm.add(fullMotion, () => {
      const undo: (() => void)[] = [];
      try {
        reveal(roots);
        undo.push(thread(roots), counters(roots));
      } catch (err) {
        failOpen(err, doc);
      }
      return () => undo.forEach((f) => f());
    });
    // An image without width and height changes the layout when it arrives: re-measure the triggers then.
    // Ours all carry both (docs/markup-contract.md), so their (lazy) loads never refresh, which would
    // otherwise re-pin the home gallery mid-pan.
    for (const img of roots.flatMap((r) => [...r.querySelectorAll<HTMLImageElement>('img:not([width][height])')])) {
      if (!img.complete) img.addEventListener('load', refreshSoon, { once: true, signal: off.signal });
    }
  };

  run();
  doc.fonts?.ready.then(() => off.signal.aborted || refreshSoon());

  const changed = () => {
    const now = doc.querySelectorAll(ROOT);
    return now.length !== roots.length || roots.some((r) => !r.isConnected);
  };
  const watcher = new MutationObserver(() => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      if (!changed()) return;
      try {
        run();
        refreshSoon();
      } catch (err) {
        failOpen(err, doc);
      }
    }, 150);
  });
  watcher.observe(doc.getElementById('react-root') ?? doc.body, { childList: true, subtree: true });

  return () => {
    off.abort();
    watcher.disconnect();
    clearTimeout(refreshTimer);
    clearTimeout(watchTimer);
    mm?.revert();
    undoEnhancers();
  };
}
