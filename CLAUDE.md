# CBG student site on course.link

Custom pages for cbgtraininginstitute.course.link (home, IOSH and QS course pages): vanilla TypeScript + GSAP,
built by Vite, served from GitHub Pages (mmmwolf45/cbg-lms-site) and injected into course.link by a loader
(Custom Script, All Pages) plus pasted Custom Blocks. Read first: SPEC.md, docs/builds.md, docs/go-live.md.

## Where things are
- Live home page = **Build B** = branch `main`. Build A (full night sky with films) = branch `home-night-sky`;
  the earlier live home page = tag `build-c-live-2026-10-05`. See docs/builds.md.
- Copy: `content/*.yaml`. Markup: `templates/`. Motion: `src/motion/`. Styles: `src/styles/`.
- Course pages: `content/courses/*.yaml`, HOW_TO_ADD_A_COURSE.md.

## Commands
- `npm run dev`: build, then serve the course.link mock on http://localhost:4173/ (preview "mock").
- `npm test` (vitest), `npm run build` (includes the size gate), `npx playwright test --project=mock`.

## Rules
- Maasoom approves; he clicks every Save / Publish in course.link. Claude stages (pastes) and pushes only when asked.
- A push to `main` changes the live site. If a block's HTML changed (`dist/blocks/*.html`), re-paste it right after
  the deploy; if only CSS/JS changed, the push is enough (docs/go-live.md).
- Motion: slow and extremely smooth, never fast, jumpy or bouncy. Reduced motion shows the finished state.
- Budgets (scripts/check-size.ts): home JS 68 KB, course JS 60 KB, CSS 25 KB, gzipped.
- Measure smoothness in a real Chrome window (`node lab/scroll-perf.mjs`); headless frame rates are misleading.
