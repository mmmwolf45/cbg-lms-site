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
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
    this.list.push({ obj, home: obj.position.clone(), from: new THREE.Vector3(...from), to: new THREE.Vector3(...(to ?? [from[0] * 0.6, from[1] * 0.6 + 0.6, from[2] * 0.6])), spin, lag, rot0: obj.rotation.y });
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

// Keeps a sphere of `radius` around `target` in frame at any aspect, from a fixed viewing direction, with a
// slow ambient sway (period ~16 s). Allocation-free.
export class Framer {
  private dir: THREE.Vector3;
  private aspect = 0;
  private dist = 10;
  constructor(public cam: THREE.PerspectiveCamera, public target: THREE.Vector3, dir: [number, number, number], public radius: number, public sway = 0.035) {
    this.dir = new THREE.Vector3(...dir).normalize();
  }
  update(time: number, extraYaw = 0) {
    const c = this.cam;
    if (c.aspect !== this.aspect) {
      this.aspect = c.aspect;
      const v = THREE.MathUtils.degToRad(c.fov) / 2;
      const h = Math.atan(Math.tan(v) * c.aspect);
      this.dist = this.radius / Math.sin(Math.min(v, h));
    }
    const yaw = Math.sin(time * 0.39) * this.sway + extraYaw;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), d = this.dir;
    c.position.set(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy).multiplyScalar(this.dist).add(this.target);
    c.position.y += Math.sin(time * 0.27) * 0.04;
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

// Code-built monitor on a stand: navy frame, gold edge, a child mesh named "screen" (16:10, 1.0 x 0.625).
// Used until/unless a monitor GLB appears in public/three/CATALOG.md.
export function codeMonitor(bag: Bag, kit: Kit, screen: THREE.Material, w = 1.0) {
  const P = kit.palette, h = w * 0.625, g = new THREE.Group();
  const frameG = bag.add(roundedSlab(w + 0.07, h + 0.07, 0.05, 0.035));
  const frame = new THREE.Mesh(frameG, P.navy);
  frame.position.y = h / 2 + 0.32;
  frame.add(goldEdges(bag, kit, frameG, 40));
  const scr = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(w, h)), screen);
  scr.name = 'screen';
  scr.position.z = 0.0255;
  frame.add(scr);
  const stand = new THREE.Mesh(merge(bag, [
    placed(new THREE.BoxGeometry(0.07, 0.36, 0.04), 0, 0.18, -0.03),
    placed(new THREE.CylinderGeometry(0.2, 0.22, 0.025, 40), 0, 0.0125, -0.02, 0, 0, 0, [1, 1, 0.7]),
  ]), P.slate);
  g.add(frame, stand);
  return g;
}
// Code-built laptop: base + hinged lid (opened `open` rad), lid face has the "screen" child.
export function codeLaptop(bag: Bag, kit: Kit, screen: THREE.Material, w = 0.9, open = 1.85) {
  const P = kit.palette, d = w * 0.66, g = new THREE.Group();
  const baseG = bag.add(roundedSlab(w, d, 0.035, 0.03));
  const base = new THREE.Mesh(baseG, P.slate);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.0175;
  base.add(goldEdges(bag, kit, baseG, 40));
  const deck = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(w * 0.86, d * 0.5)), P.navy);
  deck.position.set(0, d * 0.12, 0.018);
  base.add(deck);
  const lid = new THREE.Group();
  lid.position.set(0, 0.03, -d / 2);
  lid.rotation.x = -(open - Math.PI / 2);
  const lidG = bag.add(roundedSlab(w, d, 0.02, 0.03));
  const lidM = new THREE.Mesh(lidG, P.navy);
  lidM.position.y = d / 2;
  lidM.add(goldEdges(bag, kit, lidG, 40));
  const scr = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(w * 0.92, d * 0.86)), screen);
  scr.name = 'screen';
  scr.position.z = 0.0105;
  lidM.add(scr);
  lid.add(lidM);
  g.add(base, lid);
  return g;
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

// Tries a GLB from public/three; resolves undefined if it is not there yet (another agent is producing them).
export async function tryGLB(kit: Kit, name: string) {
  try { return (await kit.loadGLB(name)).scene; } catch { return undefined; }
}
