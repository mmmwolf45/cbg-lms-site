import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { G, TYPES, atText, barPaths, loadX, momentPath, readout, shearPath, weightsOf, type Support } from '../../src/motion/beam-model';
import { courseSection, head } from './course-shared';

type Beam = Section<'beam'>;

// Bending moment beam (Structural page, Module 5; motion in src/motion/beam.ts, styles in src/styles/beam.css).
// The drawing is written here in its starting state: a simply supported beam with the load at midspan, so
// without the script it is a correct, finished diagram. The script brings the controls to life, slides the
// load and redraws the paths (their `d` attributes). The SVG is decorative; the readout list under it is
// the real text, and the range input the control.

export const SUPPORT_LABELS: Record<Support, string> = {
  simple: 'Simply supported',
  fixed: 'Fixed both ends',
  cantilever: 'Cantilever',
};

const START: { type: Support; a: number } = { type: 'simple', a: 0.5 };

// Supports: a pin and a roller (simple), a wall at each end (fixed), a wall at the left (cantilever).
const y = G.beamY + 13; // the beam's underside
const pin = (x: number) => `<path d="M${x} ${y}l-14 24h28z"/>`;
const roller = (x: number) => `<path d="M${x} ${y}l-14 20h28z"/><circle cx="${x - 7}" cy="${y + 25}" r="4"/><circle cx="${x + 7}" cy="${y + 25}" r="4"/>`;
const wall = (x: number, dir: -1 | 1) => `<rect x="${dir < 0 ? x - 16 : x}" y="${G.beamY - 40}" width="16" height="80" fill="url(#cbg-bmd-hatch)"/><path d="M${x} ${G.beamY - 40}v80"/>`;
const SUPPORTS: Record<Support, string> = {
  simple: pin(G.X0) + roller(G.X1),
  fixed: wall(G.X0, -1) + wall(G.X1, 1),
  cantilever: wall(G.X0, -1),
};

export function beam(s: Beam) {
  const w = weightsOf(START.type);
  const [bottom, top] = barPaths(w, START.a);
  const r = readout(START.type, START.a, s.load, s.span);
  const button = (t: Support) =>
    `<button type="button" class="cbg-bmd__type" data-cbg-type="${t}" aria-pressed="${t === START.type}">${SUPPORT_LABELS[t]}</button>`;
  const read = (key: string, label: string, value: string) =>
    `<div><dt>${label}</dt><dd data-cbg-read="${key}">${value}</dd></div>`;
  return courseSection('beam', `${head(s.heading, s.intro)}
<figure class="cbg-bmd" data-cbg-bmd data-load="${s.load}" data-span="${s.span}">
<div class="cbg-bmd__types" role="group" aria-label="Supports" hidden>${TYPES.map(button).join('')}</div>
<div class="cbg-frame cbg-bmd__view">
<svg class="cbg-bmd__svg" viewBox="0 0 800 470" aria-hidden="true" focusable="false">
<defs><pattern id="cbg-bmd-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v8" class="cbg-bmd__hatch"/></pattern></defs>
<g class="cbg-bmd__dim"><path d="M${G.X0} 172h${G.X1 - G.X0}M${G.X0} 166v12M${G.X1} 166v12"/><text x="400" y="162">${esc(String(s.span))} m</text></g>
<text class="cbg-bmd__label" x="${G.X0}" y="${G.mY - G.mH - 12}">Bending moment</text>
<path class="cbg-bmd__m" d="${momentPath(w, START.a)}"/>
<path class="cbg-bmd__base" d="M${G.X0} ${G.mY}H${G.X1}"/>
<text class="cbg-bmd__label" x="${G.X0}" y="${G.vY - G.vH - 14}">Shear force</text>
<path class="cbg-bmd__v" d="${shearPath(w, START.a)}"/>
<path class="cbg-bmd__base" d="M${G.X0} ${G.vY}H${G.X1}"/>
<g class="cbg-bmd__supports">${TYPES.map((t) => `<g data-cbg-sup="${t}"${t === START.type ? '' : ' opacity="0"'}>${SUPPORTS[t]}</g>`).join('')}</g>
<rect class="cbg-bmd__body" x="${G.X0}" y="${G.beamY - 13}" width="${G.X1 - G.X0}" height="26" rx="2"/>
<path class="cbg-bmd__bar" data-cbg-bar="bottom" transform="translate(0 ${G.beamY + 7})" d="${bottom}"/>
<path class="cbg-bmd__bar" data-cbg-bar="top" transform="translate(0 ${G.beamY - 7})" d="${top}"/>
<g class="cbg-bmd__load" transform="translate(${loadX(START.a)} 0)"><path d="M0 34V88"/><path class="cbg-bmd__head" d="M-8 84l8 12 8-12z"/><text y="24">${esc(String(s.load))} kN</text></g>
</svg>
</div>
<label class="cbg-bmd__slide" hidden><span>Load position</span><input type="range" min="0" max="100" step="1" value="${Math.round(START.a * 100)}" aria-valuetext="${atText(START.a, s.span)} from the left end"></label>
<dl class="cbg-bmd__read">${read('at', 'Load at', atText(START.a, s.span))}${read('sag', 'Max sagging moment', `${r.sag} kN·m`)}${read('hog', 'Max hogging moment', `${r.hog} kN·m`)}${read('shear', 'Max shear', `${r.shear} kN`)}</dl>
${s.caption ? `<figcaption class="cbg-bmd__caption">${esc(s.caption)}</figcaption>` : ''}
</figure>`);
}
