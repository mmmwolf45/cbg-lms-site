# Home page builds

## Build B (lite)

Branch `home-lite` (from `home-night-sky` at d2e9cec), 6 Oct 2026, asked for by Maasoom: a lighter home page that keeps the night-sky look but none of the scroll-played films.

**In it:**
- The real-star night sky over the flow waves (src/motion/sky.ts, flow.ts).
- Hero: the exploding building, unchanged.
- Course-names strip: the plain one that drifts only with scroll, as live at 56e2fa0 (CSS, motion.css).
- Band: the floating desk, as live at 56e2fa0 (tag `build-c-live-2026-10-05`): the desk photo with the plans, laptop and hard hat as cut-outs that lift and turn away from the cursor, a tap turns one slowly, and the gentle scroll parallax (src/motion/band-desk.ts, parallax.ts, templates/sections/home-band.ts).
- Courses: the card gallery for everyone (laptop pin and pan, phone swipe, tablet grid) with tilting cards (card-tilt.ts) and the gold track beneath (gold-track.ts).
- Support: the "Questions? Talk to us" card light (support.ts).
- The invert cursor circle (cursor.ts) and the cobe globe in About (globe.ts).

**Not in it** (sources kept in `brand/assets/` as the record; code in git history before this build):
- The photoreal site orbit band (site-orbit.ts, its frames and poster).
- The course story with its six course films (course-story.ts, story.css, `public/course-films/`).
- The outlined, gold-filling course-names strip (src/motion/strip.ts and its night.css rules stay in the code, unused).

**Switching the strip back to the outlined one:** set `OUTLINED = true` in templates/sections/home-disciplines.ts and add `strip` (from `../motion/strip`) to the enhancers in src/page-enhancers/home.ts. The template test and e2e/night.spec.ts check whichever strip the page has.

**Weight** (gzip, `npm run build`): home JS 65.1 KB of the 68 KB budget (was 66.9 KB), CSS 13.6 KB (was 13.9 KB). Media no longer shipped: about 3.9 MB of band frames and 9.6 MB of course films.

**Checks:** `npm test`; `npm run build`; `PORT=4175 npx playwright test --project=mock` when it runs beside another copy on 4173; frame rate per section with `node lab/home-fps.mjs [w] [h] [cpu-throttle]` (PORT, NOSKY).
