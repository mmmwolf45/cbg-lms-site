# Spec: CBG LMS site on course.link

**Status:** Approved by Maasoom, 2 Oct 2026 (all five open questions answered yes; see section 13).
**Sources:** `docs/intent/cbg-lms-site.md` (confirmed direction), the handover pack (`CLAUDE_CODE_BRIEF.md`, `PLATFORM_NOTES.md`, `DEPLOY_RUNBOOK.md`), `brand/BRAND.md`, `content/`.
Where this spec and the brief differ, this spec wins once approved. Every difference is marked **(change from brief)**.

---

## 1. Objective

Build fully custom, animated, dark pages for CBG's student site on course.link (`cbgtraininginstitute.course.link`), in this order:

1. **Home page** (Phase A)
2. **IOSH Level 3 course page** (Phase B)
3. **Reusable course template** (Phase C)

**User:** Enrolled students. Many use phones, and many read English as a second language. Most arrive from a WhatsApp link after paying.

**Success:** A student lands and feels "I chose a serious institute". They log in and find their course in seconds. Every page works perfectly at 390px and at 1440px and stays within the performance budget (section 8).

**Look:** The Generalist's restraint (dark canvas, white text in three strengths, one rare accent, two-tone headlines, chips, hairlines), translated into CBG navy-black and gold. There's more motion than The Generalist, but it should feel engineered and calm, never bouncy. Full rationale: `docs/intent/cbg-lms-site.md`.

**Page background (3 Oct 2026, "Flow on scroll"):** on home and course pages the canvas is a navy gradient, darker at the edges. A still version (fixed `body::before`, critical.css) is the first paint and the fallback; `src/motion/flow.ts` draws flowing navy and blue waves on a fixed WebGL canvas over it (about a third of screen resolution, about 1.4 KB). Scroll position is its clock, so it moves only while the page scrolls and stays still under reduced motion. Body, our block roots, the course header band and the course wrapper are see-through; panels (enrol card, logo panels, cards) keep their own fills. Muted text keeps at least 4.5:1 against the brightest pixel (measured 4.8:1).

### Capability map
The work splits into modules that can be built and checked separately. Module ids are stable.

| Module id | Responsibility | Depends on |
|---|---|---|
| `loader` | Custom Script snippet: fonts, `noindex`, manifest fetch, page detection, route-change re-init, fail-safe | none |
| `system` | Design tokens, base block styles, shared components (chip, card, button, section header, gold thread), motion tokens and helpers | none |
| `native` | CSS restyles of course.link's own elements on home and course routes | `system` |
| `home` | Home page block and its motion | `system`, `loader` |
| `course-iosh` | IOSH course page blocks and their motion | `system`, `loader`, `native` |
| `course-template` | Any course rendered from one content file | `course-iosh` |

**Build order:** `loader` + `system` → `home` (with `native` for home) → `course-iosh` (with `native` for course) → `course-template`.
This stays as one spec, as the brief asks; the modules are sections of it, not separate specs.

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | As the brief recommends |
| Bundler | Vite | As the brief recommends; outputs hashed files |
| Motion | GSAP core + ScrollTrigger | No other plugins unless justified in a task |
| Styling | **Plain CSS with a `cbg-` prefix, scoped under `[data-cbg]`. No Tailwind.** **(choice the brief left open)** | Smallest CSS, no risk of touching course.link's own Tailwind classes, no prefix configuration to maintain. Tokens are CSS custom properties. Vite handles CSS nesting. |
| Content | **YAML files** in `content/` **(change from brief: brief said "structured data, built from content/*.md")** | Easy for a non-developer to edit, validated by a schema at build. The current `.md` files move to `docs/copy-deck/` as the original copy deck once converted. The YAML becomes the only source. |
| Block HTML | TypeScript template functions `(data) => string`, run at build time | Static, real HTML that reads correctly with JS off; no framework runtime |
| Images | `sharp` at build: AVIF + WebP + JPEG fallback, plus the trainer duotone treatment | Meets the image rules in the brief |
| Hosting | GitHub Pages from `dist/`, repo `mmmwolf45/cbg-lms-site` (public), base `/cbg-lms-site/` | As the brief and runbook say |
| Fonts | Google Fonts `<link>` in the loader: **Plus Jakarta Sans** (700, 800) and **Source Sans 3** (400, 600) | Maasoom's choice. No monospace. |
| Unit tests | Vitest | |
| Browser tests | Playwright + `@axe-core/playwright` | As the brief says (playwright-cli skill) |

