import { esc } from '../../src/components/html';
import type { Course } from '../../content/schema';
import { counted, courseSection, head } from './course-shared';

type Unit = Course['units']['units'][number];

// Building section drawing: one floor per unit, Unit 1 at the bottom (the foundation), the last unit
// at the top (the roof). Floor heights follow each unit's GLH. Decorative: the list below carries the facts.
// viewBox 200 x 300: walls x 28..172, floors stacked from the ground (y 276) up to y 36.
function drawing(units: Unit[], total: number) {
  const scale = 240 / total;
  let y = 276;
  const floors = units.map((u, i) => {
    const h = u.glh * scale;
    y -= h;
    const mid = (y + h / 2 + 3.5).toFixed(1);
    // A dashed centre column through each floor, between the two labels.
    return `<g class="cbg-floor" data-cbg-floor="${i + 1}"><rect x="28" y="${y.toFixed(1)}" width="144" height="${h.toFixed(1)}"/>`
      + `<path d="M100 ${(y + 4).toFixed(1)}v${(h - 8).toFixed(1)}"/>`
      + `<text x="38" y="${mid}">${esc(u.code)}</text><text class="cbg-floor__glh" x="162" y="${mid}" text-anchor="end">${u.glh} GLH</text></g>`;
  });
  // Dimension line on the right: a tick at every floor line.
  const ticks = [276, ...units.map((_, i) => 276 - units.slice(0, i + 1).reduce((n, u) => n + u.glh, 0) * scale)]
    .map((t) => `M182 ${t.toFixed(1)}h8`).join('');
  return `<svg class="cbg-build__svg" viewBox="0 0 200 300" aria-hidden="true" focusable="false">`
    + `<path class="cbg-build__ground" d="M6 276h188M14 276l-6 8M30 276l-6 8M46 276l-6 8M62 276l-6 8M78 276l-6 8M94 276l-6 8M110 276l-6 8M126 276l-6 8M142 276l-6 8M158 276l-6 8M174 276l-6 8M190 276l-6 8"/>`
    + floors.join('')
    + `<path class="cbg-build__roof" d="M22 36h156"/><path class="cbg-build__dim" d="M186 36v240${ticks}"/></svg>`;
}

const unit = (u: Unit, i: number, hours: string) => `<li class="cbg-card cbg-unit" data-cbg-unit="${i + 1}">
<p class="cbg-unit__meta"><span class="cbg-chip">${esc(u.code)}</span><span>${u.glh} ${esc(hours)}</span></p>
<h3 class="cbg-h3">${esc(u.title)}</h3>
<ul class="cbg-outcomes">${u.outcomes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
<ol class="cbg-sessions">${u.sessions.map((s) => `<li><span>${esc(s.id)}</span> ${esc(s.title)}</li>`).join('')}</ol>
</li>`;

// data-cbg-build: T24 builds the floors one by one ([data-cbg-floor]) as the units ([data-cbg-unit]) scroll by.
export const units = (c: Course) => {
  const s = c.units;
  const total = s.units.reduce((n, u) => n + u.glh, 0);
  // The hours label comes from the hero fact that counts to the same total ("guided learning hours").
  const hours = c.hero.facts.find((f) => f.count === total)?.label ?? 'GLH';
  return courseSection('units', `${head(s.heading, s.intro)}
<div class="cbg-build">
<div class="cbg-build__plan">${drawing(s.units, total)}<p class="cbg-build__total"><b>${counted(total)}</b><span>${esc(hours)}</span></p></div>
<ol class="cbg-units">${s.units.map((u, i) => unit(u, i, hours)).join('')}</ol>
</div>`, ' data-cbg-build');
};
