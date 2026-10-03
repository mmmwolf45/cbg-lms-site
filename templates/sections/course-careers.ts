import { esc } from '../../src/components/html';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';

// Where the course leads: each role as a large chip, revealed one after another.
export const careers = (s: Section<'careers'>) => courseSection('careers', `${head(s.heading, s.intro)}
<ul class="cbg-roles" data-cbg-reveal="stagger">${s.roles.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`);
