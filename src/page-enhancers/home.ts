// Home-only enhancers: loaded on demand so course pages never download them.
import { explode } from '../motion/explode';
import { gallery } from '../motion/gallery';
import { cardTilt } from '../motion/card-tilt';
import { parallax } from '../motion/parallax';
import { loginAction } from '../actions';

export const enhancers = [explode, parallax, gallery, cardTilt, loginAction];
