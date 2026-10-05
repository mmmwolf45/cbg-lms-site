# Spec: home page night sky (5 Oct 2026)

Extends SPEC.md section 5.1 (the home page). The idea is in docs/ideas/home-night-sky.md.
**Status:** the prototype stage was approved by Maasoom on 5 Oct 2026 (statement of intent confirmed). The port to `src/` waits for his pick.

**Decisions after the port:**
- 6 Oct 2026, Maasoom: the 3D course story (one three.js scene per course card) and three.js itself are dropped; the models looked too simple. `#cbg-courses` is the card carousel again (src/motion/gallery.ts) with the `carousel` fx's gold track in the plain theme (no blueprint grid, no 4-point stars): src/motion/gold-track.ts, src/styles/gold-track.css. The 3D scenes and models are recoverable from commit 5b9bd72 (possibly for the IOSH page later).
- 6 Oct 2026, Maasoom: the course story comes back with photoreal films instead of three.js scenes. `#cbg-courses` holds (sticky) and scrolls through one chapter per course card: the card on the left (below the film on phones), that course's film on the right, scrubbed by the chapter's scroll, cross-fading 0.6 s into the next (src/motion/course-story.ts, src/styles/story.css; SPEC.md 5.1.3). The card carousel with the gold track stays as the fallback: reduced motion, no JS, Save-Data, no canvas 2D, the section already on screen, or the first film failing to load. A course without a film yet shows its card photo, still. Course films are an approved image exception (2.0 MB / 0.75 MB per course, SPEC.md section 8).

## Objective
Restyle and animate the home page into a calm night sky with gold constellation lines. A first-time visitor should feel "premium, alive"; a daily student should never be slowed down. Same sections, same order, same copy. The exploding-building hero is unchanged.

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `lab` | Switcher over the real home page: state in the URL hash, loading fx modules, a build for local use and an Artifact | site build (`dist/`) |
| `sky` | Page background: `waves` (today's flow canvas, darker, with stars) or `pure` (near-black sky, constellations, rare shooting star) | lab |
| `strip` | `#cbg-disciplines`: star map (blueprint) or kinetic outlined type with a slow scramble (plain) | lab |
| `carousel` | `#cbg-courses`: gold constellation track, nodes, travelling pulse, border beam | lab |
| `band` | `#cbg-band`: `constellation` \| `gravity` \| `silk` \| `scrub` | lab |
| `cursor` | Desktop follower over chosen regions: blueprint lens (blueprint) or inverting circle (plain) | lab |
| `support` | `.cbg-plate` card: tilt, gold spotlight, glare, border beam | lab |
| `logo` | `#cbg-about` mark: `globe` (cobe) \| `coin` (CSS 3D) | lab |

Build order: lab, then all the others in parallel (independent files), then integration and review.

## Tech stack
- **Lab:** plain ES modules plus vendored GSAP 3.15 and cobe 2.0.1 (MIT). No build step.
- **Port:** TypeScript in `src/motion/`, bundled GSAP, CSS in `src/styles/`, following SPEC.md rules.

## Commands
```bash
npm run build                                # site build (dist/)
npx tsx lab/build-lab.ts [--out dir] [--artifact]
npx tsx lab/serve.ts lab/out 4310            # or preview "lab" in .claude/launch.json
npm test; npm run test:e2e; npm run check:size   # after the port
```

## Project structure
`lab/` (prototype: `lab.js`, `lab.css`, `fx/`, `vendor/`, `assets/`, `build-lab.ts`, `serve.ts`, `README.md`). `lab/out*/` and `lab/shots/` are git-ignored. After the pick, the chosen fx move to `src/motion/*.ts` and `src/styles/*.css`.

## Code style
As in the repo: short modules, one comment block saying what and why, `cbg-` prefixes in `src/`, `lab-<fx>-` prefixes in the lab. Example: `src/motion/flow.ts`.

## Motion and design rules
- **Every motion slow and extremely smooth** (Maasoom, 5 Oct 2026): long eases, heavy damping, capped speeds, no overshoot or bounce.
- Calm ambient motion may run on its own. Bigger moves follow scroll or the cursor.
- Phones get ambient motion and tap versions. There's no lens or tilt on phones.
- Reduced motion shows a still, finished state.
- Gold `#D6B160` stays the one accent.
- Fake 3D only.

## Testing strategy
- **Lab:** each fx is screenshotted at 1440 and 390, in every variant and under reduced motion, with no console errors (playwright-cli).
- **Port:** unit tests for the pure maths (vitest), e2e checks for presence, reduced motion and no errors, axe accessibility, the size gate, and a contrast measurement.

## Boundaries
- **Always:** keep the hero and section order, keep text crisp and clickable, pause loops off screen, respect reduced motion.
- **Ask first:** spending Higgsfield credits beyond the approved 30, any budget change (SPEC.md section 8), new dependencies beyond cobe, pushing to `main` (that's the live site).
- **Never:** push or deploy without Maasoom, add React or three.js, change copy.

## Success criteria
- [ ] The lab shows every variant at 1440 and 390, with no console errors and still states under reduced motion.
- [ ] Maasoom picks a combination.
- [ ] After the port: home JS ≤ 60 KB gzipped (`npm run check:size`), CSS ≤ 25 KB, body text ≥ 4.5:1, CLS < 0.05, no long tasks > 50 ms from our fx on a 4x-throttled CPU, and e2e and axe pass.
