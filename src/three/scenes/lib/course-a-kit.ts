// Shared helpers for the three course scenes (iosh, qs, structural): lights, easing, the arrive/leave
// drift every object follows, a soft blob shadow, geometry merging (fewer draw calls), camera framing
// that keeps the composition centred at any aspect, and a code-built monitor/laptop with a "screen".
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Kit } from '../../types';
import { COLOURS } from '../../palette';

export const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

// Quintic smootherstep: zero velocity AND acceleration at both ends, so nothing ever "kicks".
export function ease(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
// A soft hump: 0 before a, rises to 1 over [a,b], holds, falls back to 0 over [c,d].
export const hump = (a: number, b: number, c: number, d: number, x: number) => ease(a, b, x) * (1 - ease(c, d, x));

// Everything a scene creates (geometry, textures, its own few materials) goes in here so dispose() is one call.
export class Bag {
  private items: { dispose(): void }[] = [];
  add<T extends { dispose(): void }>(x: T): T { this.items.push(x); return x; }
  dispose() { for (const x of this.items) x.dispose(); this.items.length = 0; }
}

// The approved night lighting: cool sky / navy ground, one warm moon, an optional gold fill.
export function lights(scene: THREE.Scene, gold = 0) {
  scene.add(new THREE.HemisphereLight(0xcfd8ff, COLOURS.navy, 1.15));
  const moon = new THREE.DirectionalLight(0xfff1d6, 1.5);
  moon.position.set(3, 6, 5);
  scene.add(moon);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 0.9); // cool back light so silhouettes separate from the sky
  rim.position.set(-4, 3, -5);
  scene.add(rim);
  if (gold) {
    const g = new THREE.PointLight(COLOURS.gold, gold, 6, 2);
    g.position.set(0, 1.6, 1.4);
    scene.add(g);
  }
}

// Non-indexed copies merge with anything (extrudes are non-indexed, boxes are indexed).
export function merge(bag: Bag, geoms: THREE.BufferGeometry[]) {
  const flat = geoms.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((n.attributes.position.count) * 2), 2));
    return n;
  });
  const m = mergeGeometries(flat, false)!;
  flat.forEach((g) => g.dispose());
  return bag.add(m);
}
// A geometry moved into place (so parts can be merged into one mesh).
export function placed(g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s));
  return g.applyMatrix4(m);
}
// Gold outline of a geometry's hard edges.
export function goldEdges(bag: Bag, kit: Kit, g: THREE.BufferGeometry, angle = 30) {
  return new THREE.LineSegments(bag.add(new THREE.EdgesGeometry(g, angle)), kit.palette.goldLine);
}

