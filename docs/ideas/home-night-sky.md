# Home page: night sky

Idea-refine one-pager, agreed with Maasoom on 5 Oct 2026 (idea-refine, then interview-me).

## Problem Statement
How might we make the CBG home page feel premium and alive for first-time visitors, without getting in the way of a student who logs in every day to reach their course? We have to work inside course.link, with about 8 KB of JavaScript budget left.

## Recommended Direction
**Night sky with gold constellations.** The page becomes a deep night sky, and the gold accent turns into constellation lines. Lines join stars the way drawings join points: a construction company's sky. Every new effect belongs to that one world instead of being a separate trick:
- the course-name strip becomes a star map, or kinetic outlined type
- a gold constellation track runs behind the course carousel
- the band becomes a constellation drawing of a building (or floating objects, silk, or a film)
- the cursor lens shows the blueprint hidden under the sky, or simply inverts colours
- the *Talk to us* card tilts under a gold spotlight
- the CBG mark stands in front of a slowly turning dotted globe (Carbon Blue *Global*), or becomes a 3D coin

The exploding-building hero stays exactly as it is. The section order stays the same.

Two iterations get prototyped side by side in one switcher ("lab"):
1. **Stars over blueprints**: the full theme, with the blueprint lens and the star-map strip.
2. **Night sky, plain**: the same sky, with an inverting cursor and kinetic type.

The switcher also covers two skies, four bands and two logos. Maasoom picks one combination, and only that one is built for real.

## Key Assumptions to Validate
- [ ] All the motion feels calm, not busy, next to the hero. *Test:* Maasoom reviews the lab on laptop and phone.
- [ ] The chosen combination fits the 60 KB JS budget. *Test:* measure the gzipped size of each fx in the lab; the port to `src/` must pass `npm run check:size`.
- [ ] Body text keeps 4.5:1 contrast over the stars. *Test:* measure at the brightest star near text.
- [ ] course.link copes with a second WebGL canvas (the globe). *Test:* live check after the port. flow.ts already proves one canvas works.
- [ ] Mid-range phones stay smooth. *Test:* throttled performance trace after the port.

## MVP Scope
**In:** the lab prototype with every variant above, desktop and phone behaviour, reduced-motion stills, and a private Artifact plus a local copy.
**Out of the prototype:** porting to `src/`, deployment, and any copy changes.

## Not Doing (and Why)
- **Changing the hero:** the owner is happy with it.
- **Reordering sections:** not wanted. Restyle and animate only.
- **React Three Fiber, shadergradient (package), liquid-glass-js:** 250–350 KB each. liquid-glass-js also uses a page screenshot that goes stale on scroll, and one WebGL context per card.
- **three.js / real 3D models:** about 140 KB, over budget. Fake 3D (canvas, CSS 3D, small WebGL) covers the brief.
- **Scroll-told course scenes** (worker walks, calculator ticks): phase 2, after the gold track ships. It needs bespoke assets per course.
- **Orbit-ring carousel:** cards are hard to read at an angle and on phones.
- **Fast, springy or attention-grabbing motion:** against the owner's motion rule ("extremely smooth").

## Open Questions
- Which combination ships? This is Maasoom's pick after reviewing the lab.
- Does the IOSH or QS page get the same sky afterwards? Later; those pages are on hold.
