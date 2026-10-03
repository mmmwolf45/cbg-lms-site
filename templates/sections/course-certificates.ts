import { esc, logo } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';

type Cert = Section<'certificates'>['certs'][number];

// Our own drawn sheet of paper on each card (paper, gold keyline, the title, the CBG mark as its seal):
// decorative, the h3 says it. The sheets sit tilted while the cards rise and straighten once they land (qs.css).
const sheet = (c: Cert) => `<div class="cbg-cert__desk" aria-hidden="true"><div class="cbg-cert__sheet cbg-cert__sheet--drawn"><b>${esc(c.title)}</b>${logo('cbg-mark-512.png', '', 'sm', 'cbg-cert__seal')}</div></div>`;

const card = (c: Cert) => `<li class="cbg-card cbg-cert">
${sheet(c)}
<h3 class="cbg-h3">${esc(c.title)}</h3>
<p>${esc(c.body)}</p>
</li>`;

// The rules for earning them (only when the YAML gives both label and rules): a checklist with gold ticks.
export const certificates = (s: Section<'certificates'>) => courseSection('certificates', `${head(s.heading, s.intro)}
<ul class="cbg-certs" data-cbg-reveal="stagger">${s.certs.map(card).join('')}</ul>
${s.rulesLabel && s.rules?.length ? `<div class="cbg-rules" data-cbg-reveal>
<h3 class="cbg-h3">${esc(s.rulesLabel)}</h3>
<ul class="cbg-ticks">${s.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
</div>` : ''}`);
