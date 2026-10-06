// Home-only enhancers: loaded on demand so course pages never download them.
import { explode } from '../motion/explode';
import { parallax } from '../motion/parallax';
import { bandDesk } from '../motion/band-desk';
import { gallery } from '../motion/gallery';
import { ribbon } from '../motion/ribbon';
import { cardTilt } from '../motion/card-tilt';
import { support } from '../motion/support';
import { dock } from '../motion/dock';
import { cursor } from '../motion/cursor';
import { globe } from '../motion/globe';
import { loginAction } from '../actions';

// The outlined course-names strip is off in this build: see OUTLINED in templates/sections/home-disciplines.ts
// (add `strip` from '../motion/strip' here when it is on).
export const enhancers = [explode, parallax, bandDesk, gallery, ribbon, cardTilt, support, dock, cursor, globe, loginAction];
