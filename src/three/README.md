# src/three: the home page's 3D (lazy chunk)

Decided 6 Oct 2026 with Maasoom: stylised **clay + gold** look; one shared canvas; the band becomes a 3D night
construction site the scroll walks 360° around; the "Your courses" pin becomes a scroll story with one 3D scene
per course (replacing the sideways card pan on capable devices). Gold reads as glowing from over-bright gold
materials and halo sprites: there is NO bloom/post-processing pass (6 Oct 2026: its shaders froze Intel GPUs for
6-12 s on first use, and it cost 17 full-screen passes per frame). No environment map either (0.7 s freeze).

## Files
- `types.ts`: the contract (`Kit`, `StageScene`, `SceneFactory`). Read it first.
- `stage.ts`: shared renderer, damped progress, quality tiers, pausing, context loss. Scenes never own a renderer.
- `palette.ts`: the shared materials. **Use `kit.palette.*`, never `new MeshStandardMaterial` with ad-hoc colours.**
  Gold accents: `palette.gold` and `palette.goldLine` / `palette.goldGlow` (over-bright; use halo sprites for lights).
- `scenes/<name>.ts`: one file per scene, `export default` a `SceneFactory`. Names: `site`, `iosh`, `qs`, `bim`,
  `mep`, `structural`, `interior`.
- Models: `public/three/<name>.glb` (meshopt, materials named after palette swatches), loaded with `kit.loadGLB(name)`.
  Catalogue: `public/three/CATALOG.md`. Sources and licences: `brand/assets/three/CREDITS.md`.

## Playground
`npx vite --config lab3d/vite.config.ts --port <yours>` then `/?scene=<name>&p=0.4&q=high` (q: high|mid|low,
play=1 sweeps progress). `window.__lab3d.ready` resolves once shown; `window.__lab3d.set(p)` sets progress.

## Rules
- **Motion: slow and extremely smooth.** Progress is already damped by the stage; map it to positions with
  smoothstep-style easing, never step changes. Ambient motion (idle drift, screen flicker) is slow (periods of 6 s+).
  No bounce, no overshoot, nothing fast.
- **Course scenes** (`progress` = scroll through that course's chapter): 0–0.18 objects arrive (drift/assemble in),
  0.18–0.82 the scene's "action", 0.82–1 objects drift out softly. At 0.5 the scene must look complete and composed
  (it is also the still shown under reduced motion and on devices without WebGL2: `scripts` render it to a WebP).
  Frame the composition centred in the canvas; the page puts the course text beside it (desktop) or below it (phone).
- **Site scene** (`progress` = 0..1 is one full 360° orbit, camera slowly circling and gently rising).
- **Budgets per scene** (high tier): ≤ 60 draw calls, ≤ 120k triangles, GLB downloads ≤ 400 KB; `low` tier: half
  the instances/detail. No real-time shadows (fake them: a soft dark blob plane). Instancing for repeats.
- **Lighting:** `HemisphereLight` (cool sky / navy ground) + one warm `DirectionalLight` (moonlight) + a few gold
  `PointLight`s at most. Night mood, but objects must read clearly.
- **Screens/monitors:** a `CanvasTexture` you draw, or `kit.snapshot(...)` once at build. Never live per-frame renders.
- `update()` allocates nothing; reuse vectors. Provide `dispose()` that disposes your geometries/textures (palette
  materials are shared: don't dispose them).
