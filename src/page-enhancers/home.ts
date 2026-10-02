// Home-only enhancers: loaded on demand so course pages never download them.
import { blueprint } from '../motion/blueprint';
import { gallery } from '../motion/gallery';
import { cardTilt } from '../motion/card-tilt';
import { parallax } from '../motion/parallax';
import { loginAction } from '../actions';

export const enhancers = [blueprint, parallax, gallery, cardTilt, loginAction];
