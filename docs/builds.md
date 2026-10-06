# Home page builds

## Status (7 Oct 2026)
- **Live: Build B (lite)** = branch `main` (also tag `build-b-lite-v1`, commit c13052d), deployed 7 Oct 2026.
  `home-lite` is the same commit; new Build B work goes on `main` (or a short branch merged into `main`).
- **Build A (full)**: branch `home-night-sky` (tuned; v1 frozen as tag `build-a-full-v1`). Preview:
  https://claude.ai/artifact/Gy19boHCrFfXkjnRyCrTem. Its docs/builds.md has the full A/B/C history and the
  real-window scroll measurements.
- **Build C (the home page live 3-7 Oct)**: tag `build-c-live-2026-10-05`.

## Changing Build B (the live home page)
1. `git switch main && git pull`, then edit (copy: `content/home.yaml`; layout: `templates/sections/home-*.ts`;
   motion: `src/motion/*.ts`; styles: `src/styles/*.css`).
2. `npm run dev` builds and serves the course.link mock at http://localhost:4173/ (the "mock" preview).
3. `npm test`, `npm run build` (size gate), `npx playwright test --project=mock`.
4. Deploy: commit, `git push` (GitHub Pages is live in about 2 minutes, browsers pick it up within ~10).
   If `dist/blocks/home.html` changed, re-paste it into course.link (Website > Home page > Custom Block)
   right after the deploy and Maasoom clicks Save; if only CSS/JS changed, the push alone is enough. If
   `dist/loader-snippet.html` changed, re-paste the loader too (Settings > Integrations > Custom Script > All Pages).
   Full routine: docs/go-live.md.
5. Switching to Build A or back to C: see "Deploying a build" below.

## Deploying a build
- A: `git switch main && git merge home-night-sky` (resolve, test, push), then re-paste the home block (and the
  loader if it changed).
- C: `git switch main && git revert --no-edit build-c-live-2026-10-05..HEAD` (or reset to the tag and force-push,
  only with Maasoom's OK), push, re-paste the home block.

## Build B (lite)

Branch `home-lite` (from `home-night-sky` at d2e9cec), 6 Oct 2026, asked for by Maasoom: a lighter home page that keeps the night-sky look but none of the scroll-played films.

**In it:**
- The real-star night sky over the flow waves (src/motion/sky.ts, flow.ts).
- Hero: the exploding building. On phones (branch home-ribbon-dock, 6 Oct 2026) it fills the width at rest and explodes past the sides, and "classroom" spans the screen; these sizes are also in critical.css, so deploying them means re-pasting the loader.
- Course-names strip: the plain one that drifts only with scroll, as live at 56e2fa0 (CSS, motion.css).
- Band: the floating desk, as live at 56e2fa0 (tag `build-c-live-2026-10-05`): the desk photo with the plans, laptop and hard hat as cut-outs that lift and turn away from the cursor, a tap turns one slowly, and the gentle scroll parallax (src/motion/band-desk.ts, parallax.ts, templates/sections/home-band.ts).
- Courses: the card gallery for everyone (laptop pin and pan, phone swipe, tablet grid) with tilting cards (card-tilt.ts) and, right behind them, the light ribbon (ribbon.ts, ribbon.css; replaced the gold track and the pan's progress bar on branch home-ribbon-dock, 6 Oct 2026): a big bundle of strands in steel blue, starlight, a warm white core, gold and bronze, as tall as the cards, that twists as it runs and slides in with the pan or swipe.
- Support: the "Questions? Talk to us" card light (support.ts). With full motion the card then holds in the middle of the screen and shrinks into a "Talk to us" WhatsApp dock fixed at the bottom left for the rest of the page (dock.ts, dock.css; branch home-ribbon-dock, 6 Oct 2026); reduced motion: the dock just appears once the card has scrolled up past the middle.
- The invert cursor circle (cursor.ts) and the cobe globe in About (globe.ts).

**Not in it** (sources kept in `brand/assets/` as the record; code in git history before this build):
- The photoreal site orbit band (site-orbit.ts, its frames and poster).
- The course story with its six course films (course-story.ts, story.css, `public/course-films/`).
- The outlined, gold-filling course-names strip (src/motion/strip.ts and its night.css rules stay in the code, unused).

**Switching the strip back to the outlined one:** set `OUTLINED = true` in templates/sections/home-disciplines.ts and add `strip` (from `../motion/strip`) to the enhancers in src/page-enhancers/home.ts. The template test and e2e/night.spec.ts check whichever strip the page has.

**Weight** (gzip, `npm run build`): home JS 65.1 KB of the 68 KB budget (was 66.9 KB), CSS 13.6 KB (was 13.9 KB). Media no longer shipped: about 3.9 MB of band frames and 9.6 MB of course films.

**Checks:** `npm test`; `npm run build`; `PORT=4175 npx playwright test --project=mock` when it runs beside another copy on 4173; frame rate per section with `node lab/home-fps.mjs [w] [h] [cpu-throttle]` (PORT, NOSKY).

## Scroll smoothness on an Intel UHD laptop (6 Oct 2026)
Measured with `node lab/scroll-perf.mjs` in a real Chrome window (headful, i7-11800H with Intel UHD, Chrome on
D3D11, 2560x1600 at 165 Hz, 1440x900 viewport at 1.5x): wheel-scroll top to bottom after one warm-up pass, frame
interval p50 / p95 in ms over the whole page (6 ms = the panel's 165 Hz). Headless numbers are not comparable.

| Build | 1x CPU before | 1x after | 4x CPU before | 4x after |
|---|---|---|---|---|
| C (live) | 30 / 200 | 36 / 170 | 36 / 170 | 30 / 170 |
| B (lite) | 97 / 303 | 6 / 67 | 109 / 321 | 12 / 103 |
| A (full) | 91 / 285 | 6 / 79 | 97 / 309 | 6 / 85 |

What it showed: the GPU, not the CPU, is the limit, and on this machine any canvas frame drawn while the page
scrolls (the sky, a film) holds that scroll frame for 40-90 ms whatever the canvas's size, while transform and
opacity changes are cheap. The fixes: one opaque background canvas (waves + sky, Milky Way baked once), redraw caps,
and on a device whose scroll frames run slow (`html.cbg-slow`, set by src/motion/sky.ts) a background that holds
still during a scroll and a navbar without backdrop blur; the cursor and the Talk-to-us card light leave the page
while it scrolls. Still slow there, as on C: the hero while its film plays (p50 ~55 ms; C ~100), the course gallery's
pan (raster of new cards), and in A the band and course films. For an in-session A/B of a change use
`node lab/ab-perf.mjs` (the laptop's GPU clock drifts between runs).
