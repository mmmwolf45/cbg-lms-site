import { esc, picture } from '../../src/components/html';
import images from '../../src/images.json';
import type { Course } from '../../content/schema';

// The hero options beyond the Hazard Scan (content/hero-options/, HOW_TO_ADD_A_COURSE.md): make-it-safe,
// risk-matrix, hierarchy and swiss-cheese. Each is written in its finished state, which is what no JS and
// reduced motion show; its script (src/motion/hero-*.ts, loaded only on a page that has it) plays the way
// there. Positions are in % of the box, so they hold at every width.

type Hero = Course['hero'];
type ImageName = keyof typeof images;

const pc = (v: number) => +v.toFixed(2);
const SIZES = '(min-width: 1280px) 792px, (min-width: 1024px) 56vw, 100vw';

// Make it safe. The made-safe photo is the base (the finished state, and the LCP image); the photo as found
// lies over it in a layer the wipe slides off to the right, its left edge the wipe line. Each fix's pin
// carries both labels; the script shows the hazard until the line passes it. The list under the photo
// says the same in words (screen readers, phones).
export function makeItSafe(h: Hero, safe: NonNullable<Hero['safe']>) {
  const { width: W, height: H } = images[h.image as ImageName];
  const before = picture(h.image as ImageName, { alt: h.imageAlt ?? '', eager: true, sizes: SIZES })
    .replace('fetchpriority="high"', 'decoding="async"');
  const after = picture(safe.image as ImageName, { alt: safe.imageAlt, eager: true, sizes: SIZES });
  const pin = ({ hazard, control, at: [x, y] }: (typeof safe.fixes)[number], i: number) =>
    `<span class="cbg-safe-pin${x > W * 0.6 ? ' cbg-safe-pin--l' : ''}" style="--x:${pc((x / W) * 100)}%;--y:${pc((y / H) * 100)}%" data-cbg-x="${pc((x / W) * 100)}">`
    + `<b>${i + 1}</b><span class="cbg-safe-pin__hz">${esc(hazard)}</span><span class="cbg-safe-pin__ok">${esc(control)}</span></span>`;
  return `<div class="cbg-hazard cbg-safe" data-cbg-safe><div class="cbg-frame"><div class="cbg-safe__view">${after}`
    + `<div class="cbg-safe__before" aria-hidden="true">${before}</div>`
    + `<p class="cbg-safe__tag cbg-safe__tag--after" aria-hidden="true">${esc(safe.after)}</p>`
    + `<p class="cbg-safe__tag cbg-safe__tag--before" aria-hidden="true">${esc(safe.before)}</p>`
    + `<div class="cbg-safe__pins" aria-hidden="true">${safe.fixes.map(pin).join('')}</div>`
    + `<input class="cbg-safe__range" type="range" min="0" max="100" step="1" value="100" aria-label="${esc(safe.slider)}" hidden></div></div>`
    + `<ol class="cbg-safe-list">${safe.fixes.map(({ hazard, control }, i) =>
      `<li><b aria-hidden="true">${i + 1}</b> <span><s>${esc(hazard)}</s> <strong>${esc(control)}</strong></span></li>`).join('')}</ol></div>`;
}

// Risk matrix. Score bands by likelihood x severity: 1-4, 5-9, 10-16, 20-25.
export const band = (score: number) => (score <= 4 ? 0 : score <= 9 ? 1 : score <= 16 ? 2 : 3);

// Where each of a list of cells' markers sits, in % of the 5x5 grid: the cell's centre, markers sharing a
// cell side by side. Likelihood 5 is the top row, severity 5 the right column.
export function slots(cells: number[][]) {
  return cells.map(([l, s], i) => {
    const same = cells.flatMap((c, j) => (c[0] === l && c[1] === s ? [j] : []));
    const k = same.indexOf(i);
    const dx = (k - (same.length - 1) / 2) * 0.42;
    return { x: pc(((s - 0.5 + dx) / 5) * 100), y: pc(((5 - l + 0.5) / 5) * 100) };
  });
}