**Dependencies to install** (all dev-time except `gsap`): `vite`, `typescript`, `gsap`, `yaml`, `tsx`, `sharp`, `vitest`, `@playwright/test`, `@axe-core/playwright`. Anything else needs Maasoom's OK.

**No React, no three.js, no WebGL, no video.** The 3D look comes from 2D canvas or SVG.

---

## 3. Commands

```
npm install                 # once
npm run dev                 # build, then serve the mock course.link at http://localhost:4173/ and /course/preview-101
npm run serve               # serve the last build (scripts/serve.ts) without rebuilding
npm run content:check       # validate content/*.yaml against the schema
npm run images              # build AVIF/WebP/JPEG variants into public/img/
npm run build               # vite build + render blocks + write manifest.json + loader-snippet.html + size check
npm test                    # Vitest unit tests
npm run test:e2e            # Playwright at 1440 / 1024 / 768 / 390, incl. JS-blocked and reduced-motion runs
npm run test:e2e -- --project=live   # same checks against /course/preview-101 (read-only)
npm run check:size          # gzip budget check (fails the build when over)
```

---

## 4. Project structure

```
brand/                  tokens.css + assets (from the handover pack)
content/
  home.yaml
  courses/iosh-level-3.yaml
  schema.ts             types + validation for both
docs/
  intent/               confirmed direction
  copy-deck/            original .md copy (reference only, after conversion)
  art-direction.md      photo series brief + ChatGPT prompts (Phase 1)
preview/                mock course.link pages for local dev and Playwright
public/img/             built images (served by Pages)
scripts/
  build-blocks.ts       renders templates + content into dist/blocks/*.html
  build-loader.ts       writes dist/loader-snippet.html + dist/manifest.json
  images.ts             sharp pipeline
  check-size.ts         gzip budget gate
src/
  main.ts               bundle entry: page detection → setup/teardown
  pages.ts              { "101": "iosh-level-3" } and path → page logic
  styles/
    tokens.css          final tokens (Phase 1), mirrors brand/tokens.css
    base.css            [data-cbg] base styles
    components.css
    native-overrides.css  ONLY selectors listed in section 6
  components/           template functions (chip, card, button, section-header, thread…)
  motion/
    tokens.ts           durations + eases (mirrors CSS tokens; GSAP can't read CSS vars)
    reveal.ts thread.ts counters.ts
    blueprint.ts        home hero
    hazard-scan.ts      course hero
    build80.ts          units section
    hand.ts             included section
templates/
  home.ts
  course.ts             renders any course from its YAML
tests/                  Vitest
e2e/                    Playwright
dist/                   build output (published by Pages)
```

---

## 5. Pages and sections

Section ids come from `content/` and are used as `id="cbg-<section>"` in the HTML. Headings: our section headings are `h2`, card titles are `h3`.

**Motion rules for every section:**
- Content is fully visible without JS. Hidden starting states only apply under `html.cbg-js`.
- With `prefers-reduced-motion: reduce`: no scroll-jacking, no pinning, no parallax, no counters (final numbers shown). Short opacity fades only.
- Default reveal: elements rise 16px and fade in over the base duration, staggered by 60 to 80ms, once per element.

### 5.1 Home page (`/`)

**Replaces course.link's native Banner and Courses sections** (switched off in course.link, not hidden with CSS). The block is a single Custom Block. Copy and order are exactly as in `content/home.md`, with the 3 Oct 2026 changes noted at the top of `content/home.yaml` (the home page speaks for the whole institute).

