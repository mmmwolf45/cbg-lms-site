# Implementation plan: CBG LMS site

**Built from:** `SPEC.md` (approved 2 Oct 2026). **Status:** Draft for Maasoom's approval.
**Convention:** The brief asks for one `PLAN.md`, so the plan and the task list both live here (not in `tasks/`). Tick tasks off here as they land.

## Progress
- [x] T1 scaffold · [x] T2 content YAML · [x] T3 routing · [x] T4 loader + mock · [x] T5 Pages · [x] T6 live probe (`docs/platform-findings.md`) · [x] T8 art direction (`docs/art-direction.md`)
- [x] Foundation checkpoint: loader pasted into All Pages and verified live (2 Oct) · [x] T7 directions (B + A touches, navy-black canvas) · [x] T9 tokens + gallery · [x] T10 images
- [x] T11-T12 home block · [x] T13 native home · [x] T14 motion · [x] T15 hero · [x] T16 interactions · [x] T17 e2e · [x] T18-T19 course blocks · [x] T20 native course
- [x] T21 Start here + FAQ · [x] T22 Hazard Scan · [x] T23 hand · [x] T24 80-hour build · [x] T25 small motions · [x] T26 course suite (in quality/e2e specs, live checks)
- [x] Pre-launch code review + over-engineering review, all must/should-fix items done
- [x] Go-live 3 Oct (loader, home, IOSH course) · [x] Home redesign live 3 Oct (all courses, gallery, photos) · [x] Phone fixes live 3 Oct (no flashing, no waiting for another scroll) · [x] Exploding-building hero live 3 Oct · [ ] Logged-in check (test student account) · [x] T27-T28 template + HOW_TO_ADD_A_COURSE.md
- Hazard labels drafted for trainer sign-off: `docs/hazard-labels.md`

## Overview
The work runs in this order:
1. Foundation (repo, content, loader, hosting)
2. Design system (Maasoom picks a visual direction and generates the photos)
3. Home page
4. IOSH course page
5. Course template

High-risk unknowns are tested first: client-side navigation on course.link, React keeping our classes, block size and the JS budget.

Each section is built static first (real HTML that reads correctly with JS off), then motion is layered on. Every task ends in a working, buildable state.

## Architecture decisions (from the spec)
- **No framework at runtime.** TypeScript template functions render static block HTML at build. One small bundle (GSAP core + ScrollTrigger + our code) enhances it.
- **Plain CSS, `cbg-` prefix, scoped under `[data-cbg]`.** Native restyles only via the selector table in SPEC section 6.
- **YAML content with a schema.** The build fails on a missing field or an em-dash.
- **Loader on the All Pages slot**, pasted once. Design and motion changes then ship with `git push`; only wording changes need a block re-paste.
- **Course page uses two blocks:** "top" (hero) above Course Content, "main" (everything else) below it.
- **Budget gate in the build** from day one, so we never discover a budget overrun late.

## Dependency graph
```
T1 scaffold
 ├─ T2 content YAML + schema
 ├─ T3 page detection + route changes
 │    └─ T4 preview mocks + loader + manifest ── T5 GitHub Pages ── T6 live probe
 │                                                                      │
 ├─ T7 directions sample ── (Maasoom picks) ── T9 final tokens          │
 ├─ T8 art direction + prompts ── (Maasoom generates) ── T10 images      │
 │                                                                      ▼
 └──────────────── T11–T17 home ─── Checkpoint A ─── T18–T26 course ─── Checkpoint B ─── T27–T28 template
```

**Waiting on Maasoom** (each one blocks the task shown):

| Waiting on | Blocks |
|---|---|
| Visual direction pick | T9 |
| Hero and worksite photos | T15, T22 |
| Trainer sign-off on hazard labels | T22 go-live |
| Pasting the loader and blocks, publishing | deploys |
| Test student account | logged-in CTA and enrolled enrol-card styling (after Phase B) |

---

## Phase 0: Foundation

