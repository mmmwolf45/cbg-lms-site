# Markup contract (templates ↔ styles ↔ motion)

Templates (T11, T12, T18+) produce static HTML. Styles and motion (T13, T14+) only find things through the hooks below. Change a hook here first, then in code.

## Block roots
- Each Custom Block is one root: `<div data-cbg="<block>" class="cbg-block">`. Block names: `home`, `iosh-level-3-top`, `iosh-level-3-main` (course blocks: `<slug>-top`, `<slug>-main`).
- Nothing we style or animate lives outside a `[data-cbg]` root, except the native selectors in SPEC section 6.
- Ids are prefixed `cbg-`. Never rely on ids for motion; use the data hooks.

## Sections
- `<section id="cbg-<section-id>" class="cbg-section" data-cbg-section="<section-id>">`, using the section ids from `content/*.yaml`.
- Headings: the home hero headline is the page's only `h1`; section headings are `h2`; cards and steps are `h3`.
- A two-tone heading wraps the dimmed part in `<span class="cbg-dim">`.

## Motion hooks (all optional; content must read fully without them)
| Hook | On | Behaviour (T14 and later) |
|---|---|---|
| `data-cbg-reveal` | any element | Rises 16px and fades in once when it enters the viewport. |
| `data-cbg-reveal="stagger"` | a parent | Its direct children reveal one after another (70 ms apart). |
| `data-cbg-thread` | `.cbg-steps` list (or any element with `.cbg-node` children) | The gold thread draws with scroll; each `.cbg-node` gets `is-lit` when the thread reaches it. |
| `data-cbg-count="<number>"` | an `aria-hidden="true"` element whose text is the final number, next to a `.cbg-sr-only` copy of the same value (e.g. `<b><span aria-hidden="true" data-cbg-count="80">80</span><span class="cbg-sr-only">80</span></b>`) | Counts up from 0 when in view. Prefix/suffix text sits outside the element. Screen readers only ever read the hidden final value (`aria-label` on a plain span is ignored by several screen readers). |
| `data-cbg-gallery` | the home `courses` section | Laptop (1024px+, mouse, full motion): the section pins at the top and vertical scroll pans `.cbg-gallery__track` sideways, with the gold `.cbg-gallery__bar` showing progress (src/motion/gallery.ts). Phones: a scroll-snap row in the focusable `.cbg-gallery` region. Tablets and reduced motion: a grid. |
| `data-cbg-parallax` | the home `band` section | Its `.cbg-band__media` drifts with scroll, full motion only (src/motion/parallax.ts). |
| `data-cbg-hero` | the home hero section | Holds `.cbg-hero__media` (the `<picture>`) and an empty `<svg class="cbg-hero__lines">` for the blueprint lines (T15). |
| `data-cbg-action="login"` | the hero Log in link (`href="#navbar"`) | Clicks course.link's own navbar Login button (T16). |

Home course cards (`.cbg-course`) need no hook: src/motion/card-tilt.ts tilts every card toward the mouse (4deg at most), and the photo zoom, gold rule and edge light are CSS (motion.css). The `disciplines` strip (`.cbg-marquee`) is CSS only and `aria-hidden`.

## States set by motion
- `cbg-done`: an element has finished revealing; CSS never hides it again (survives re-setup after client-side navigation).
- `is-lit`: a `.cbg-node` the thread has reached. Lit is also the default look without JS or with reduced motion.

## Placement rules for reveals
- Not on elements with their own transform transition (e.g. `.cbg-btn`): put `data-cbg-reveal` on a wrapper.
- No reveal nested inside a stagger child.
- `data-cbg-thread` outside `.cbg-steps` needs its own CSS that scales by `--cbg-thread`.

## Pre-animation states
- Hidden starting states are CSS under `html.cbg-js` only (in `src/styles/motion.css`) and never under `prefers-reduced-motion: reduce`.
- If page setup throws, the bundle removes `cbg-js`, so hidden content can't stay hidden.

## Images
- Built by `npm run images` into `public/img/`; `src/images.json` lists every variant with width, height and bytes.
- Templates render `<picture>` with AVIF and WebP `<source>`s plus a JPEG `<img>` carrying `width`/`height` (no layout shift) and absolute URLs on the Pages base (`https://mmmwolf45.github.io/cbg-lms-site/img/...`), because blocks are pasted into course.link.
- Above-the-fold hero images: `fetchpriority="high"`, no lazy loading. Everything else: `loading="lazy" decoding="async"`.
