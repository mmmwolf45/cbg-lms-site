import { esc, picture } from '../../src/components/html';
import images from '../../src/images.json';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';

type Trainer = Section<'trainers'>['trainers'][number];
type ImageName = keyof typeof images;

// A person's photo as built by `npm run images`: trainers[].photo "elman-aloysius.jpg" is the image
// "trainer-elman-aloysius" (src/images.json). Undefined when there is no photo or it isn't built yet:
// photos arrive over time, so the card shows initials instead of failing the build.
export function built(prefix: string, file?: string): ImageName | undefined {
  const stem = file?.replace(/\.[a-z]+$/i, '');
  const name = stem && `${prefix}-${stem}`;
  return name && name in images ? (name as ImageName) : undefined;
}

// First letters of the first and last words ("Ramshad KK" -> "RK"), letters only.
export const initials = (name: string) => {
  const words = name.split(/\s+/).map((w) => w.match(/\p{L}/u)?.[0] ?? '').filter(Boolean);
  return (words.length > 1 ? words[0] + words[words.length - 1] : words[0] ?? '').toUpperCase();
};

// Gold initials on navy, where a photo would be. Decorative: the name is right beside it.
export const mono = (name: string) => `<span class="cbg-mono" aria-hidden="true">${esc(initials(name))}</span>`;

// alt is empty: the name is the heading right beside the photo.
function face(t: Trainer, compact: boolean) {
  const name = built('trainer', t.photo);
  if (!name) return mono(t.name);
  return `<div class="cbg-trainer__photo">${picture(name, { alt: '', sizes: compact ? '64px' : '112px' })}</div>`;
}

const card = (t: Trainer, compact: boolean) => `<li class="cbg-card cbg-trainer">
${face(t, compact)}
<div class="cbg-trainer__body">
<h3 class="cbg-h3">${esc(t.name)}</h3>
<p class="cbg-tag">${esc(t.role)}</p>
<p>${esc(t.bio)}</p>
${t.credentials?.length ? `<ul class="cbg-points">${t.credentials.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
</div>
</li>`;

// A long faculty (more than 4) is a compact two-column grid with small photos; a short one keeps the
// large single-column cards (IOSH's 3).
export const trainers = (s: Section<'trainers'>) => {
  const compact = s.trainers.length > 4;
  return courseSection('trainers', `${head(s.heading, s.intro)}
<ul class="cbg-trainers${compact ? ' cbg-trainers--grid' : ''}" data-cbg-reveal="stagger">${s.trainers.map((t) => card(t, compact)).join('')}</ul>`);
};
