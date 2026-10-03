# 3D exploded-building hero (home page)

Agreed with Maasoom, 3 Oct 2026 (idea-refine). References: motionsites.ai "Shadow 3D" (headline woven
through the figure) and "Neon Logic" (huge dim word behind, subject, crisp text in front).

## Problem Statement
How might we make the first screen feel premium and alive, and stand for every CBG discipline, while
"Welcome to your CBG classroom" stays the clear headline?

## Recommended Direction
A gold line-art building drawn in 3D by our own small renderer (no three.js). Its layers are the
institute's disciplines: structure, MEP runs, the BIM grid, interiors, QS dimension lines and safety
rails. On laptops it turns about ±30° and tilts about ±10° with the cursor, and the layers spread
apart as it turns and as the page scrolls. On phones, scroll drives the same motion (the site's rule:
nothing moves unless the reader acts).

The headline stays real HTML text, sandwiched between a back canvas and a front canvas: segments
nearer the camera than the text plane are drawn on the front canvas and pass over the letters. A
navy halo behind the letters keeps them readable.

## Key Assumptions to Validate
- [ ] An exploded building in thin lines reads as a building, not noise, at 1440 and 390 wide:
      prototype screenshots plus Maasoom's eye.
- [ ] The headline stays readable with beams in front of it: contrast measurement plus his eye.
- [ ] The night photo isn't needed now that the flow background carries the atmosphere.
- [ ] Scroll-driven rotation feels good on phones: checked on his phone.

## MVP Scope
Home hero only, keeping Log in and Need help?. A designed fixed angle under reduced motion. The
current photo hero stays in the block HTML as the fallback if the script doesn't run. About 6 to 8
KB, partly offset by retiring the photo-tracing blueprint code.

## Not Doing (and Why)
- three.js, photoreal models, AI turntables: about 130 KB plus the model, phone-hostile, off-brand.
- Spinning on its own: breaks the "nothing moves unless you act" rule (WCAG 2.2.2).
- Phone tilt (gyroscope) control: needs an iPhone permission prompt.
- Clickable layers: a later idea at most.
- The IOSH course page hero: untouched.

## Open Questions
- Layout: a big centred headline over the building, or the current split? The prototype shows both.
- Keep a faint version of the night photo?
