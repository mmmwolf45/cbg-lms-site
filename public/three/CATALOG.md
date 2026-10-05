# 3D models (public/three)

Load with `kit.loadGLB('<name>')`; materials are already named after palette swatches, so `applyPalette`
recolours them. All props: metres, +Y up, facing +Z, origin at the base centre (sit them on y = 0).
Displays (`monitor`, `laptop`) have a child node/mesh named `screen` (material `screen`): find it with
`gltf.scene.getObjectByName('screen')` and give it your own material/texture. Built by `npm run three-assets`
from `brand/assets/three/props`; licences in `brand/assets/three/CREDITS.md`.

<!-- props:start (written by scripts/three-assets.ts) -->
| name | what | tris | KB | materials | size W x H x D (m) | source |
|---|---|---|---|---|---|---|
| `monitor` | Desktop monitor on a stand; display = node/mesh "screen" | 72 | 4.1 | navy, screen | 0.59 x 0.44 x 0.16 | Kenney Furniture Kit 2.0, CC0 |
| `laptop` | Open laptop; display = node/mesh "screen" | 68 | 4.9 | navy, screen, slate | 0.34 x 0.21 x 0.31 | Kenney Furniture Kit 2.0, CC0 |
| `keyboard` | Desktop keyboard | 32 | 3.3 | navy, slate | 0.42 x 0.04 x 0.18 | Kenney Furniture Kit 2.0, CC0 |
| `desk` | Office desk with drawer | 198 | 5.1 | clay, gold | 1.47 x 0.77 x 0.78 | Kenney Furniture Kit 2.0, CC0 |
| `office-chair` | Swivel office chair | 588 | 8.5 | navy, clay | 0.67 x 1.22 x 0.63 | Kenney Furniture Kit 2.0, CC0 |
| `sofa` | Modern sofa, slim metal frame | 116 | 4.3 | clay, gold | 2.24 x 0.80 x 0.82 | Kenney Furniture Kit 2.0, CC0 |
| `sofa-classic` | Boxy sofa, wooden base | 128 | 4.5 | clay, slate | 1.96 x 0.92 x 0.82 | Kenney Furniture Kit 2.0, CC0 |
| `armchair` | Modern armchair, slim metal frame | 116 | 4.4 | clay, gold | 1.46 x 0.80 x 0.82 | Kenney Furniture Kit 2.0, CC0 |
| `armchair-classic` | Boxy armchair, wooden base | 128 | 4.5 | clay, slate | 0.98 x 0.92 x 0.82 | Kenney Furniture Kit 2.0, CC0 |
| `coffee-table` | Low coffee table | 124 | 3.0 | clay | 1.32 x 0.46 x 0.80 | Kenney Furniture Kit 2.0, CC0 |
| `coffee-table-glass` | Coffee table, glass top on a metal frame | 140 | 4.2 | gold, glass | 1.32 x 0.46 x 0.80 | Kenney Furniture Kit 2.0, CC0 |
| `floor-lamp` | Floor lamp, round shade | 76 | 3.9 | gold, clay | 0.30 x 1.72 x 0.35 | Kenney Furniture Kit 2.0, CC0 |
| `floor-lamp-square` | Floor lamp, square shade | 60 | 3.6 | clay, gold | 0.24 x 1.72 x 0.24 | Kenney Furniture Kit 2.0, CC0 |
| `side-table` | Small side table | 118 | 4.2 | clay, gold | 0.75 x 0.54 x 0.31 | Kenney Furniture Kit 2.0, CC0 |
| `plant` | Tall potted plant (leaves in slate: the palette has no green) | 60 | 5.1 | clay, navy, slate | 0.42 x 1.31 x 0.48 | Kenney Furniture Kit 2.0, CC0 |
| `plant-small` | Small desk plant in a pot | 158 | 5.5 | clay, slate | 0.19 x 0.28 x 0.19 | Kenney Furniture Kit 2.0, CC0 |
| `rug-rect` | Rectangular rug, gold border | 28 | 3.2 | clay, gold | 3.14 x 0.02 x 1.84 | Kenney Furniture Kit 2.0, CC0 |
| `rug-round` | Round rug, two tones | 188 | 4.2 | slate, navy | 1.84 x 0.02 x 1.84 | Kenney Furniture Kit 2.0, CC0 |
| `rug-rounded` | Rounded-corner rug, two tones | 204 | 4.3 | slate, clay | 3.14 x 0.02 x 1.84 | Kenney Furniture Kit 2.0, CC0 |
| `hi-vis-vest` | Hi-vis safety vest, gold reflective bands | 6000 | 49.2 | orange, gold | 0.64 x 0.70 x 0.46 | Higgsfield Tripo text-to-3D (generated for CBG) |
| `safety-gloves` | Pair of safety gloves | 5998 | 43.6 | orange, slate | 0.30 x 0.26 x 0.12 | Higgsfield Tripo text-to-3D (generated for CBG) |
| `safety-boots` | Pair of safety boots, brown leather toes | 6000 | 52.0 | rebar, navy, slate | 0.41 x 0.30 x 0.39 | Higgsfield Tripo text-to-3D (generated for CBG) |
| `safety-goggles` | Safety goggles with strap | 6000 | 45.6 | glass, slate | 0.19 x 0.07 x 0.19 | Higgsfield Tripo text-to-3D (generated for CBG) |
<!-- props:end -->

## site (home band)
`src/three/scenes/site.ts` downloads no model: the whole night construction site (frame building, tower crane,
scaffold, fence, lamps, plant, materials) is built in code from boxes and tubes and merged into one mesh per
palette material. 0 KB of GLB; about 25 draw calls and 14.6k triangles on high, 10k on low.
