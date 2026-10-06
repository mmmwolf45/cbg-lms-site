# Home page builds (6 Oct 2026)

Three home-page builds are kept ready to deploy. Maasoom picks which one goes live; deploying follows
docs/go-live.md ("Redeploying a page whose block HTML changed": stage the block unsaved, push, wait for the
manifest, Maasoom saves). Every build changes the home block HTML, so every switch needs the re-paste.

| Build | Branch / tag | What's on the home page |
|---|---|---|
| **A: Full** | branch `home-night-sky` (v1 frozen as tag `build-a-full-v1`) | Real-star night sky over the waves, outlined course-name strip, photoreal site orbit band (tuned to ~60°), course story with six photoreal orbit films (card carousel + gold line as its fallback), invert cursor, Talk-to-us card effect, cobe globe |
| **B: Lite** | branch `home-lite` (worktree `C:\Dev\cbg-lite` while it's being built) | Night sky, cobe globe, invert cursor, Talk-to-us card effect, tilting course cards with the gold line, the floating desk band (plans, laptop, hard hat), the original course-name strip |
| **C: Live today** | `main`, frozen as tag `build-c-live-2026-10-05` | What students see since 5 Oct 2026: exploding-building hero, floating desk band, card gallery |

## Deploying a build
`main` is what GitHub Pages serves (a push goes live in about 10-20 minutes).
- **A or B:** `git checkout main && git merge --ff-only <branch>` when `main` is behind it (both branches grew
  from `main`); otherwise merge with a message. Push, then re-paste `dist/blocks/home.html` (and the loader if
  `dist/loader-snippet.html` changed: A and B changed critical CSS, so re-paste it once) per go-live.md.
- **Back to C:** `git checkout main && git revert --no-edit <first-new-commit>^..HEAD` (keeps history; preferred),
  or `git reset --hard build-c-live-2026-10-05` plus a force push (only with Maasoom's OK). Re-paste the home
  block built from that state.
- Switching between A and B: merge or reset the same way; always re-paste the home block built from the branch
  that is live.

## Image weight per build (laptop, all lazy below the hero)
- A: hero frames ~2.5 MB + site orbit frames + six course films (~1-1.4 MB each, loaded per chapter).
- B and C: hero frames ~2.5 MB + band desk photo and cut-outs.

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

## Review previews (private Artifacts, 6-7 Oct 2026)
- Build A (tuned): https://claude.ai/artifact/Gy19boHCrFfXkjnRyCrTem
- Build B (lite): https://claude.ai/artifact/XqKiZJAoztjBZrPi7nBi2N
Previews play the large frame sets on every device (an Artifact version holds at most 511 files); the real site
sends phones the small sets. Build: `npx tsx lab/build-lab.ts --out lab/out-preview-<x> --artifact --plain`
(Build B's band-desk folder is copied in by hand: `cp -r dist/band-desk lab/out-preview-b/site/`).
