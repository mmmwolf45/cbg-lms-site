# Structural Design page: hero and signature sections

Chosen by Maasoom on 14 Oct 2026 from a set of three hero options and four section options.

## Problem statement
How might the Structural Design course page show, in motion, what a structural engineer actually does, so that
it feels as specific to its subject as the IOSH hazard scan and the QS build-and-take-off?

## Recommended direction (chosen)
- **Hero: Load path.** A photoreal G+5 RC building at blue hour sheds its facade floor by floor as the page
  scrolls, leaving the bare frame. Gold lines then carry the load from the roof slab into the beams and down
  three columns to the base, while an example load take-down counts up beside it. This reuses the QS scrub
  (`src/motion/scrub.ts`); the path is a few canvas strokes.
- **Section: Bending moment beam (Module 5).** One beam, three supports (simply supported, fixed both ends,
  cantilever). The student slides a 100 kN load along a 6 m span, and the bending moment and shear diagrams
  redraw, with the main steel on the tension face. It is code-drawn, interactive, and correct to the textbook
  formulas (tests/beam.test.ts).
- **Section: Below the ground (Module 6).** The QS X-ray band on a new photo pair: a clean cut through the
  soil under the building, and the same cut showing an isolated footing, a combined footing, a pile cap with
  piles and a retaining wall.

Each piece teaches a different part of the course: loads, beam design and foundations.

## Key assumptions to validate
- [ ] The illustrative numbers (the take-down and the 100 kN on 6 m beam) are fine to show: Maasoom approves.
- [ ] The beam reads on a phone: check the private preview on his iPhone.
- [ ] A 62 KB JS budget for this page (60.8 KB used) is acceptable; every other page is unchanged.

## Not doing (and why)
- **The code-drawn ETABS wireframe hero.** He prefers photoreal to stylised 3D (6 Oct 2026).
- **Mode shapes.** Its sway repeats the hero's motion.
- **The "three codes, one beam" switcher.** It is a detail, not a centrepiece. The beam covers Module 5.
- **Steel.** He chose RCC only until the steel decks arrive.

## Open questions
- Should the steel modules get their own section when they land, for example a connection-design piece?