### T1. Scaffold the repo · S
Set up git, `package.json` with the SPEC section 3 scripts, Vite + strict TypeScript, Vitest, `.gitignore` (`node_modules`, `dist`, `test-results`) and the SPEC section 4 folder skeleton. Install the approved dependencies.
- **Acceptance:** `npm install`, `npm test` (one smoke test) and `npm run build` (empty bundle) all succeed. First commit made.
- **Verify:** run the three commands.
- **Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `tests/smoke.test.ts`
- **Depends on:** none

### T2. Convert content to YAML with a schema · M
Transcribe `content/home.md` and `content/courses/iosh-level-3.md` into YAML **word for word**. Write `content/schema.ts` (types + validation: required fields, no em-dashes, known section ids) and `npm run content:check`. Move the `.md` files to `docs/copy-deck/`.
- **Acceptance:** both YAML files pass. A test proves a missing section or an em-dash fails. A script diff confirms every sentence in the `.md` files appears in the YAML.
- **Verify:** `npm run content:check`, `npm test`
- **Files:** `content/home.yaml`, `content/courses/iosh-level-3.yaml`, `content/schema.ts`, `scripts/content-check.ts`, `tests/content.test.ts`
- **Depends on:** T1

### T3. Page detection and route-change handling · S
`src/pages.ts` maps paths to pages: `/` → home; `/course/<id>-<slug>` and `/course/preview-<id>` → course via the `{ "101": "iosh-level-3" }` map; anything else → none. `src/router.ts` wraps `pushState`/`replaceState`, listens for `popstate` and runs a debounced `MutationObserver` on `#react-root`, calling teardown → setup.
- **Acceptance:** unit tests cover every path pattern in SPEC section 7. Setup runs once per route change and teardown always runs first.
- **Verify:** `npm test`
- **Files:** `src/pages.ts`, `src/router.ts`, `src/main.ts`, `tests/pages.test.ts`, `tests/router.test.ts`
- **Depends on:** T1

### T4. Preview mocks, loader and manifest · M
Save read-only HTML snapshots of the live `/` and `/course/preview-101` as fixtures. Build `preview/home.html` and `preview/course.html` from them, so the mock has course.link's real structure (792px column + 360px sticky enrol card + phone bottom bar). Write `scripts/build-loader.ts`, which outputs `dist/loader-snippet.html` (cbg-js class, route class, noindex, font links, critical-CSS slot, manifest fetch with a 10-minute cache bucket, 4s timeout, try/catch) and `dist/manifest.json`.
- **Acceptance:** in the mock, the loader injects the hashed CSS/JS. With the bundle URL blocked, `cbg-js` is removed and the page still shows everything. The snippet is under 2 KB.
- **Verify:** `npm run build`, `npm run dev` with a manual check, then a manual check with the JS request blocked in DevTools.
- **Files:** `preview/home.html`, `preview/course.html`, `preview/fixtures/*`, `scripts/build-loader.ts`, `src/loader/snippet.ts`
- **Depends on:** T3

### T5. GitHub repo and Pages · S
Create the public repo `mmmwolf45/cbg-lms-site` and push. Add a GitHub Actions workflow that runs the tests, builds and publishes `dist/` to Pages. Set the Vite `base` to `/cbg-lms-site/`.
- **Acceptance:** `https://mmmwolf45.github.io/cbg-lms-site/manifest.json` returns the current hashes. A failing test blocks the deploy.
- **Verify:** fetch the manifest URL; push a deliberately failing test on a branch to check it blocks.
- **Files:** `.github/workflows/pages.yml`, `vite.config.ts`
- **Depends on:** T4

### T6. Live platform probe (read-only) · S
Use Playwright on the live site, without logging in or changing anything:
- Does clicking from home to a course do a full reload or a client-side route change?
- Does React's hydration strip classes we add to `<html>`?