The home page has no `h1` today. The hero headline becomes the page's `h1`.

| Section | Layout | Motion | Phone (390px) |
|---|---|---|---|
| `hero` | **Exploding building (3 Oct 2026, replaces Blueprint to built):** chip above; a very large centred `h1` ("Welcome / to your / classroom", "classroom" in gold; poster scale, about 13vw, capped by screen height) over a photoreal building, with the CBG mark very faint (4%, in colour) behind it; the subhead under it, then Log in / Need help?. The chip fades as the first line rises. Details: section 5.1.1. | The hero holds (sticky) for half a screen of scrolling while 48 frames of the building come apart floor by floor; the headline comes apart with it (lines separate, words drift and tilt, letters open; "classroom" stays sharp). Mouse: the building tilts in 3D (7deg/4deg at most). Reduced motion: the assembled building and the whole headline, still | Same, frames at 640px; headline wraps to three lines |
| `facts` | Three facts on a hairline: number of courses and of languages (counted from the course files at build time), and "Online / every course" | Counters count up once in view | Three narrow columns |
| `disciplines` | The course titles (from the cards) on one strip, gold rules between; decorative, `aria-hidden` | Moves only with scroll (CSS scroll-driven animation): drifts left by a quarter of the screen while the strip crosses the screen, never on a timed loop. Still (wrapped, centred) under reduced motion or where the browser lacks scroll-driven animations | Same |
| `how-it-works` | Three numbered steps (01, 02, 03) | The **gold thread** links the step numbers and draws as you scroll; each number lights gold when the thread reaches it. | Vertical, thread at the left edge |
| `band` (optional) | A full-width decorative photo (`band-classroom`), shown once the image is built | Gentle scroll parallax (full motion only) | Same |
| `courses` | One card per course file in `content/courses/*.yaml` (card-only "coming soon" files too), in `card.order`: photo (4:3 crop; plain navy background until the photo is built), tag, status, title, line, chips. Live cards are one link ("Open course"); coming-soon cards are not links | Laptop (1024px+, 800px+ tall, mouse, full motion, panel fits): the section pins and scroll pans the card row sideways, gold progress line. Live cards on hover or focus: photo zooms to 1.06 over 0.8s, card tilts toward the mouse (4deg at most, mouse only), gold rule extends, soft gold edge light. Coming-soon cards stay still. Reduced motion: a still grid | Swipeable scroll-snap row (focusable region, arrow keys); 2 columns from 768px |
| `support` | Heading, body, WhatsApp button, one email link (info@) in a frosted-glass card | Reveal only | Full-width buttons |
| `about` | Text, CBG mark (on a plain dark area), link. No IOSH content on the home page: it lives on the IOSH course page | Reveal only | Logos stack |
| `footer-note` | Small print | None | Same |

#### 5.1.1 Hero: the exploding building
- **Footage:** `brand/assets/hero-explode/explode-a.mp4` (MiniMax H3 on Higgsfield, 2K, from `keyframe-assembled.png` to `keyframe-exploded.png`, 3 Oct 2026). `scripts/explode-frames.ts` (ffmpeg + sharp) cuts its first 5.2s into 48 square frames around the building: AVIF at 960px (about 2.4 MB) and 640px (about 1.3 MB); a screen whose smaller side is under 1100 device pixels gets the 640px set (so 2x phones and small laptop windows do; 3x phones get 960) in `public/img/hero-explode/`, plus a first-frame poster (AVIF/WebP/JPEG). Budget gate: 2.6 MB and 1.6 MB.
- **Loading:** the poster is the hero's `<picture>` (eager, high priority, width and height set: the LCP and the no-JS view). The script then loads frame 1, every 8th, every 4th, every 2nd, then the rest, and draws the nearest loaded frame, blending neighbours. If AVIF can't decode, the poster stays.
- **Scroll:** `.cbg-explode` is `calc(150svh - 56px)` tall; its stage is `position: sticky` under course.link's 56px navbar. Progress 0..1 across the extra half screen maps to frames 0..47.
- **Headline (effect A from the prototype):** one real `h1` for screen readers; an `aria-hidden` copy split into words and letters (built by the template) carries the motion, transforms only, so nothing reflows.
- **Without JS / fail-safe:** the poster and the whole headline, stacked, no sticky stretch.