export function riskMatrix(m: NonNullable<Hero['matrix']>) {
  const from = slots(m.risks.map((r) => r.from));
  const to = slots(m.risks.map((r) => r.to));
  const cells = [5, 4, 3, 2, 1].flatMap((l) => [1, 2, 3, 4, 5].map((s) => `<i class="cbg-cell cbg-cell--${band(l * s)}"></i>`)).join('');
  const marker = (cls: string, p: { x: number; y: number }, i: number, extra = '') =>
    `<b class="cbg-risk${cls}" style="--x:${p.x}%;--y:${p.y}%"${extra}>${i + 1}</b>`;
  const rating = ([l, s]: number[]) => `${esc(m.levels[band(l * s)])} (${l * s})`;
  return `<figure class="cbg-diagram cbg-matrix" data-cbg-matrix><figcaption class="cbg-diagram__label">${esc(m.label)}</figcaption>`
    + '<div class="cbg-matrix__plot" aria-hidden="true">'
    + `<span class="cbg-matrix__axis cbg-matrix__axis--y">${esc(m.likelihood)}</span>`
    + `<div class="cbg-matrix__grid">${cells}`
    + from.map((p, i) => marker(' cbg-risk--was', p, i)).join('')
    + to.map((p, i) => marker('', p, i, ` data-cbg-from="${from[i].x} ${from[i].y}"`)).join('')
    + `</div><span class="cbg-matrix__axis cbg-matrix__axis--x">${esc(m.severity)}</span></div>`
    + '<p class="cbg-matrix__key" aria-hidden="true">'
    + m.levels.map((name, i) => `<span><i class="cbg-cell--${i}"></i>${esc(name)}</span>`).join('')
    + `<span><b class="cbg-risk cbg-risk--was"></b>${esc(m.before)}</span><span><b class="cbg-risk"></b>${esc(m.after)}</span></p>`
    + `<ol class="cbg-matrix-list">${m.risks.map((r, i) =>
      `<li><b aria-hidden="true">${i + 1}</b> <span><strong>${esc(r.hazard)}</strong> ${esc(m.before)}: ${rating(r.from)}. `
      + `${esc(m.after)}: ${rating(r.to)}. ${esc(r.control)}.</span></li>`).join('')}</ol></figure>`;
}

// Hierarchy of control: the inverted triangle, most effective (widest) at the top, each tier with its
// example from the site beside it.
export function hierarchy(t: NonNullable<Hero['hierarchy']>) {
  const n = t.tiers.length;
  return `<figure class="cbg-diagram cbg-tiers" data-cbg-tiers style="--n:${n}"><figcaption class="cbg-diagram__label">${esc(t.label)}</figcaption>`
    + `<div class="cbg-tiers__body"><p class="cbg-tiers__scale"><span>${esc(t.most)}</span><i aria-hidden="true"></i><span>${esc(t.least)}</span></p>`
    + `<ol class="cbg-tiers__list">${t.tiers.map(({ name, example }, i) =>
      `<li class="cbg-tier" style="--i:${i}"><span class="cbg-tier__bar"><strong>${esc(name)}</strong></span>`
      + `<span class="cbg-tier__ex">${esc(example)}</span></li>`).join('')}</ol></div></figure>`;
}

// Swiss cheese model: the hazard's ray runs left to right through every layer's hole towards the incident.
// Finished state: the fixed layer's hole is closed, the ray stops there (the part beyond it faint) and the
// incident is struck through, with the `stopped` line under it.
export function swissCheese(c: NonNullable<Hero['cheese']>) {
  const n = c.layers.length;
  const f = c.layers.findIndex((l) => l.fix);
  const stop = pc(((f + 0.5) / n) * 100);
  return `<figure class="cbg-diagram cbg-cheese" data-cbg-cheese style="--n:${n};--stop:${stop}%"><figcaption class="cbg-diagram__label">${esc(c.label)}</figcaption>`
    + '<div class="cbg-cheese__stage">'
    + `<p class="cbg-cheese__end cbg-cheese__end--from">${esc(c.hazard)}</p>`
    + '<div class="cbg-cheese__track" aria-hidden="true"><i class="cbg-cheese__ray cbg-cheese__ray--in"></i><i class="cbg-cheese__ray cbg-cheese__ray--out"></i>'
    + c.layers.map((l, i) => `<span class="cbg-slice${l.fix ? ' is-fix' : ''}" style="--i:${i}"><i class="cbg-slice__hole"></i></span>`).join('')
    + '</div>'
    + `<p class="cbg-cheese__end cbg-cheese__end--to"><s>${esc(c.incident)}</s> <strong>${esc(c.stopped)}</strong></p></div>`
    + `<ol class="cbg-cheese__layers">${c.layers.map((l) => `<li${l.fix ? ' class="is-fix"' : ''}><strong>${esc(l.name)}</strong> `
      + (l.fix ? `<s>${esc(l.hole)}</s> <span>${esc(l.fix)}</span>` : `<span>${esc(l.hole)}</span>`) + '</li>').join('')}</ol></figure>`;
}