Record the findings in `docs/platform-findings.md`, and adjust T3/T4 if needed.
- **Acceptance:** both questions answered with evidence (screenshots or logs). `PLATFORM_NOTES` "unverified" items updated where answered.
- **Verify:** findings doc reviewed.
- **Files:** `e2e/probe.spec.ts`, `docs/platform-findings.md`
- **Depends on:** T4

### Checkpoint: Foundation
- [ ] `npm test` and `npm run build` are clean; Pages serves the manifest.
- [ ] Fail-safe shown in the mock.
- [ ] **Maasoom's call:** paste the loader into All Pages now, with a harmless bundle that only adds the classes and `noindex`. This proves the loader and client-side navigation on the real site early. Optionally, also paste a large test Custom Block into the IOSH **draft** (not published) to find the block size limit.

---

## Phase 1: Design system

### T7. Visual directions sample · M
Build `preview/directions.html`: 2 or 3 rendered directions (navy-black scale, gold usage, type pairing, chips, cards, buttons, a two-tone headline, a hero mock), each a real page section at 390px and 1440px. Uses the ui-ux-pro-max and design-taste-frontend skills.
- **Acceptance:** each direction passes AA contrast for every text pair it uses; screenshots sent to Maasoom.
- **Verify:** Playwright screenshots at 390 and 1440; contrast unit test.
- **Files:** `preview/directions.html`, `src/styles/directions/*.css`, `tests/contrast.test.ts`
- **Depends on:** T1

### T8. Art direction and ChatGPT prompts · S
Write `docs/art-direction.md`: the photo series look (light, grade, lens, palette tie-in, what to avoid) plus ready-to-paste prompts for:
- the home hero structure (laptop + phone crop, same composition)
- the Hazard Scan worksite (hazards clearly visible at phone size)
- any section images the chosen direction needs

Include the exact sizes and where to save the files (`brand/assets/photos/`).
- **Acceptance:** Maasoom can generate every image from the doc alone.
- **Verify:** Maasoom reviews the doc.
- **Files:** `docs/art-direction.md`
- **Depends on:** none (can run alongside T7)

### T9. Final tokens and components · M
Lock the chosen direction into `src/styles/tokens.css` and `src/motion/tokens.ts`. Build the shared components: section header (with node for the thread), chip, button, card, glass card, fact row, plus the `[data-cbg]` base styles.
- **Acceptance:** the components render in a `preview/components.html` gallery; the contrast test covers every token pair; CSS so far is at most 8 KB gzipped.
- **Verify:** `npm test`, `npm run check:size`, check the gallery at 390 and 1440.
- **Files:** `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/components.css`, `src/motion/tokens.ts`, `preview/components.html`
- **Depends on:** T7 + Maasoom's pick

### T10. Image pipeline · S
`scripts/images.ts` (sharp) turns `brand/assets/photos/*` and trainer photos into AVIF/WebP/JPEG at the needed widths, written to `public/img/` with a manifest at `src/images.json`. (Trainer duotone is done in CSS instead, so the hover can fade back to colour without a second image.). Credits rows go into `CREDITS.md`.
- **Acceptance:** hero images are within budget (250 KB laptop / 120 KB phone); trainer duotones look right at 112px.
- **Verify:** `npm run images`, check the file sizes, view them in the gallery.
- **Files:** `scripts/images.ts`, `brand/assets/CREDITS.md`
- **Depends on:** T1 (trainers now); photos when Maasoom delivers them

### Checkpoint: Design
- [ ] Maasoom has picked a direction and approved the component gallery.
- [ ] Photos are generated and processed.

---

## Phase A: Home page

### T11. Block build pipeline + home hero and how-it-works (static) · M
Add `src/components/html.ts` (`esc`, `section`), `templates/home.ts` and `scripts/build-blocks.ts`, which outputs `dist/blocks/home.html`. Render `hero` (copy, CTAs, static composed visual) and `how-it-works`.
- **Acceptance:** the block reads correctly with JS off. Unit tests show each section renders and contains no em-dash.
- **Verify:** `npm test`, `npm run build`, view `preview/home.html` at 390 and 1440.
- **Files:** `src/components/html.ts`, `templates/home.ts`, `templates/sections/home-*.ts`, `scripts/build-blocks.ts`, `tests/templates.test.ts`
- **Depends on:** T2, T9

