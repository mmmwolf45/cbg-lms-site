// Course-only enhancers: loaded on demand so the home page never downloads them.
import { hazardScan } from '../motion/hazard-scan';
import { build80 } from '../motion/build80';
import { courseExtras } from '../motion/course-extras';
import { closeDefaultSection, startHere } from '../motion/start-here';
import { scrub } from '../motion/scrub';
import { xray } from '../motion/xray';
import { qsSections } from '../motion/qs-sections';
import type { Enhancer } from '../motion/setup';

// The bending moment beam (Structural page) is its own chunk (cbg-bmd), fetched only when the page has one.
const beamLazy: Enhancer = (roots) => {
  if (!roots.some((r) => r.querySelector('[data-cbg-bmd]'))) return;
  let undo: (() => void) | void;
  let dead = false;
  import('../motion/beam').then((m) => { if (!dead) undo = m.beam(roots); }).catch((err) => console.warn('[cbg]', err));
  return () => { dead = true; undo?.(); };
};

export const enhancers = [closeDefaultSection, hazardScan, scrub, build80, xray, qsSections, beamLazy, courseExtras, startHere];
