// Props catalogue (playground only, never shipped): every model in public/three/CATALOG.md on a grid, drawn
// with the palette exactly as the course scenes will load it. Each prop is scaled to fit its cell (the label
// gives its real size in metres); progress turns them all, so p=0 shows fronts (+Z) and p=0.5 backs.
//   /?scene=_props&p=0      /?scene=_props&p=0.125 (three-quarter)      &only=vest,laptop (a subset, closer)
import * as THREE from 'three';
import type { SceneFactory } from '../types';

const ALL = [
  'monitor', 'laptop', 'keyboard', 'desk', 'office-chair', 'plant-small',
  'sofa', 'sofa-classic', 'armchair', 'armchair-classic', 'coffee-table', 'coffee-table-glass',
  'floor-lamp', 'floor-lamp-square', 'side-table', 'plant', 'rug-rect', 'rug-round',
  'rug-rounded', 'hi-vis-vest', 'safety-gloves', 'safety-boots', 'safety-goggles',
];
const only = new URLSearchParams(location.search).get('only');
const NAMES = only ? only.split(',') : ALL;
const COLS = Math.min(6, NAMES.length), CELL = 3, DEPTH = 3.6, FIT = 1.7;

function label(text: string, sub: string) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e9e2d4'; g.font = '600 44px system-ui'; g.textAlign = 'center';
  g.fillText(text, 256, 54);
  g.fillStyle = '#d6b160'; g.font = '32px system-ui';
  g.fillText(sub, 256, 104);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  s.scale.set(2, 0.5, 1);
  return s;
}

const props: SceneFactory = async ({ palette, loadGLB }) => {
  const scene = new THREE.Scene();
  const rows = Math.ceil(NAMES.length / COLS);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const span = Math.max(COLS * CELL * 0.75, rows * DEPTH * 1.1);
  camera.position.set(0, span * 1.15, span * 1.3);
  camera.lookAt(0, 0, 0.3);
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x0f1b33, 1.2));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.8);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const spinners: THREE.Object3D[] = [];
  const box = new THREE.Box3(), size = new THREE.Vector3();
  const loaded = await Promise.all(NAMES.map((n) => loadGLB(n).then((g) => g.scene, () => null)));
  loaded.forEach((model, i) => {
    const x = ((i % COLS) - (COLS - 1) / 2) * CELL, z = (Math.floor(i / COLS) - (rows - 1) / 2) * DEPTH;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(FIT * 0.6, 32), palette.navy);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, -0.001, z);
    scene.add(floor);
    if (!model) { scene.add(Object.assign(label(NAMES[i], 'missing'), { position: new THREE.Vector3(x, 0.4, z + 0.9) })); return; }
    box.setFromObject(model).getSize(size);
    const s = FIT / Math.max(size.x, size.y, size.z);
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    model.scale.setScalar(s);
    pivot.add(model);
    scene.add(pivot);
    spinners.push(pivot);
    const tag = label(NAMES[i], `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m`);
    tag.position.set(x, -0.05, z + FIT * 0.75);
    scene.add(tag);
  });

  return {
    scene,
    camera,
    update(p) { for (const o of spinners) o.rotation.y = p * Math.PI * 2; },
    idle: () => true, // no ambient motion: the stage stops once progress settles
    dispose() {
      scene.traverse((o) => {
        if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose(); }
        else if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    },
  };
};
export default props;