### T12. Home: remaining sections (static) · M
Render `courses` (cards from `content/courses/*.yaml`), `first-steps`, `support`, `about` and `footer-note`.
- **Acceptance:** every `home.yaml` section renders. Adding a second course YAML adds a second card with no template change (tested).
- **Verify:** `npm test`, preview at 390, 768, 1024 and 1440.
- **Files:** `templates/sections/home-*.ts`, `src/styles/home.css`, `tests/templates.test.ts`
- **Depends on:** T11

### T13. Native restyle for home · S
Restyle `body` and `#navbar` (ghost Login/Register) on `cbg-route-home`. Move the ★ rules into the loader's critical CSS.
- **Acceptance:** no layout shift while the main CSS loads (CLS under 0.05 in the mock); other routes are untouched.
- **Verify:** Playwright CLS check; visual check on a non-home mock path.
- **Files:** `src/styles/native-overrides.css`, `scripts/build-loader.ts`
- **Depends on:** T4, T9

### T14. Motion foundation · M
Add `reveal`, `thread` (gold thread with lit nodes), `counters` and the setup/teardown wiring per page with `gsap.context()` + `matchMedia`. Pre-animation states apply only under `.cbg-js`. Add the `check:size` gate.
- **Acceptance:** reveals and the thread run on home. Reduced motion shows the final state. A route change in the mock tears down cleanly (no duplicate triggers). JS is within budget.
- **Verify:** `npm test`, `npm run check:size`, manual reduced-motion toggle.
- **Files:** `src/motion/reveal.ts`, `src/motion/thread.ts`, `src/motion/counters.ts`, `src/main.ts`, `scripts/check-size.ts`
- **Depends on:** T3, T11

### T15. "Blueprint to built" hero · M (high risk)
Trace the structure's key edges over the final hero photo into compact path data. `blueprint.ts` draws the lines (canvas or SVG, whichever profiles better on a mid-range phone), crossfades the photo in, then adds mouse parallax on laptop only. Animation pauses when off-screen.
- **Acceptance:** lines line up with the photo at 390 and 1440. No long tasks over 50 ms. Reduced motion shows the composed final image. JS is still within budget.
- **Verify:** Playwright performance trace with 4x CPU throttle; screenshots; `npm run check:size`.
- **Files:** `src/motion/blueprint.ts`, `src/motion/blueprint-paths.ts`, `templates/sections/home-hero.ts`, `src/styles/home.css`
- **Depends on:** T10 (hero photo), T14

### T16. Home interactions · S
Hero "Log in" clicks the native navbar Login button (without JS it links to `#navbar`). The `first-steps` ticks draw in. Card hover and focus states.
- **Acceptance:** Log in opens course.link's own popup in the mock and on live. Works by keyboard.
- **Verify:** Playwright click test; keyboard tab-through.
- **Files:** `src/home.ts`, `src/motion/ticks.ts`
- **Depends on:** T14

### T17. Home end-to-end suite · M
`e2e/home.spec.ts` checks at 1440, 1024, 768 and 390: every section is visible, there are no console errors, axe finds no serious or critical issues, CLS is under 0.05, plus the JS-blocked run and the reduced-motion run. Screenshots go to `test-results/screens/`.
- **Acceptance:** suite is green; Lighthouse accessibility is 95 or higher (run manually).
- **Verify:** `npm run test:e2e`
- **Files:** `e2e/home.spec.ts`, `playwright.config.ts`
- **Depends on:** T12–T16

### Checkpoint A: Home
- [ ] All tests are green and budgets are met.
- [ ] Code review: code-review-and-quality, then ponytail-review.
- [ ] Shipping-and-launch checklist done.
- [ ] **Maasoom reviews the screenshots and a screen recording.**
- [ ] **Maasoom deploys:** pastes `home.html`, switches off the native Banner and Courses, and Saves (runbook section 3). Then we run a live check.

