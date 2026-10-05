// Entry of the lazy 3D chunk (src/motion/three-sections.ts imports it when a 3D section nears the screen).
// Each scene is its own chunk too, so the story fetches a course's scene only as it approaches.
import type { SceneFactory } from './types';

export { createStage } from './stage';
export type { Stage } from './stage';
export type { StageScene } from './types';

// Scene files whose names start with a letter (`_demo`, `_props` are playground-only).
const files = import.meta.glob<{ default: SceneFactory }>('./scenes/[a-z]*.ts');

export function sceneLoader(name: string): (() => Promise<SceneFactory>) | undefined {
  const load = files[`./scenes/${name}.ts`];
  return load && (() => load().then((m) => m.default));
}
