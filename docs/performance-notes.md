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

## Layout shift (fixed 2 Oct 2026)
- Course page on phones measured CLS 0.172 against 0.035 for stock course.link. Cause: course.link applies `*{font-family:var(--font-family)!important}` with `--font-family: Plus Jakarta Sans` and no fallback, so text is first laid out in the browser's serif (16% narrower) and re-wraps when the font arrives. Our extra requests delayed the font, making it worse.
- Fix (critical.css): a metric-matched fallback `cbg-pjs-fb` (Arial at 106% / Arial Bold at 101.6%) added to course.link's own font variable on our routes. Result: course 0.028 (390) / 0.021 (768) / 0.042 (1440); home 0 everywhere.
- Remaining: our top course block restyling when the main CSS arrives (about 0.04 at 1440). Option: inline the course hero's layout rules into critical.css.
