// Home-only enhancers: loaded on demand so course pages never download them.
import { blueprint } from '../motion/blueprint';
import { ticks } from '../motion/ticks';
import { loginAction } from '../actions';

export const enhancers = [blueprint, ticks, loginAction];
