// Home-only enhancers: loaded on demand so course pages never download them.
import { explode } from '../motion/explode';
import { gallery } from '../motion/gallery';
import { threeSections } from '../motion/three-sections';
import { cardTilt } from '../motion/card-tilt';
import { strip } from '../motion/strip';
import { support } from '../motion/support';
import { cursor } from '../motion/cursor';
import { globe } from '../motion/globe';
import { loginAction } from '../actions';

// threeSections runs before gallery: a course section it turns into the 3D story is left alone by gallery.
export const enhancers = [explode, threeSections, gallery, cardTilt, strip, support, cursor, globe, loginAction];
