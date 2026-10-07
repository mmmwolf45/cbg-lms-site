import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';

// The 3D bow-tie (src/styles/bowtie.css, src/motion/bowtie.ts): the hazard and its top event at the knot,
// the causes converging on it from the left, each crossed by its prevention barrier, and the consequences
// fanning out to the right, each crossed by its recovery barrier. On a wide column it lies on a tilted plane
// with the barriers standing up off it; the build-up as it scrolls into view is CSS (scroll-driven), the
// tilt toward the mouse is the script. On a narrow column it reads top to bottom. Written in its finished
// state (no JS, reduced motion, browsers without scroll-driven animations).

type Bowtie = Section<'bowtie'>;

// The lines, in a 100 x 100 box stretched over the rows: from each cause (where its text ends, about 17% across)
// through its barrier to the knot, and out again to each consequence.
export function lines(n: number, m: number) {
  const y = (i: number, k: number) => +(((i + 0.5) / k) * 100).toFixed(2);
  const left = Array.from({ length: n }, (_, i) => `<path d="M17 ${y(i, n)}C30 ${y(i, n)} 36 50 50 50"/>`);
  const right = Array.from({ length: m }, (_, i) => `<path d="M50 50C64 50 70 ${y(i, m)} 83 ${y(i, m)}"/>`);
  return `<svg class="cbg-bowtie__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${left.join('')}${right.join('')}</svg>`;
}

export const bowtie = (b: Bowtie) => {
  const L = b.labels;
  const label = (cls: string, text: string) => `<p class="cbg-bowtie__label cbg-bowtie__label--${cls}" aria-hidden="true">${esc(text)}</p>`;
  const causes = b.causes.map(({ cause, barrier }, i) => `<li style="--i:${i}"><span class="cbg-bt-end">${esc(cause)}</span>`
    + `<span class="cbg-bt-barrier"><span class="cbg-sr-only">${esc(L.prevention)}: </span>${esc(barrier)}</span></li>`).join('');
  const outcomes = b.consequences.map(({ outcome, barrier }, i) => `<li style="--i:${i}">`
    + `<span class="cbg-bt-barrier"><span class="cbg-sr-only">${esc(L.recovery)}: </span>${esc(barrier)}</span><span class="cbg-bt-end">${esc(outcome)}</span></li>`).join('');
  return courseSection('bowtie', `${head(b.heading, b.intro)}
<figure class="cbg-bowtie" data-cbg-bowtie><div class="cbg-bowtie__tilt"><div class="cbg-bowtie__stage">
<div class="cbg-bowtie__labels">${label('causes', L.causes)}${label('prevention', L.prevention)}<span></span>${label('recovery', L.recovery)}${label('consequences', L.consequences)}</div>
<div class="cbg-bowtie__body">${lines(b.causes.length, b.consequences.length)}
<ol class="cbg-bowtie__side cbg-bowtie__side--l" aria-label="${esc(L.causes)}" style="--n:${b.causes.length}">${causes}</ol>
<p class="cbg-bowtie__knot"><span>${esc(b.hazard)}</span> <strong>${esc(b.event)}</strong></p>
<ol class="cbg-bowtie__side cbg-bowtie__side--r" aria-label="${esc(L.consequences)}" style="--n:${b.consequences.length}">${outcomes}</ol>
</div></div></div></figure>`);
};
