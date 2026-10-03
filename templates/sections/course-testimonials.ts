import { PAGES, esc } from '../../src/components/html';
import images from '../../src/images.json';
import type { Section } from '../../content/schema';
import { courseSection, head } from './course-shared';
import { built, mono } from './course-trainers';

type Quote = Section<'testimonials'>['quotes'][number];

// A learner's round photo (photo "rinsha-v.jpg" is the image "student-rinsha-v"), or their initials until
// it is built. One lazy WebP <img>, the single 80px build (sharp at 2x), rather than a full <picture>
// or a srcset: the placement wall puts about 60 of these in one pasted block, and every extra URL adds to
// its size for 2 KB images. alt is empty: the name is right beside it.
export const face = (name: string, photo?: string) => {
  const img = built('student', photo);
  if (!img) return mono(name);
  const { width, height, variants } = images[img];
  return `<img class="cbg-face" src="${PAGES}${variants.webp[0]!.file}" width="${width}" height="${height}" alt="" loading="lazy" decoding="async">`;
};

// Word for word: the text is never trimmed. The gold quote mark is CSS (qs.css).
const quote = (q: Quote) => `<li><figure class="cbg-quote">
<blockquote><p>${esc(q.text)}</p></blockquote>
<figcaption>${face(q.name, q.photo)}<span><b>${esc(q.name)}</b>${q.role ? `<span>${esc(q.role)}</span>` : ''}</span></figcaption>
</figure></li>`;

// Two columns from a 540px column (with an odd count the first quote leads, across both); narrower, a
// swipeable scroll-snap row that takes keyboard focus (arrow keys), like the field-guide shelf. While it
// is a grid, src/motion/qs-sections.ts takes it out of the tab order.
export const testimonials = (s: Section<'testimonials'>) => courseSection('testimonials', `${head(s.heading, s.intro)}
<div class="cbg-quotes" tabindex="0" role="region" aria-label="${esc(s.heading)}"><ul data-cbg-reveal="stagger">${s.quotes.map(quote).join('')}</ul></div>
${s.smallPrint ? `<p class="cbg-small cbg-fine">${esc(s.smallPrint)}</p>` : ''}`);
