// Course-only enhancers: loaded on demand so the home page never downloads them.
import { hazardScan } from '../motion/hazard-scan';
import { build80 } from '../motion/build80';
import { courseExtras } from '../motion/course-extras';
import { closeDefaultSection, startHere } from '../motion/start-here';
import { scrub } from '../motion/scrub';
import { xray } from '../motion/xray';
import { qsSections } from '../motion/qs-sections';

export const enhancers = [closeDefaultSection, hazardScan, scrub, build80, xray, qsSections, courseExtras, startHere];
