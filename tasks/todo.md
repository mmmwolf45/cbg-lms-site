# Todo: home page night sky

## Stage A: lab prototype (overnight)
- [x] A1 Lab harness: build-lab, serve, switcher, fx contract (`lab/`). Verify: page boots with `window.__cbg` and the panel switches state.
- [x] A2 sky (`waves`, `pure`). Accept: stars and constellations behind the content, text ≥ 4.5:1, a still under reduced motion. Verify: shots at 1440 and 390.
- [x] A3 band constellation + silk. Accept: draws with scroll, smooth, framed like today. Verify: shots.
- [x] A4 band gravity. Accept: slow drift, damped drag and throw (desktop), tap push (phone). Verify: shots and video.
- [x] A5 band scrub (Higgsfield, ≤ 30 credits). Accept: frames scrub with scroll, about 2 MB or less. Verify: shots at 3 positions.
- [x] A6 carousel gold track + strip (both themes). Accept: pin and tilt still work, the line follows progress. Verify: shots.
- [x] A7 cursor lens/invert + support card. Accept: desktop only, buttons crisp. Verify: shots with the mouse over.
- [x] A8 logo globe + coin. Accept: slow, silky, Gulf/India pins. Verify: shots, WebGL rendering.

### Checkpoint A
- [x] All variants load together with no console errors (1440 and 390), reduced motion is still, both presets look coherent.
- [x] Review pass: code-review-and-quality + ponytail-review on `lab/fx`. Fix anything jumpy or fast.
- [x] Publish the private Artifact; local lab runs via the `lab` preview; write the morning summary.

Artifact: https://claude.ai/artifact/BvV7rLeof8U4tPTnaWw8vk (private). Local: preview "lab" (npx tsx lab/serve.ts lab/out 4310).
All sections hold 60 fps on this PC's GPU at 1440 and 390 in every preset (lab/probe-gpu.mjs).

## Stage B: port the pick (after Maasoom chooses)
- [x] B0 Budget decision (6 Oct 2026, Maasoom): ship his pick exactly: theme plain, sky waves, band scrub, logo globe (cobe). JS budget raised to about 68 KB for the home page; film-scrub frames get their own image exception like the hero. Was: a full iteration adds about 22 to 27 KB of lab JS (gzipped) against 8 KB of headroom on the 60 KB home budget. Pick fewer fx, or approve a raise (e.g. to 75 KB).
- [ ] B1 Update SPEC.md 5.1 with the chosen combination; remove what's replaced (e.g. band-desk).
- [ ] B2 Port the sky into `src/motion` + `src/styles` (one slice), then build, test and check the size.
- [ ] B3 Port the strip and carousel track.
- [ ] B4 Port the band variant.
- [ ] B5 Port the cursor and support card.
- [ ] B6 Port the logo variant.
- [ ] B7 e2e + axe + contrast + throttled performance trace, then shipping-and-launch checklist; Maasoom deploys (go-live.md order).
