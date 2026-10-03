import { esc, picture } from '../../src/components/html';
import images from '../../src/images.json';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';
import { pct } from './course-hero';

type Xray = Section<'xray'>;
type Size = { width: number; height: number };
type ImageName = keyof typeof images;

// Rebar X-ray (QS, PLAN.md E5; motion in src/motion/xray.ts, styles in src/styles/xray.css).
// Two stacked 3:2 photos of the same shot: the concrete, and inside a moving band the same frame with its
// steel showing. The band is a window: .cbg-xray__band slides across and .cbg-xray__steel slides the
// other way inside it, so the steel stays registered with the concrete (transforms only, driven by --x).
// Without the script (and under reduced motion) the band is fixed over the right half: a static split
// with every label showing. The on-photo labels are decorative copies (aria-hidden); the list is the
// real one. The slider control carries `hidden` until the script makes it live.

// The two photos must line up pixel for pixel, and every label must point inside them.
export function checkXray(s: Xray, a: Size | undefined, b: Size | undefined) {
  if (!a || !b) throw new Error(`xray: ${!a ? s.image : s.xray} is not in src/images.json (run npm run images)`);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`xray: ${s.image} is ${a.width} x ${a.height} but ${s.xray} is ${b.width} x ${b.height}; the pair must be the same size`);
  }
  s.labels.forEach(({ at }, i) => {
    if (at.length !== 2 || at[0] < 0 || at[1] < 0 || at[0] > a.width || at[1] > a.height) {
      throw new Error(`xray.labels[${i}].at: [${at.join(', ')}] is not a point inside the ${a.width} x ${a.height} photo`);
    }
  });
}

// The markup from two ready <picture>s (tests pass their own) and the photos' size.
export function xrayMarkup(s: Xray, concrete: string, steel: string, { width, height }: Size) {
  const tag = ({ text, at: [x, y] }: Xray['labels'][number]) => {
    const px = pct(x, width);
    return `<li class="cbg-xray__tag${px < 50 ? ' cbg-xray__tag--l' : ''}" data-cbg-x="${px}" style="--lx:${px}%;--ly:${pct(y, height)}%">`
      + `<span>${esc(text)}</span></li>`;
  };
  return courseSection('xray', `${head(s.heading, s.intro)}
<figure class="cbg-xray" data-cbg-xray>
<div class="cbg-frame"><div class="cbg-xray__view">
${concrete}
<div class="cbg-xray__band" aria-hidden="true"><div class="cbg-xray__steel">${steel}</div></div>
<ul class="cbg-xray__tags" aria-hidden="true">${s.labels.map(tag).join('')}</ul>
<div class="cbg-xray__hit" role="slider" tabindex="0" aria-label="X-ray scan: move to see the steel" aria-describedby="cbg-xray-labels" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" hidden></div>
</div></div>
<ol class="cbg-sr-only" id="cbg-xray-labels">${s.labels.map((l) => `<li>${esc(l.text)}</li>`).join('')}</ol>
${s.caption ? `<figcaption class="cbg-xray__caption">${esc(s.caption)}</figcaption>` : ''}
</figure>`);
}

const SIZES = '(min-width: 1280px) 792px, (min-width: 1024px) 56vw, 100vw';

export const xray = (s: Xray) => {
  const a = images[s.image as ImageName] as Size | undefined;
  const b = images[s.xray as ImageName] as Size | undefined;
  checkXray(s, a, b);
  return xrayMarkup(
    s,
    picture(s.image as ImageName, { alt: s.imageAlt, sizes: SIZES }),
    picture(s.xray as ImageName, { alt: '', sizes: SIZES }),
    a!,
  );
};