**Hero CTAs:**
- **Log in:** course.link's login is a popup opened by the navbar's Login button; there is no login URL. With JS, our button clicks the native Login button. Without JS, it's a link to `#navbar`, and the text beside it says the Login button is at the top right.
- **"Go to my courses" when logged in:** only after a reliable logged-in signal is found with a test student account (open question 3). Until then, the CTA always says "Log in".
- **Need help?** links to `https://wa.me/97470485638`.

### 5.2 IOSH course page (`/course/101-…` and `/course/preview-101`)

**Two Custom Blocks, not one (change from brief; needs approval, open question 1):**
- **Block "top"**, placed above Course Content, holds only `hero`. A returning student wants their class links, so the page shouldn't make them scroll past nine sections to reach Course Content.
- **Block "main"**, placed below Course Content, holds every other section.

Course Content stays native and collapsed, so it stays short. course.link opens its first section on every load; the course enhancers close that untouched default once per page view (src/motion/start-here.ts), never a section the reader opened. Opening or closing sections changes the page height, so all scroll-linked motion re-measures (src/motion/setup.ts) or works from the live layout (src/motion/seen.ts).

**Page order:** native header → **top** (`hero`) → native Course Content accordion → **main** (`included` → `units` → `how-classes-run` → `assessment` → `trainers` → `bonus` → `field-guides` → `payments` → `faq` → `help`).

Course pages don't get an extra `h1`. The native course title stays an `h2`, as the brief allows.

**Weight of motion:**
- Hazard Scan is the loudest moment.
- What you leave with and the 80-hour build are medium.
- The gold thread is quiet.
- Everything else uses reveals only.

| Section | Layout | Motion | Phone (390px) |
|---|---|---|---|
| `hero` | Eyebrow chip, the qualification line (`h2`), subhead, **Hazard Scan** visual, key facts as chips, **Start here** CTA | **Hazard Scan:** a gold scan line sweeps the worksite photo (about 2.5s). As it passes each hazard, a marker pulses and its label chip appears. Then it rests with all markers shown. On laptop, hover, focus or click a marker to show its label. Key facts: the numbers count up (80 GLH, 4 units, 2 assessments, about 2 months); "Level 3" and the Ofqual number stay static. | **Guided tour:** after the sweep, one hazard is highlighted at a time with its label in a caption bar under the photo, plus Previous and Next buttons. Markers are 44px tap targets. |
| `included` | Heading, intro, 5 cards (IOSH Certificate card emphasised with a gold edge) | **What you leave with:** the 5 cards arrive as a fanned hand of cards, then deal out into their grid as the section scrolls into view. The certificate cards use our own stylised design with names only. No IOSH certificate artwork or partner logos. | Cards slide in one after another in a single column. No fan. |
| `units` | Heading, intro; 4 units, each with code, title, GLH, outcomes and session list; a **building section drawing** of 4 floors; a GLH counter | **80-hour build (laptop, 1024px and up):** the section pins **inside the 792px column**. As you scroll, each unit adds a floor (Unit 1 is the foundation, Unit 4 the roof), the GLH counter climbs 0 → 21 → 48 → 60 → 80, and the unit details panel changes. The pin lasts about 4 screen heights. It never overlaps the enrol card. | **No pinning.** Each unit is a card with its own floor drawing that builds as the card scrolls in. Each card shows the running total ("48 of 80 hours"). |
| `how-classes-run` | 5 items with line icons, plus the timetable note | Icons draw in, then reveal | 1 column |
| `assessment` | Intro; two assessment cards; the **4-task grid** (25 marks each); Tech IOSH note | The two cards slide in from opposite sides. The 4 quadrants fill one after another, each counting to 25. | Cards stack; the grid stays 2×2 |
| `trainers` | 3 trainer cards: photo (navy duotone, 112px), name, role, bio, credentials | Reveal; the photo duotone fades to about 30% colour on hover or focus (laptop only) | 1 column |
| `bonus` | Heading, intro, a path of 4 numbered steps, small print | The gold thread draws through the 4 steps in order | Vertical path |
| `field-guides` | Heading, body, a shelf of 8 covers: Guide 01 in full colour, the 5 named upcoming guides plus 2 unnamed ones outlined with "Coming soon" | The shelf fans open from a stack | Horizontal swipe row with scroll snap, plus a "Swipe" hint; also usable with arrow keys |
| `payments` | Calm note card | Fade only | Same |
| `faq` | 12 questions as native `<details>`/`<summary>` (works without JS), hairline dividers | JS adds a smooth height animation | Same |
| `help` | Closing band: heading, WhatsApp, email, CBG mark, IOSH 1003 mark | Reveal | Buttons full width |

