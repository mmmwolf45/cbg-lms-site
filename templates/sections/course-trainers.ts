import { esc, picture } from '../../src/components/html';
import images from '../../src/images.json';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';

type Trainer = Section<'trainers'>['trainers'][number];

// trainers[].photo "elman-aloysius.jpg" is built as the image "trainer-elman-aloysius" (src/images.json).
// alt is empty: the name is the heading right beside the photo.
function photo(file: string) {
  const name = `trainer-${file.replace(/\.[a-z]+$/i, '')}`;
  if (!(name in images)) throw new Error(`trainers.photo: no built image "${name}" for ${file} (run npm run images)`);
  return `<div class="cbg-trainer__photo">${picture(name as keyof typeof images, { alt: '', sizes: '112px' })}</div>`;
}

const card = (t: Trainer) => `<li class="cbg-card cbg-trainer">
${photo(t.photo)}
<div class="cbg-trainer__body">
<h3 class="cbg-h3">${esc(t.name)}</h3>
<p class="cbg-tag">${esc(t.role)}</p>
<p>${esc(t.bio)}</p>
<ul class="cbg-points">${t.credentials.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
</div>
</li>`;

export const trainers = (s: Section<'trainers'>) => courseSection('trainers', `${head(s.heading)}
<ul class="cbg-trainers" data-cbg-reveal="stagger">${s.trainers.map(card).join('')}</ul>`);
