# 3D sources and licences

Every model in `public/three` and where it came from. Sources live in `brand/assets/three/props/`; the GLBs are
built from them by `npm run three-assets` (scripts/three-assets.ts). Add a row when you add a source.

## Props

| models | source | licence | fetched |
|---|---|---|---|
| monitor, laptop, keyboard, desk, office-chair, sofa, sofa-classic, armchair, armchair-classic, coffee-table, coffee-table-glass, floor-lamp, floor-lamp-square, side-table, plant, plant-small, rug-rect, rug-round, rug-rounded | **Furniture Kit 2.0** by Kenney (www.kenney.nl), downloaded from the official page https://kenney.nl/assets/furniture-kit (`Models/GLTF format`). Licence text kept at `props/kenney-furniture-kit/License.txt`. | CC0 1.0 (public domain; credit "Kenney" appreciated, not required) | 5 Oct 2026 |
| hi-vis-vest, safety-gloves, safety-boots, safety-goggles | Generated for CBG with **Higgsfield Tripo text-to-3D** (`tripo_3d`, textured, 10k-face limit), raw outputs kept in `props/tripo/`. Job ids: vest 07d8c541-922e-4a3a-b225-2abc1d9964d9, gloves 2cb8dffa-26fe-4058-8d93-d7eb169e8313, boots 01184bdc-00ac-450e-a5fc-1ae288e84a0a, goggles 78291b47-b75a-4a0d-81c6-9b391333ac55. | Generated on Maasoom's Higgsfield plan (5 credits each, approved 5 Oct 2026). Usage rights follow Higgsfield's terms for that plan: **not yet checked against their terms page**, confirm commercial use before launch | 5 Oct 2026 |

## Scenes built in code

| scene | source | licence | date |
|---|---|---|---|
| site (home band: building, crane, scaffold, fence, lamps, excavator, truck, cabin, materials) | Procedural, written for CBG in `src/three/scenes/site.ts`; no third-party models or textures (gravel, glow and sky gradient are drawn on canvases at load) | CBG's own code | 5 Oct 2026 |