// A soft dark contact shadow (no real-time shadows anywhere).
export function blob(bag: Bag, w: number, d: number, strength = 0.55) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(2,6,16,${strength})`);
  gr.addColorStop(0.55, `rgba(2,6,16,${strength * 0.45})`);
  gr.addColorStop(1, 'rgba(2,6,16,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  const tex = bag.add(new THREE.CanvasTexture(c));
  const mat = bag.add(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  const m = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(w, d)), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -1;
  return m;
}

// Arrive (0..0.18) and leave (0.82..1): each object drifts in from an offset and grows from small, then drifts
// away and shrinks. `lag` (0..1) staggers objects so they settle one after another, never all at once.
export interface Drifter { obj: THREE.Object3D; home: THREE.Vector3; from: THREE.Vector3; to: THREE.Vector3; spin: number; lag: number; rot0: number }
export class Drift {
  list: Drifter[] = [];
  add(obj: THREE.Object3D, from: [number, number, number], lag = 0, spin = 0, to?: [number, number, number]) {
    this.list.push({ obj, home: obj.position.clone(), from: new THREE.Vector3(...from), to: new THREE.Vector3(...(to ?? [from[0] * 0.4, from[1] * 0.3 + 0.25, from[2] * 0.4])), spin, lag, rot0: obj.rotation.y });
    return obj;
  }
  apply(p: number) {
    for (const d of this.list) {
      const a = d.lag * 0.07;
      const kin = ease(a, a + 0.11, p);
      const kout = ease(0.83 + d.lag * 0.04, 0.97 + d.lag * 0.03, p);
      const o = d.obj;
      o.position.copy(d.home).addScaledVector(d.from, 1 - kin).addScaledVector(d.to, kout);
      o.rotation.y = d.rot0 + d.spin * (1 - kin) - d.spin * 0.5 * kout;
      const s = Math.max(0.0001, (0.35 + 0.65 * kin) * kin * (1 - kout * 0.65) * (1 - kout));
      o.scale.setScalar(s);
      o.visible = s > 0.002;
    }
  }
}

// Keeps a box of half-width `hw` and half-height `hh` (metres, around `target`, margin included) in frame at
// any aspect, from a fixed viewing direction, with a slow ambient sway (period ~16 s). Allocation-free.
export class Framer {
  private dir: THREE.Vector3;
  private aspect = 0;
  private dist = 10;
  constructor(public cam: THREE.PerspectiveCamera, public target: THREE.Vector3, dir: [number, number, number], public hw: number, public hh: number, public sway = 0.035) {
    this.dir = new THREE.Vector3(...dir).normalize();
  }
  update(time: number) {
    const c = this.cam;
    if (c.aspect !== this.aspect) {
      this.aspect = c.aspect;
      const v = Math.tan(THREE.MathUtils.degToRad(c.fov) / 2);
      this.dist = Math.max(this.hw / (v * c.aspect), this.hh / v);
    }
    const yaw = Math.sin(time * 0.39) * this.sway;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), d = this.dir;
    c.position.set(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy).multiplyScalar(this.dist).add(this.target);
    c.position.y += Math.sin(time * 0.27) * 0.01 * this.dist;
    c.lookAt(this.target);
  }
}

// A 2D canvas wrapped as a texture, for screens and paper.
export function canvasTex(bag: Bag, w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = bag.add(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export const screenMat = (bag: Bag, map: THREE.Texture) =>
  bag.add(new THREE.MeshBasicMaterial({ map, toneMapped: false }));

// Rounded rectangle path (canvas).
export function rr(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number) {
  x.beginPath();
  x.roundRect(X, Y, W, H, r);
}

// A slab with rounded corners in XY, thickness along Z (centred).
export function roundedSlab(w: number, h: number, t: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const bev = Math.min(r * 0.5, t * 0.3);
  const g = new THREE.ExtrudeGeometry(s, { depth: t - bev * 2, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(t - bev * 2) / 2);
  return g;
}

// A GLB display ("monitor"/"laptop"): finds its "screen" quad, gives it planar UVs (the Kenney quads ship
// without any; u runs along +X, v up the screen) and our own screen material; gold edges on the body.
export function fitScreen(bag: Bag, kit: Kit, root: THREE.Object3D, mat: THREE.Material) {
  const screen = root.getObjectByName('screen') as THREE.Mesh | undefined;
  const mesh = (screen?.isMesh ? screen : screen?.children.find((c) => (c as THREE.Mesh).isMesh)) as THREE.Mesh | undefined;
  if (!mesh) return;
  const g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal;
  const N = new THREE.Vector3(nrm.getX(0), nrm.getY(0), nrm.getZ(0)).normalize();
  const U = new THREE.Vector3(1, 0, 0), V = new THREE.Vector3().crossVectors(N, U).normalize();
  const p = new THREE.Vector3(), us: number[] = [], vs: number[] = [];
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); us.push(p.dot(U)); vs.push(p.dot(V)); }
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  g.setAttribute('uv', new THREE.Float32BufferAttribute(us.flatMap((u, i) => [(u - u0) / (u1 - u0), (vs[i] - v0) / (v1 - v0)]), 2));
  mesh.material = mat;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m !== mesh && !(o as THREE.LineSegments).isLineSegments) m.add(goldEdges(bag, kit, m.geometry, 40));
  });
}
