// Home-only enhancers: loaded on demand so course pages never download them.
import { explode } from '../motion/explode';
import { siteOrbit } from '../motion/site-orbit';
import { courseStory } from '../motion/course-story';
import { cardTilt } from '../motion/card-tilt';
import { strip } from '../motion/strip';
import { support } from '../motion/support';
import { cursor } from '../motion/cursor';
import { globe } from '../motion/globe';
import { loginAction } from '../actions';

export const enhancers = [explode, siteOrbit, courseStory, cardTilt, strip, support, cursor, globe, loginAction];
