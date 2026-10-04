# Todo: home page night sky

## Stage A: lab prototype (overnight)
- [x] A1 Lab harness: build-lab, serve, switcher, fx contract (`lab/`). Verify: page boots with `window.__cbg` and the panel switches state.
- [ ] A2 sky (`waves`, `pure`). Accept: stars and constellations behind the content, text ≥ 4.5:1, a still under reduced motion. Verify: shots at 1440 and 390.
- [ ] A3 band constellation + silk. Accept: draws with scroll, smooth, framed like today. Verify: shots.
- [ ] A4 band gravity. Accept: slow drift, damped drag and throw (desktop), tap push (phone). Verify: shots and video.
- [ ] A5 band scrub (Higgsfield, ≤ 30 credits). Accept: frames scrub with scroll, about 2 MB or less. Verify: shots at 3 positions.
- [ ] A6 carousel gold track + strip (both themes). Accept: pin and tilt still work, the line follows progress. Verify: shots.
- [ ] A7 cursor lens/invert + support card. Accept: desktop only, buttons crisp. Verify: shots with the mouse over.
- [ ] A8 logo globe + coin. Accept: slow, silky, Gulf/India pins. Verify: shots, WebGL rendering.

### Checkpoint A
- [ ] All variants load together with no console errors (1440 and 390), reduced motion is still, both presets look coherent.
- [ ] Review pass: code-review-and-quality + ponytail-review on `lab/fx`. Fix anything jumpy or fast.
- [ ] Publish the private Artifact; local lab runs via the `lab` preview; write the morning summary.

## Stage B: port the pick (after Maasoom chooses)
- [ ] B1 Update SPEC.md 5.1 with the chosen combination; remove what's replaced (e.g. band-desk).
- [ ] B2 Port the sky into `src/motion` + `src/styles` (one slice), then build, test and check the size.
- [ ] B3 Port the strip and carousel track.
- [ ] B4 Port the band variant.
- [ ] B5 Port the cursor and support card.
- [ ] B6 Port the logo variant.
- [ ] B7 e2e + axe + contrast + throttled performance trace, then shipping-and-launch checklist; Maasoom deploys (go-live.md order).