**Gold thread on the course page:** runs down the left edge of each block (top and main separately), with a node at every section heading that lights gold when reached. It's scrubbed by scroll. With reduced motion, it's drawn fully and static.

**Start here CTA:** scrolls to `#course_content` and opens its **first** accordion item, found by position (first trigger in the list) or by the text "Start Here". Never by Radix id. Without JS, it's a plain `#course_content` link.

**New copy needed:** the Hazard Scan needs 4 to 6 hazard labels (for example "Unguarded edge", "Trailing cable"). These are new copy, so a CBG trainer signs them off before launch (open question 2). I'll draft them once the photo exists.

### 5.3 Course template (Phase C)
- `templates/course.ts` renders any `content/courses/<slug>.yaml`. Each section renders only if its data is present.
- The hero visual is chosen per course: `hero.visual: hazard-scan | photo | none`. The data for each lives in the YAML.
- `src/pages.ts` maps course.link `uniqueId` → slug.
- `HOW_TO_ADD_A_COURSE.md` explains the steps.
- A dummy second course renders correctly from content alone.

---

## 6. Native course.link restyles (`module: native`)

These apply only when the loader has marked the route: `html.cbg-route-home` or `html.cbg-route-course`. Lesson pages and every other route stay stock (light). Layout-affecting rules (marked ★) are inlined in the loader snippet, so the page doesn't shift while the main CSS loads.

