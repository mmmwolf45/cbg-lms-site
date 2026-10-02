import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { counted, courseSection, head } from './course-shared';

type Unit = Section<'units'>['units'][number];

// Building section drawing: one floor per unit, Unit 1 at the bottom (the foundation), the last unit
// at the top (the roof). Floor heights follow each unit's hours. Decorative: the list below carries the facts.
// viewBox 200 x 300: walls x 28..172, floors stacked from the ground (y 276) up to y 36.
// A floor needs about 20 units of height for its labels: if any would be lower than that, every floor
// gets that much plus its share of the rest. src/motion/build80.ts reads the number before `short`.
function drawing(units: Unit[], total: number, short: string) {
  const min = Math.min(20, 240 / units.length);
  let heights = units.map((u) => u.glh * (240 / total));
  if (heights.some((h) => h < min)) heights = units.map((u) => min + u.glh * ((240 - min * units.length) / total));
  let y = 276;
  const lines = [276];
  const floors = units.map((u, i) => {
    const h = heights[i];
    y -= h;
    lines.push(y);
    const mid = (y + h / 2 + 3.5).toFixed(1);
    // A dashed centre column through each floor, between the two labels.
    return `<g class="cbg-floor" data-cbg-floor="${i + 1}"><rect x="28" y="${y.toFixed(1)}" width="144" height="${h.toFixed(1)}"/>`
      + `<path d="M100 ${(y + 4).toFixed(1)}v${(h - 8).toFixed(1)}"/>`
      + `<text x="38" y="${mid}">${esc(u.code)}</text><text class="cbg-floor__glh" x="162" y="${mid}" text-anchor="end">${u.glh} ${esc(short)}</text></g>`;
  });
  // Dimension line on the right: a tick at every floor line.
  const ticks = lines.map((t) => `M182 ${t.toFixed(1)}h8`).join('');
  return `<svg class="cbg-build__svg" viewBox="0 0 200 300" aria-hidden="true" focusable="false">`
    + `<path class="cbg-build__ground" d="M6 276h188M14 276l-6 8M30 276l-6 8M46 276l-6 8M62 276l-6 8M78 276l-6 8M94 276l-6 8M110 276l-6 8M126 276l-6 8M142 276l-6 8M158 276l-6 8M174 276l-6 8M190 276l-6 8"/>`
    + floors.join('')
    + `<path class="cbg-build__roof" d="M22 36h156"/><path class="cbg-build__dim" d="M186 36v240${ticks}"/></svg>`;
}

// running: hours built up to and including this unit ("48 / 80"), shown only on narrow columns,
// where the building drawing sits above the list instead of beside it. Decorative: each unit's own
// hours are already in the text.
const unit = (u: Unit, i: number, hours: string, running: number, total: number) => `<li class="cbg-card cbg-unit" data-cbg-unit="${i + 1}">
<p class="cbg-unit__meta"><span class="cbg-chip">${esc(u.code)}</span><span>${u.glh} ${esc(hours)}<span class="cbg-unit__running" aria-hidden="true">${running} / ${total}</span></span></p>
<h3 class="cbg-h3">${esc(u.title)}</h3>
<ul class="cbg-outcomes">${u.outcomes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
<ol class="cbg-sessions">${u.sessions.map((s) => `<li><span>${esc(s.id)}</span> ${esc(s.title)}</li>`).join('')}</ol>
</li>`;

// data-cbg-build: T24 builds the floors one by one ([data-cbg-floor]) as the units ([data-cbg-unit]) scroll by.
export const units = (s: Section<'units'>) => {
  const total = s.units.reduce((n, u) => n + u.glh, 0);
  const hours = s.hoursLabel ?? 'guided learning hours';
  return courseSection('units', `${head(s.heading, s.intro)}
<div class="cbg-build">
<div class="cbg-build__plan">${drawing(s.units, total, s.hoursShort ?? 'GLH')}<p class="cbg-build__total"><b>${counted(total)}</b><span>${esc(hours)}</span></p></div>
<ol class="cbg-units">${s.units.map((u, i) => unit(u, i, hours, s.units.slice(0, i + 1).reduce((n, x) => n + x.glh, 0), total)).join('')}</ol>
</div>`, ' data-cbg-build');
};
