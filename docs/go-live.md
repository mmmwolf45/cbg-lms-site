# Go-live checklist: home page + IOSH course page

Follows the handover pack's DEPLOY_RUNBOOK.md. Steps marked **LIVE** change what students see. Do them in this order, in one sitting (about 15 minutes), so the site is never half-styled for long.

## 0. Before (Claude Code)
- [ ] `npm test`, `npm run build` (size gate) and `npx playwright test` (mock + live) all green.
- [ ] Code review and over-engineering review done; findings fixed or listed.
- [ ] Screenshots at 1440 / 1024 / 768 / 390 and a screen recording of each page reviewed by Maasoom.
- [ ] Maasoom says go.

## 1. Publish the code (Claude Code) **LIVE within ~10 minutes**
- `git push` to `main`. GitHub Actions tests, builds and deploys `dist/` to Pages.
- Check `https://mmmwolf45.github.io/cbg-lms-site/manifest.json` shows the new file names, and the logos load: `.../brand/cbg-mark-160.png`, `.../brand/iosh-1003-white.png`.
- From this moment the loader serves the new CSS/JS: course.link's navbar, home background and course page chrome turn dark (the restyle is scoped to `cbg-route-home` / `cbg-route-course`, so lesson pages stay stock).

## 2. Re-paste the loader (All Pages) **LIVE on Save**
The loader snippet now carries the critical CSS (no white flash, no layout shift), so the pasted copy must be replaced once.
- Settings > Integrations > Custom Script > **Manage** > **All Pages**.
- Select all, paste `dist/loader-snippet.html` (also at `https://mmmwolf45.github.io/cbg-lms-site/loader-snippet.html`).
- Check line 1 is the `<!-- CBG loader ... -->` comment and the last line ends `</script>` with nothing extra (Monaco auto-closes tags). **Save**.

## 3. Home page block **LIVE on Save**
- Website > Home page. There is already one empty Custom Block (created during the 1 Oct probes): open it, select all, paste `dist/blocks/home.html`. Same line-1 / last-line check.
- Switch **off** the native **Banner** and **Courses** sections.
- Order: the Custom Block is the only visible section.
- **Save**.

## 4. IOSH course page blocks (draft, then **LIVE on Publish changes**)
- Courses > IOSH Level 3 Certificate > Landing page.
- **Add section** > Custom Block: paste `dist/blocks/iosh-level-3-top.html`. Drag it **above Course Content**.
- **Add section** > Custom Block: paste `dist/blocks/iosh-level-3-main.html`. Drag it **below Course Content**.
- Keep Course Content on. Overview, Learn, Testimonials, FAQ stay off. Reviews off.
- Check the draft at `/course/preview-101` on laptop and phone.
- **Publish changes** (this also publishes the draft items from 1 Oct: Invite only pricing, highlights, sections off).

## 5. After (Claude Code)
- [ ] `npx playwright test --project=live` read-only checks on `/` and `/course/101-iosh-level3-certificate`.
- [ ] Client-side navigation home → course → home: blocks animate on every visit, no console errors.
- [ ] Phone check on a real device (Maasoom).

## Rollback
- Design/motion bug: revert the commit and push (live in about 20 minutes because of caching), or clear the All Pages Custom Script for an instant return to stock course.link.
- Block content wrong: switch the Custom Block off (home: Save; course: Publish changes).
- Block size limit hit on paste (unverified): tell Claude Code; the main course block can be split in two.
