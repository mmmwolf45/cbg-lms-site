// The one look for every 3D object: stylised "clay and gold" on the night sky (approved 6 Oct 2026).
// Every model, whatever its source (code, Kenney/Quaternius kits, AI-generated), is drawn with these
// shared materials, so forty objects from different places read as one designed world. Shared instances
// also keep shader programs and draw-state changes to a minimum.
import * as THREE from 'three';

export const COLOURS = {
  navy: 0x0f1b33, // deep bodies, floors, monitor frames
  slate: 0x3a4a66, // secondary bodies: steel, machinery
  clay: 0xe9e2d4, // warm off-white: walls, concrete, paper, the main "clay" surface
  gold: 0xd6b160, // the one accent: edges, highlights, emissive lines
  orange: 0xe8833a, // safety orange, PPE and cones only
  screen: 0x7fb2ff, // monitor glow
  rebar: 0x8a5a3c, // rust-brown steel inside concrete
  glass: 0x9fb8d8,
} as const;

export type Swatch = keyof typeof COLOURS;

export type Palette = Record<Swatch, THREE.MeshStandardMaterial> & {
  // Gold lines and glowing accents: bright enough to cross the bloom threshold (stage.ts).
  goldLine: THREE.LineBasicMaterial;
  goldGlow: THREE.MeshBasicMaterial;
  screenGlow: THREE.MeshBasicMaterial;
};

export function makePalette(): Palette {
  const std = (c: number, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0, flatShading: false, ...o });
  return {
    navy: std(COLOURS.navy, { roughness: 0.6 }),
    slate: std(COLOURS.slate, { roughness: 0.55, metalness: 0.35 }),
    clay: std(COLOURS.clay),
    gold: std(COLOURS.gold, { roughness: 0.32, metalness: 0.85, emissive: COLOURS.gold, emissiveIntensity: 0.08 }),
    orange: std(COLOURS.orange, { roughness: 0.5 }),
    screen: std(COLOURS.screen, { emissive: COLOURS.screen, emissiveIntensity: 0.9, roughness: 0.3 }),
    rebar: std(COLOURS.rebar, { roughness: 0.7, metalness: 0.3 }),
    glass: std(COLOURS.glass, { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35 }),
    // Colours above 1 (HDR) are what the bloom picks up; everything else stays crisp.
    goldLine: new THREE.LineBasicMaterial({ color: new THREE.Color(COLOURS.gold).multiplyScalar(2.2) }),
    goldGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(COLOURS.gold).multiplyScalar(2.4) }),
    screenGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(COLOURS.screen).multiplyScalar(1.6) }),
  };
}

// Recolour a loaded model: each mesh's material is swapped for the palette swatch whose name its material
// (or node) name starts with, e.g. "gold", "clay_wall", "orange.001". Unnamed materials become clay.
// scripts/three-assets.ts renames source materials to these names when it imports a kit.
export function applyPalette(root: THREE.Object3D, p: Palette) {
  const names = Object.keys(COLOURS) as Swatch[];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = (Array.isArray(m.material) ? m.material[0]?.name : m.material?.name) || m.name || '';
    const hit = names.find((n) => name.toLowerCase().startsWith(n));
    m.material = p[hit ?? 'clay'];
  });
}
