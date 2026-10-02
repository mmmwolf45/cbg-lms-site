// Small pieces shared by the course sections (templates/sections/course-*.ts).
import { esc } from '../../src/components/html';

// One section, per docs/markup-contract.md. The extra class is `cbg-c-<id>`, not `cbg-<id>` like the
// home helper, because `.cbg-hero`, `.cbg-faq` and `.cbg-course` already mean something in home.css
// and components.css.
export const courseSection = (id: string, inner: string, attrs = '') =>
  `<section id="cbg-${id}" class="cbg-section cbg-c-${id}" data-cbg-section="${id}"${attrs}><div class="cbg-wrap">${inner}</div></section>`;

// Two-tone heading: everything after the first ":", ",", "?" or "." that is followed by more words
// is the dimmed tail ("Stuck on anything? <dim>Message us.</dim>"). No such break: one tone.
export function twoTone(text: string) {
  const m = /^(.+?[:,?.])\s+(\S.*)$/.exec(text);
  return m ? `${esc(m[1])} <span class="cbg-dim">${esc(m[2])}</span>` : esc(text);
}

// A section head: h2 (two-tone) plus an optional intro paragraph, revealed as one.
export const head = (heading: string, intro?: string) =>
  `<div class="cbg-section-head" data-cbg-reveal><h2 class="cbg-h2">${twoTone(heading)}</h2>${intro ? `<p>${esc(intro)}</p>` : ''}</div>`;

// The counter contract: the counted number is hidden from screen readers, which read the sr-only copy.
export const counted = (n: number, text = String(n)) =>
  `<span aria-hidden="true" data-cbg-count="${n}">${esc(text)}</span><span class="cbg-sr-only">${esc(text)}</span>`;

// 24px line icons, stroke 1.5 (stroke and fill are set in course.css). `d` may hold several subpaths.
export const icon = (d: string) =>
  `<svg class="cbg-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;

export const ICONS = {
  seal: 'M12 3a6 6 0 1 0 0 12a6 6 0 1 0 0-12zM12 6.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5zM9 14.2 7.5 21l4.5-2.2 4.5 2.2-1.5-6.8',
  stack: 'M7 3.5h12A1.5 1.5 0 0 1 20.5 5v10M4.5 7h11A1.5 1.5 0 0 1 17 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 18.5v-10A1.5 1.5 0 0 1 4.5 7zM6.5 11.5h7M6.5 15h4',
  book: 'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13',
  slides: 'M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 14.5zM12 16v4M8 20h8M7 12l3-3 2.5 2L17 7.5',
  clipboard: 'M8.5 4.5h-2A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5h-2M9 3h6v3H9zM9 13l2 2 4-4',
  video: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5zM15 10.5l6-3.5v10l-6-3.5',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8 3v4M16 3v4',
  chat: 'M8 16H5.5A1.5 1.5 0 0 1 4 14.5v-9A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H12l-4 4zM8 8.5h8M8 11.5h5',
  laptop: 'M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V16H5zM2.5 16h19l-1 3h-17z',
  note: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 7.5v.5',
} as const;

// Pick an icon by position, cycling, so a course with more items still renders.
export const nth = <T>(list: readonly T[], i: number) => list[i % list.length];