| Selector (from PLATFORM_NOTES.md) | Route | Restyle |
|---|---|---|
| `body` | home, course | Navy-black background ★. On course, `!important` (course.link's course page ships `body{background:white!important}` via react-helmet) |
| `html` (root, carries the route class) | home, course | Dark scrollbar (`scrollbar-color` only) |
| `#navbar` | home, course | Dark, translucent, hairline bottom border; Login and Register as ghost buttons ★ |
| `#courses` (native catalogue) | home | **Hidden** while our home block is on the page (`:has([data-cbg="home"])`) ★. Change from the plan: course.link locks the Courses section on, so it can't be switched off. Falls back to visible if our block or CSS is missing. |
| `#navbar .navbar-title-container` (+ its `img`) and `.navbar-title-container + div button` (Register: `button.bg-primary`) | home, course | Logo on a 2px white keyline, unaltered; Login ghost pill, Register solid pill, gold focus ring ★ |
| `#course-header-bg` (+ its decorative `> [aria-hidden="true"]` overlay) | course | Navy-black with a faint blueprint grid, painted as `background-image` over course.link's inline theme colour ★; the overlay's inline white glow dimmed with `opacity` |
| `#course-header-bg + div` (divider under the band) | course | Hairline border colour |
| `#course-header` (`h2`, `h2 + p`, `ul > li`, `ul + div > div > button`, `ul + div > button`, `img`, `:has(> #widget2)`) | course | Title in Plus Jakarta Sans 800 with tight tracking and a short gold rule (out-of-flow `::after`) ★; subtitle `--cbg-text-2`; stats as chips ★; enrol button as a pill (its inline white/#333 colours kept); Share this course as a quiet link (`opacity`); course image with media radius and hairline. The preview `iframe#widget2` is left alone (only its container is rounded); neither live course URL has one today. |
| `#react-root > div:has(#course_content)` (the `div.bg-white.py-12` main wrapper) | course | Dark background ★; course.link's colour variables (`--background`, `--foreground`, `--muted-foreground`, `--input`, `--border`, `--secondary`, `--muted`, `--accent`, `--card`) redefined dark inside it ★ |
| `#highlights` (`h4`, `li`, `li svg`) | course | "This course includes" (below 1024px): text colours, gold check icons |
| Enrol card: `div:has(> #course_content) + div` (the element after the main column) | course | Dark glass card (18px radius from 1024px), hairline border, `--cbg-btn` pill button, gold check icons ★ (background). Same element is the phone bottom bar. Position, top, display, height untouched. |
| `#course_content` (Radix accordion: `> div:first-child > h4`/`> button`, `.accordion-py`, `h3 > button`, `[role="region"] [role="button"]`) | course | "Course Content" in our h2 style ★; Expand all as a ghost text button; dark rows with hairline dividers, gold chevrons, gold number circle on the open item; lesson rows `--cbg-text-2` with `--cbg-text-3` locks. Behaviour untouched, so it must still open and close. |
| `#course-header-bg` (QS build-scrub hero, approved 4 Oct 2026) | course | With full motion, `src/motion/scrub.ts` appends one node of our own (`.cbg-scrub-x`) as the band's last child and sets `html.cbg-scrub-on`, which switches the band's `overflow` from `hidden` to `clip` so the stage can stick; teardown removes both. Never before React has hydrated the band (else `html.cbg-scrub-off` and the in-column hero shows). critical.css reserves the stage's height while it waits ★ |
| `#reviews` | course | Not restyled: empty on both live course URLs. If course.link renders reviews, they sit inside the main wrapper and take its dark variables. |

**Not restyled:** the login and register popups, lesson pages, and course.link's dashboard. They stay light (out of scope).

Every rule lives in `src/styles/native-overrides.css`. Adding a selector to this table needs Maasoom's OK.

---

## 7. Loader (`module: loader`)

The Custom Script for the **All Pages** slot, pasted once. It contains, in order:
1. A synchronous `document.documentElement.classList.add('cbg-js')`, and the `cbg-route-*` class from `location.pathname`.
2. `<meta name="robots" content="noindex,nofollow">` (approved).
3. Preconnect and font `<link>`s.
4. Inline ★ critical CSS for the native restyles.
5. An async script that fetches `https://mmmwolf45.github.io/cbg-lms-site/manifest.json?t=<10-minute bucket>`, then injects the hashed CSS and JS.

**Fails safe:**
- Everything is wrapped in try/catch, and nothing blocks rendering.
- If the fetch fails or takes longer than 4s, the loader removes `cbg-js`, so all content shows in its final state.

**Page detection** (`src/pages.ts`):
- `/` → home
- `/course/<uniqueId>-<slug>` → course
- `/course/preview-<uniqueId>` → course
- Anything else → no-op

**Route changes:** course.link is a React app that can change pages without reloading. The bundle wraps `history.pushState`/`replaceState`, listens for `popstate`, and watches `#react-root` with a `MutationObserver` (debounced). On every route change it kills the old GSAP context and sets up the new page. It only enhances inside `[data-cbg]` roots plus the section 6 selectors. It never moves or rewrites React-owned nodes.

**No scripts inside Custom Blocks.** All JavaScript is in the bundle.

---

## 8. Constraints and budgets

**Performance, per page, on top of course.link:**

| Measure | Budget |
|---|---|
| Our JS, gzipped (incl. GSAP core + ScrollTrigger, about 38 KB) | **60 KB or less**, so about 22 KB for our own code |
| Our CSS, gzipped | **25 KB or less** |
| Hero image | AVIF/WebP. 250 KB or less on laptop, 120 KB or less on phone. Preloaded. |
| All images on a page | 700 KB or less. Everything below the first screen lazy-loads. |
| Layout shift from our blocks | CLS under 0.05 |
| LCP | No more than 300 ms worse than the native page |
| Smoothness | No long tasks over 50 ms from our code. Canvas animations pause when off-screen or in a background tab. |

**Accessibility:**
- WCAG 2.2 AA contrast on the dark theme, including gold on navy-black.
- Everything works by keyboard, with a visible gold focus ring.
- Hazard markers, tour buttons and FAQ items are real buttons or `<summary>` elements.
- Hazard labels are also in a plain list for screen readers.
- Decorative canvas and SVG are `aria-hidden`.
- Counters announce only their final value.

**Brand and legal:**
- IOSH 1003 mark only as supplied.
- No invented stats. Testimonials: none, except on the QS page (decided 4 Oct 2026): learner reviews quoted word for word, only those that don't name Entri, plus placement stories (names, roles, employers as text, no logos). The QS hero's take-off quantities are an illustration, labelled "Example take-off" (approved by Maasoom 4 Oct 2026).
- No em-dashes in any output.
- Every AI image is recorded in `brand/assets/CREDITS.md` as "Generated with ChatGPT for CBG".

**Screen widths tested:** 390, 768, 1024, 1440. course.link's two-column course layout starts at 1024px (its `lg` breakpoint).

---

## 9. Code style

Short and plain (ponytail). Everything is prefixed `cbg-`, and every id is prefixed `cbg-`. No styles on bare tags outside `[data-cbg]`. Copy never appears in templates; it always comes from content.

```ts
// templates/sections/support.ts
import { esc, section } from '../../src/components/html';
import type { Home } from '../../content/schema';

export const support = ({ support: s }: Home) => section('support', `
  <div class="cbg-glass">
    <h2 class="cbg-h2">${esc(s.heading)}</h2>
    <p class="cbg-body">${esc(s.body)}</p>
    <a class="cbg-btn cbg-btn--gold" href="${esc(s.whatsapp.href)}">${esc(s.whatsapp.label)}</a>
  </div>`);
```

```ts
// src/motion/reveal.ts
import { gsap } from 'gsap';
import { dur, ease } from './tokens';

export function reveal(root: HTMLElement) {
  return gsap.context(() => {
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.utils.toArray<HTMLElement>('[data-cbg-reveal]', root).forEach((el) =>
        gsap.from(el, { y: 16, autoAlpha: 0, duration: dur.base, ease: ease.out,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true } }));
    });
  }, root); // caller keeps the context and calls .revert() on route change
}
```

---

## 10. Testing strategy

- **Unit tests (Vitest, `tests/`):**
  - The content schema accepts both YAML files and rejects a missing section.
  - Every section id renders.
  - No em-dash in any rendered block.
  - All content is HTML-escaped.
  - Page detection works for every path pattern in section 7.
- **Browser tests (Playwright, `e2e/`)** against `preview/*.html` at 1440, 1024, 768 and 390, each checking:
  - every section is visible
  - no console errors
  - axe finds no serious or critical violations
  - CLS under 0.05
  - screenshots are saved for Maasoom
- **Fail-safe run:** the same pages with the JS bundle blocked show all content in its final state.
- **Reduced-motion run:** no pinning, all content visible, counters show final values.
- **Course-specific checks:** the Course Content accordion still opens and closes after restyle, Start here opens the first item, and the pin never overlaps the enrol card.
- **Live run (read-only)** on `/course/preview-101` and `/`. It also checks the unverified platform items: client-side navigation re-runs our setup, and block size limits hold.
- **Lighthouse accessibility 95 or higher**, run at each checkpoint (manually, not in every test run).
- **Size gate:** `npm run build` fails when over budget.

---

## 11. Boundaries

**Always:**
- Use the `cbg-` prefix and scope everything under `[data-cbg]`.
- Take copy from `content/`.
- Honour reduced motion.
- Run `npm test` and `npm run build` before every commit.
- Check each section in the preview at 390px and 1440px before moving to the next.

**Ask Maasoom first:**
- Any wording change or new copy (including hazard labels).
- New dependencies.
- Changing a budget.
- Adding a native selector.
- Creating the GitHub repo and turning on Pages.
- Anything that would need re-pasting a block.

**Never:**
- Log in to, paste into, save or publish anything in course.link. Maasoom does that, or Claude in Cowork when he asks.
- Put scripts in Custom Blocks.
- Select by Radix ids.
- Add global or bare-tag styles.
- Commit secrets.
- Alter the IOSH mark.
- Invent copy, facts or stats.
- Use em-dashes.

---

## 12. Success criteria

**Phase 1: Design system** (before any page build)
- [ ] 2 or 3 visual directions shown as rendered samples; Maasoom picks one.
- [ ] Final tokens (navy-black scale, gold, text strengths, type scale, spacing) in `src/styles/tokens.css`, all text pairs passing AA.
- [ ] `docs/art-direction.md` with the photo-series brief and ready-to-paste ChatGPT prompts for: home hero structure (laptop + phone crop), Hazard Scan worksite, and any section images. Maasoom generates them and drops them into `brand/assets/photos/`.

**Phase A: Foundation and home**
- [ ] The repo is on GitHub, Pages serves `dist/`, and `manifest.json` resolves.
- [ ] The loader works locally and fails safe with the JS URL blocked.
- [ ] The home block renders every section of `home.yaml`, and course cards come from data.
- [ ] Blueprint to built runs; reduced motion shows the final composed image.
- [ ] Native navbar and page background restyled; banner and catalogue switched off by Maasoom.
- [ ] At 1440, 1024, 768 and 390: Lighthouse accessibility 95 or higher, no console errors, reduced motion respected, CLS under 0.05, budgets met.
- [ ] **Checkpoint:** Maasoom reviews screenshots and a screen recording before deploy.

**Phase B: IOSH course page**
- [ ] Every section in `iosh-level-3.yaml` is built across the two blocks.
- [ ] Hazard Scan works by mouse, keyboard and touch tour; trainer-approved labels.
- [ ] The 80-hour build pins on laptop without touching the enrol card, and builds without pinning on phone.
- [ ] Native header, enrol card (including the phone bottom bar) and Course Content restyled; the accordion still works; Start here opens the first item.
- [ ] Same checks as Phase A, plus a pass on the live draft `/course/preview-101`.
- [ ] **Checkpoint:** Maasoom reviews.

**Phase C: Template**
- [ ] IOSH renders from `template + iosh-level-3.yaml` with no IOSH-specific code left in templates.
- [ ] A dummy second course renders correctly from content alone.
- [ ] `HOW_TO_ADD_A_COURSE.md` is written.

---

## 13. Decisions (resolved 2 Oct 2026)

1. **Two blocks on the course page:** approved. Hero above Course Content, everything else below it.
2. **Hazard labels:** a CBG trainer signs them off. Claude drafts 4 to 6 labels once the photo exists; Maasoom routes them to a trainer (name to confirm then).
3. **Test student account:** Maasoom will set one up. Until then, the hero CTA always says "Log in", and the enrol card is styled from what is visible.
4. **YAML content:** approved. `content/*.md` is converted to YAML and the `.md` files move to `docs/copy-deck/` as reference only.
5. **GitHub:** approved. A public repo `cbg-lms-site` under `mmmwolf45`, with Pages turned on when Phase A starts.
