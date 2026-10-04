# Night-sky lab (prototype only)

A switcher over the **real** home page (`dist/preview/home.html`) for comparing the night-sky redesign
options (docs/ideas/home-night-sky.md, SPEC-home-night-sky.md). Nothing here ships. When Maasoom picks a
combination, the chosen fx get ported into `src/` (TypeScript, bundled GSAP, size budget) as a separate step.

```bash
npm run build                                   # once, so dist/ is current
npx tsx lab/build-lab.ts --out lab/out-<you>    # copy site + lab into a folder of your own
npx tsx lab/serve.ts lab/out-<you> <port>       # serve it (pick a free port 4311-4399)
```
Open `http://localhost:<port>/#theme=blueprint&sky=waves&band=constellation&logo=globe`.
Rebuild after every edit (it is a copy). `lab/out*/` is git-ignored.

## State (URL hash, also on `<html data-lab-*>`)

| key | values | what it switches |
|---|---|---|
| `theme` | `blueprint` \| `plain` \| `current` | blueprint = "Stars over blueprints" (cursor lens shows a blueprint layer; strip = star map). plain = "Night sky, plain" (cursor circle inverts colours; strip = kinetic/scramble text). current = today's site: no strip/carousel/support/cursor fx. |
| `sky` | `waves` \| `pure` \| `current` | waves = today's WebGL flow canvas (`canvas.cbg-flow`), darker, with stars on top. pure = flow hidden, near-black sky, stars, constellations, a rare slow shooting star. |
| `band` | `constellation` \| `gravity` \| `silk` \| `scrub` \| `current` | the `#cbg-band` section (today: floating desk) |
| `logo` | `globe` \| `coin` \| `current` | the CBG mark in `#cbg-about .cbg-logos` |

CSS hooks: `html[data-lab-theme="plain"]`, `html[data-lab-sky="pure"]`, etc.

## fx module contract

`lab/fx/<name>.js` (plain ES module, no build step) + optional `lab/fx/<name>.css` (linked automatically).
Names lab.js loads: `sky`, `strip`, `carousel`, `support`, `cursor` (all theme-aware: read `ctx.state.theme`),
`band-constellation`, `band-gravity`, `band-silk`, `band-scrub`, `logo-globe`, `logo-coin`.

```js
export default function mount(ctx) {
  // ctx.state      {theme, sky, band, logo}
  // ctx.reduced    prefers-reduced-motion: reduce
  // ctx.fine       a real mouse (hover + fine pointer); false on phones/tablets
  // ctx.gsap, ctx.ScrollTrigger   GSAP 3.15 (vendored, registered)
  // ctx.asset(p)   './assets/' + p   (your own images: put them in lab/assets/<name>/)
  // ctx.site(p)    './site/' + p     (the built site: img/, band-desk/, brand/, hero-explode/)
}
```
- Runs once, after the real bundle has started (`window.__cbg`). The page reloads on every switch, so no teardown.
- Build on the real DOM; don't rewrite text content. Hide what you replace (e.g. `#cbg-band .cbg-band__view`)
  rather than deleting it. Keep accessibility: decorative layers `aria-hidden="true"`, `pointer-events: none`.
- Prefix every class `lab-<name>-` and only touch your own files.
- Vendored: `lab/vendor/cobe.js` (MIT, `import createGlobe from '../vendor/cobe.js'`), gsap, ScrollTrigger.

## Design rules (from Maasoom, 5 Oct 2026)
- **Every motion slow and extremely smooth.** Long eases, heavy damping, low max speeds, no overshoot,
  no bounce, nothing fast, jumpy or attention-grabbing. Calm ambient motion (slow twinkle, slow-turning
  globe, a soft light pulse) is fine on its own; bigger moves follow scroll or cursor.
- Palette: navy-black `#081226` (deeper for the sky is fine), surface `#0F1B33`, text `#F3F5F9 / #C0C6D2 / #8F96A5`,
  the one accent gold `#D6B160` (line `rgba(214,177,96,.55)`). Fonts: Plus Jakarta Sans (display), Source Sans 3 (body).
- Phones (`!ctx.fine`): no cursor lens or tilt; ambient motion and tap versions only.
- `ctx.reduced`: a still, finished state. No loops, no scroll-scrub.
- Performance: pause rAF loops when off screen (IntersectionObserver) or the tab is hidden; canvas DPR capped
  at 1.5 (1 on phones); at most one new WebGL context per fx; prefer transforms/opacity.
- Body text contrast stays at least 4.5:1 over the brightest pixel behind it.
- Fake 3D only: canvas 2D, SVG, CSS 3D, small raw WebGL. No three.js, no React.
- The hero (exploding building) is not to be changed.