---

## Phase B: IOSH course page

### T18. Course template: top block + included, units, how-classes-run, assessment (static) · M
`templates/course.ts` outputs `dist/blocks/iosh-level-3-top.html` (hero with a static Hazard Scan image, key facts, Start here) and `iosh-level-3-main.html` with these four sections. All of it is driven from the YAML.
- **Acceptance:** every section renders from the YAML and reads correctly with JS off. The hazard list renders as a plain list.
- **Verify:** `npm test`, `preview/course.html` at 390, 1024 and 1440.
- **Files:** `templates/course.ts`, `templates/sections/course-*.ts`, `src/styles/course.css`, `tests/templates.test.ts`
- **Depends on:** T2, T9

### T19. Course: trainers, bonus, field-guides, payments, faq, help (static) · M
The FAQ uses native `<details>` and the field-guide shelf uses scroll snap.
- **Acceptance:** every `iosh-level-3.yaml` section renders. The FAQ works without JS. The shelf is keyboard-scrollable.
- **Verify:** `npm test`, preview at four widths.
- **Files:** `templates/sections/course-*.ts`, `src/styles/course.css`
- **Depends on:** T18, T10 (trainer photos)

### T20. Native course restyle · M (high risk: brittle selectors)
Restyle `#course-header-bg`, `#course-header`, the main wrapper, the enrol card (including the phone bottom bar) and the `#course_content` accordion, following SPEC section 6. Each rule degrades to stock if its selector doesn't match.
- **Acceptance:** the accordion still opens and closes; the enrol card stays sticky; there's no CLS from the ★ rules; matches the live draft structure.
- **Verify:** Playwright on the mock, and read-only on `/course/preview-101` (styles injected only in the test browser).
- **Files:** `src/styles/native-overrides.css`, `scripts/build-loader.ts`, `e2e/course-native.spec.ts`
- **Depends on:** T13, T18

### T21. Start here + FAQ animation · S
Start here scrolls to `#course_content` and opens the first item (by position or "Start Here" text). The FAQ gets a height animation.
- **Acceptance:** works in the mock and the live draft (in the test browser only). No Radix ids used.
- **Verify:** Playwright click tests.
- **Files:** `src/course.ts`, `src/motion/faq.ts`
- **Depends on:** T20

### T22. Hazard Scan · M (high risk)
Map hotspots onto the worksite photo and draft 4 to 6 labels (**they go to Maasoom for trainer sign-off**). Laptop: sweep, then markers you can hover, focus or click. Phone: guided tour with Previous/Next and 44px targets. Reduced motion: no sweep, all markers shown.
- **Acceptance:** works by mouse, keyboard and touch; labels are in the YAML; screen readers get the plain list; no long tasks over 50 ms.
- **Verify:** Playwright at 390 and 1440 (including a touch-emulated tour), axe, performance trace.
- **Files:** `src/motion/hazard-scan.ts`, `templates/sections/course-hero.ts`, `content/courses/iosh-level-3.yaml`, `src/styles/course.css`
- **Depends on:** T10 (worksite photo), T14, T18

### T23. What you leave with · S
Fan of 5 cards that deal into the grid on laptop; slide-in stack on phone.
- **Acceptance:** no overlap or CLS; reduced motion shows the final grid.
- **Verify:** screenshots at 390, 1024 and 1440.
- **Files:** `src/motion/hand.ts`, `src/styles/course.css`
- **Depends on:** T14, T18

### T24. The 80-hour build · M (high risk: pin beside the sticky enrol card)
Laptop (1024px and up): the section pins inside the 792px column; 4 floors build, GLH counts 0 → 21 → 48 → 60 → 80 and the panel swaps. Below 1024px: per-card floor builds with running totals, no pin.
- **Acceptance:** the pin never overlaps or shifts the enrol card; scrolling back up reverses cleanly; route change kills the pin; reduced motion means no pin.
- **Verify:** Playwright scroll test asserting the enrol card's bounding box stays put; screenshots.
- **Files:** `src/motion/build80.ts`, `templates/sections/course-units.ts`, `src/styles/course.css`
- **Depends on:** T14, T18, T20

