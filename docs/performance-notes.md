# Performance notes (input for the Phase 4 performance pass)

## Idle animation frames (checked 2 Oct 2026)
- About 60 `requestAnimationFrame` calls per second while idle, on home and course pages.
- Source: GSAP ScrollTrigger's `_rafBugFix` (node_modules/gsap/ScrollTrigger.js), a deliberate empty loop that runs while ScrollTrigger is enabled, to keep repaints smooth in some browsers. Not our code; each frame does no work.
- Option if it shows up in battery/CPU profiling on phones: after every one-shot trigger on a page has fired and no scrubbed trigger is in view, `ScrollTrigger.disable(false)` and re-enable on the next scroll. Not done yet: measure first.

## Bundle start-up task
- The entry's first run (GSAP init + setup of every trigger) is one task of about 100 to 300 ms at 4x CPU throttling (T15 measurement). Our own setup inside it is small (hero about 13 ms).
- Ideas: defer `setupMotion` work for below-the-fold sections to `requestIdleCallback`; create ScrollTriggers lazily with one IntersectionObserver.

## Sizes (per page, gzipped, after the lazy page chunks)
- Entry (GSAP core + ScrollTrigger + shared motion): about 45.6 KB.
- Home chunk about 2.8 KB; course chunk grows with T22 to T25.
- Gate: `npm run build` fails above 60 KB JS per page or 25 KB CSS.
