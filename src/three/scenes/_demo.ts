// Smoke-test scene for the stage and the playground: a clay block with gold edges that turns with progress.
import * as THREE from 'three';
import type { SceneFactory } from '../types';

const demo: SceneFactory = async ({ palette }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(4, 3, 6);
  camera.lookAt(0, 0.5, 0);
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x0f1b33, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), palette.clay);
  box.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), palette.goldLine));
  box.position.y = 1;
  scene.add(box);
  return {
    scene,
    camera,
    update(p, _dt, t) { box.rotation.y = p * Math.PI * 2 + t * 0.05; },
  };
};
export default demo;