### T25. Small course motions · S
Assessment cards slide in, the 4 quadrants count to 25, the bonus path draws the thread, the field-guide shelf fans open and the trainer duotone lifts on hover.
- **Acceptance:** all respect reduced motion; JS budget still met.
- **Verify:** `npm run check:size`, screenshots.
- **Files:** `src/course.ts`, `src/motion/*.ts`
- **Depends on:** T14, T19

### T26. Course end-to-end suite + live draft pass · M
`e2e/course.spec.ts` covers the same matrix as T17 plus the accordion, Start here, pin and enrol-card checks. Then a read-only run on `/course/preview-101` once Maasoom has pasted both blocks into the **draft**.
- **Acceptance:** suite is green; Lighthouse accessibility is 95 or higher; the live draft matches the mock.
- **Verify:** `npm run test:e2e`, `npm run test:e2e -- --project=live`
- **Files:** `e2e/course.spec.ts`
- **Depends on:** T19–T25

### Checkpoint B: Course page
- [ ] Hazard labels signed off by a trainer.
- [ ] Code review + ponytail-review + shipping-and-launch checklist.
- [ ] **Maasoom reviews**, then publishes (runbook section 4).

---

## Phase C: Course template

### T27. Generalise the template · M
Add `hero.visual: hazard-scan | photo | none`; every section is optional; the pages map comes from YAML. Add `content/courses/_dummy.yaml` (not deployed).
- **Acceptance:** IOSH output is byte-identical before and after the change (snapshot); the dummy course renders correctly with a different set of sections.
- **Verify:** `npm test` (snapshot + dummy render), preview the dummy at 390 and 1440.
- **Files:** `templates/course.ts`, `content/schema.ts`, `content/courses/_dummy.yaml`, `src/pages.ts`, `tests/templates.test.ts`
- **Depends on:** Checkpoint B

### T28. HOW_TO_ADD_A_COURSE.md · XS
Cover: create the YAML, add the id to the pages map, build, paste the two blocks, switch off the native sections, publish.
- **Acceptance:** following it for the dummy course works end to end locally.
- **Verify:** Maasoom reads it.
- **Files:** `HOW_TO_ADD_A_COURSE.md`
- **Depends on:** T27

### Checkpoint C: Done
- [ ] Every SPEC section 12 criterion is ticked.

---

## Phase D: Exploding-building hero (3 Oct 2026)
Idea: docs/ideas/3d-exploded-hero.md (the line-art version was replaced by photoreal footage). Prototype approved: effect A, "classroom" sharp.
- [x] D1 Frames: `scripts/explode-frames.ts` (ffmpeg + sharp), 48 AVIF frames at 960 and 640 plus poster, budget gate, CREDITS. Verify: sizes within budget, frames decode in Chromium.
- [x] D2 Template: hero markup (pin, sticky stage, poster, canvas, chip, sr-only h1 plus split words, buttons); subhead dropped from the hero. Verify: content check, template tests.
- [x] D3 Styles: poster-scale headline, sticky stage, phone layout, reduced motion and no-JS states. Verify: screenshots 1440 and 390.
- [x] D4 Motion: `src/motion/explode.ts` (progressive frames, canvas blend, scroll, tilt, headline A), replaces blueprint.ts in the home chunk. Verify: unit tests for the pure maths; size budget.
- [x] D5 Tests and regressions: e2e hero spec rewritten; full mock suite; phone flash and state diagnostics; CLS; frame-time check.
- [x] D6 Ship: live 3 Oct 2026 (home block and loader saved; live check on laptop, Android, iPhone emulation).
- [x] D7 Cleanup: old hero images deleted, old critical-CSS rule removed (in the re-pasted loader). brand/assets/photos/hero-structure.png kept as a source photo.

