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
