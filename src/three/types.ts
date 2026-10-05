// The contract between the 3D stage (stage.ts) and the scenes (scenes/*.ts). Everything under src/three is
// one lazy chunk: it loads only when a 3D section is about to come on screen (src/motion/three-sections.ts).
import type * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Palette } from './palette';

// 'low' phones get fewer instances, no glow and a lower pixel ratio; 'high' laptops get everything.
export type Quality = 'low' | 'mid' | 'high';

export interface Kit {
  quality: Quality;
  palette: Palette;
  // A model from public/three/<name>.glb (meshopt-compressed, already recoloured to the palette's names).
  loadGLB: (name: string) => Promise<GLTF>;
  // Renders a scene once into a texture (e.g. the model a monitor shows). Rendered at build time of the
  // scene, not per frame, so screens cost nothing while scrolling.
  snapshot: (scene: THREE.Scene, camera: THREE.Camera, width: number, height: number) => THREE.Texture;
}

// One scene on the shared canvas. The stage owns the renderer and the loop; a scene only describes itself.
//   progress: scroll position through the scene's own stretch, 0..1, already smoothed by the stage (never
//             jumps, so scenes may map it straight onto positions).
//   dt, time: seconds since the last frame / since the scene was shown, for slow ambient motion only.
// update() must be cheap: no allocation, no DOM reads.
export interface StageScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(progress: number, dt: number, time: number): void;
  // Ambient-only scenes (no ambient motion and progress unchanged) can say so, and the stage stops
  // rendering until the next scroll.
  idle?(): boolean;
  dispose?(): void;
}

export type SceneFactory = (kit: Kit) => Promise<StageScene>;