## Phase E: Quantity Surveying course page (4 Oct 2026)
Maasoom set up the QS course on course.link (`/course/102-quantity-surveying`, native Overview, Learn and FAQ) and handed it over for motion and pictures. Decisions (4 Oct): IOSH model (custom top and main blocks, native Overview, Learn and FAQ switched off); full-width hero; hero idea 1 "drawing to building to cost" and idea 3 "rebar X-ray" later in the page; learner reviews only word for word and only those that don't name Entri; employer names as text, no logos. Content: Maasoom's Drive (QS landing copy and 8-module syllabus) over Entri; Entri only for reviews, placements and photos.
- [x] E0 Schema: `hero.scrub` (visual `build-scrub`), `xray`, `certificates`, `testimonials`, `placements`, `careers`; trainers' `photo` and `credentials` optional. Section stubs wired. Verify: tsc, unit tests.
- [x] E1 Content: `content/courses/quantity-surveying.yaml` full page, card live (links the home card), copy deck. Verify: content check.
- [x] E2 Photos: faculty, learners and certificate samples from Entri into the image pipeline. Verify: images build within budget.
- [x] E3 Sections: certificates, faculty (13, monogram fallback), testimonials, placement wall, careers. Verify: unit + e2e, 1280 and 390, reduced motion.
- [x] E4 Hero: full-width build scrub over the header band, example take-off, frames pipeline (placeholder until the Higgsfield clip). Verify: unit + e2e, teardown, live header DOM.
- [x] E5 Rebar X-ray (placeholder images until the Higgsfield pair). Verify: unit + e2e, keyboard, reduced motion.
- [ ] E6 Integration: full build, size budgets, preview screenshots 1440, 1024, 768, 390; code review.
- [ ] E7 Ship: push and wait for the manifest; Maasoom re-pastes the loader (critical.css changed), pastes QS top/main (check the 61 KB main block isn't cut off: Custom Block limit unverified), switches native Overview, Learn and FAQ off, publishes; re-pastes the home block.
- [x] E8 Real media: Higgsfield hero clip (Wan 3.0, first/last frame) and X-ray pair (GPT Image 2.5) generated 4 Oct; no placeholders shipped.

## Before every go-live
1. performance-optimization pass against SPEC section 8.
2. code-review-and-quality, then ponytail-review.
3. shipping-and-launch checklist.
4. Screenshots at 1440, 1024, 768 and 390, reviewed by Maasoom.
5. Maasoom pastes and publishes (DEPLOY_RUNBOOK).

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| course.link changes pages client-side and our setup doesn't re-run, or React strips our `<html>` classes | High | Tested in T6 before any page work. The router watches 3 signals; classes are re-applied on every route change. |
| The JS budget (60 KB, about 22 KB of our own) gets blown by the hero and Hazard Scan | High | Size gate in the build from T14. Path data kept compact. Per-page code split if needed. |
| The pinned build overlaps or jolts the sticky enrol card | Med | Pin only at 1024px and up, inside the column, with a bounding-box assertion in T24. Fallback: no pin, scroll-in builds like on phones. |
| ChatGPT photos don't show hazards clearly at phone size, or the hero won't trace cleanly | Med | Art-direction doc specifies composition and contrast. T22 fallback: a line-art worksite. |
| Structure-based selectors (enrol card) break when course.link updates | Med | Every native rule degrades to stock; Playwright live run flags it. |
| Custom Block size limit is lower than our blocks | Med | Keep heavy SVG and paths in the bundle, not the block. Optional size probe at the Foundation checkpoint. |
| Canvas animation stutters on mid-range Android | Med | Throttled performance traces; pause off-screen; simpler phone variant. |
| Draft course is semi-public (preview opened without login) | Low | `noindex` from the loader; no unfinished copy left in the draft. |

## Open questions
- None blocking. Maasoom's inputs are listed under "Waiting on Maasoom" above.
