// Course-only enhancers: loaded on demand so the home page never downloads them.
import { hazardScan } from '../motion/hazard-scan';
import { build80 } from '../motion/build80';
import { courseExtras } from '../motion/course-extras';
import { closeDefaultSection, startHere } from '../motion/start-here';
import { scrub } from '../motion/scrub';
import { xray } from '../motion/xray';
import { qsSections } from '../motion/qs-sections';
import { heroOptions } from '../motion/hero-options';

export const enhancers = [closeDefaultSection, hazardScan, heroOptions, scrub, build80, xray, qsSections, courseExtras, startHere];
