# Platform findings (T6)

Read-only Playwright probes against the live site on 2 Oct 2026. Re-run with `npx playwright test --project=live` (`e2e/probe.spec.ts`).
These answer two "unverified" items in the handover pack's `PLATFORM_NOTES.md`.

## 1. Navigation between pages is client-side
Home → course (course card), course → home (navbar logo) and browser Back all change pages **without a full page load**. The same document and `window` carry on.

**What this means for us:**
- The Custom Script loader runs **once per visit**, not once per page. Only the bundle can react to later page changes.
- The bundle's router (`src/router.ts`) is required, not optional. It updates the `cbg-route-*` class and runs teardown and setup on each change.
- After a client-side change to a course page, `#course_content` is in the DOM within about 300 ms. The router waits for a 100 ms quiet period in DOM changes before setting up, so setup runs after course.link has rendered the new page.
- If the bundle never starts, the loader also removes the route class (see `src/loader/snippet.ts`). Otherwise a stale route class would style a course page as home after a client-side change.

## 2. Classes added to `<html>` from a `<head>` script survive hydration
A class added by a script injected at the top of `<head>` (where the Custom Script slot puts it) stayed on `<html>` after hydration on `/`, `/course/101-iosh-level3-certificate` and `/course/preview-101`. It also stayed through client-side navigation. React does not replace or rewrite `<html>`.

**Caution for tests:** Playwright's `addInitScript` runs before `<html>` exists, so a class added there is lost. That looks like "hydration strips classes", but it isn't. Probes inject into the HTML response instead.

## Still unverified
- Custom Block size limit (optional probe at the Foundation checkpoint, in the IOSH draft).
- Whether Custom Blocks re-render on client-side navigation (no blocks exist yet; check once the home block is pasted).
- Lesson page structure (needs the test student account).
