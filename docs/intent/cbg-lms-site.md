# CBG LMS site: confirmed direction

**Confirmed by Maasoom on 2 Oct 2026** (Phase 0, idea-refine + interview-me). This is the agreed intent that `SPEC.md` is written from. Change it only with Maasoom's OK.

## Problem statement
How might we make a paid student's first minute on course.link feel like walking into a premium, well-run CBG classroom, so they know where they are, what to do next and that they're in good hands, without fighting the platform underneath?

## Statement of intent
- **Outcome:** A dark, premium, motion-rich student site on course.link (home, then IOSH course page, then a reusable course template) that makes students feel CBG is a refined, technically strong, high-end team.
- **User:** Enrolled students, many on phones, many reading English as a second language, usually arriving from a WhatsApp link after paying.
- **Why now:** IOSH Level 3 is live, and course.link's default look undersells CBG.
- **Success:** A student lands, feels "I chose a serious institute", logs in and finds their course in seconds. It looks right on phone and laptop and stays within the performance budget.
- **Out of scope:** lesson pages (they stay light), login and dashboard work, video backgrounds, real 3D (WebGL), testimonials, reviews, invented stats, marketing and SEO, official IOSH certificate artwork or partner logos.

## Look and feel
**Reference: [The Generalist](https://thegeneralist.club/)**, studied on 1 Oct 2026. What makes it premium, and how we translate it:

| The Generalist | CBG translation |
|---|---|
| Near-black canvas (#050505) | Deep navy-black, derived from brand navy #203769 |
| White text at three strengths (100%, ~78%, ~55%) | Same idea: white for headlines, softer for body text, softest for labels |
| One vivid accent (lilac #B97EFF), used rarely | CBG gold #C9A24B, used rarely: one word in a headline, rules, dots, the gold thread |
| Two-tone headlines (first line white, second line dimmed) | Keep |
| IBM Plex Sans headlines + IBM Plex Mono body | **Plus Jakarta Sans** headlines + **Source Sans 3** body, labels and fact rows. **No monospace.** |
| One consistent photo series (dramatically lit marble statues) | One consistent **art-directed AI photo series** (ChatGPT). Claude writes the prompts; Maasoom generates the images. |
| Pill chips, dot-separated fact rows, glass stat card, hairline FAQ, reveal-on-scroll | Keep these patterns |

**Second reference: [motionsites.ai](https://motionsites.ai/)** (a gallery of AI website prompts). Its impact comes mostly from looping cinematic video backgrounds. We take the ambition for richer motion, **not** the video technique.

**Dark everywhere we control:** home page and course page, including restyling course.link's native header, enrol card and Course Content accordion. Lesson pages stay light (a working space).

## Signature moments
**Home `[hero]`: "From blueprint to built."** Gold blueprint lines draw a structure on load. The real photo of the same structure fades in underneath, aligned. Gentle mouse parallax between the line layer and the photo layer. Built as 2D canvas or SVG that looks 3D (no three.js, to stay within 60 KB of JS). One hero photo (~200 KB) plus a mobile crop. Lines are traced over the final photo.

**Course page:**

| Moment | Section | Weight | Phone behaviour |
|---|---|---|---|
| **Hazard Scan:** a gold scan line sweeps a worksite photo and tags hazards | `[hero]` | Loudest | Guided tour: one hazard at a time, label in a caption bar, Next button |
| **What you leave with:** five certificate cards stack like a hand of cards | `[included]` | Medium | Stacked or swipeable |
| **The 80-hour build:** 4 units as 4 floors, hours counter climbs to 80 | `[units]` | Medium | Floors build as they scroll in, no pinning |
| **Gold thread:** one gold line runs down the page, linking sections | Whole page (home too) | Quiet | Thin line at the left edge |

Every other section uses calm reveals only.

## Layout
- **Phone first.** Design at 390px, then enhance for laptop.
- **Everything stays inside the 792px course column.** No full-width breakouts; nothing pinned or overlapping the sticky enrol card. On phones the enrol card is a bottom bar, so leave room for it.
- **Home page** replaces course.link's native banner and catalogue. Copy and section order exactly as in `content/home.md`.

## Key assumptions to check
- [ ] ChatGPT can produce a worksite photo where the hazards are readable at phone size. If not, fall back to a line-art scene.
- [ ] Hazard labels are correct by OSH standards. A CBG trainer signs them off.
- [ ] Canvas animations stay smooth on mid-range Android phones. If not, phones get a simpler version.
- [ ] The loader re-runs on course.link's client-side navigation (unverified in `PLATFORM_NOTES.md`).

## Not doing (and why)
- **Video backgrounds:** heavy on mobile data, and they would look like everyone else's sites.
- **Real 3D (three.js / WebGL):** ~150 KB alone, which breaks the 60 KB JS budget.
- **Monospace font:** Maasoom's call; also harder to read for students reading English as a second language.
- **Full-width breakouts on the course page:** they risk colliding with the enrol card, and phones matter most.
- **Pinning on phones:** address-bar resizing makes it stutter.
- **Official IOSH certificate design, IBM/HP/partner logos:** trademarks; we use our own stylised cards with names only.
- **"Your next live class" panel:** no real data source for class times yet.
- **Testimonials, reviews, invented stats:** brief rules; `collectReviews` stays false.

## Defaults agreed
- The whole site is `noindex`.
- Reviews stay off.
- Hazard labels get a trainer's sign-off.
- Maasoom sets up a test student account before any logged-in styling.
- Maasoom fixes the `courses.cbgtraininginstitute.com` DNS before launch.
