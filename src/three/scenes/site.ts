// The home band: a calm construction site at night. Scroll (progress 0..1) walks the camera once around it,
// rising a little; the crane slews a few degrees, the hook sways, the site lights breathe, dust drifts.
//
// Everything is built in code (no download): boxes and tubes placed with matrices, then merged into one
// mesh per palette material, so the whole site is a handful of draw calls. Units are metres, Y up; the
// building sits on the origin, the crane stands to its west (-x).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLOURS } from '../palette';
import type { SceneFactory } from '../types';

export const siteMeta = { caption: 'Where the skills we teach go to work' };

const TAU = Math.PI * 2;
const FH = 3.2; // floor height
const W = 18, D = 12; // building footprint (x, z)
const XS = [-9, -4.5, 0, 4.5, 9], ZS = [-6, 0, 6]; // column grid
const CRANE = { x: -14.5, z: 2.5, h: 26, jib: 25, counter: 8.5 };
const FENCE = { x0: -25, x1: 23, z0: -18, z1: 18, gate: 4 };

// Seeded random, so every visit builds the same site.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  return new THREE.CanvasTexture(c);
}
const radial = (stops: [number, string][]) => canvasTexture(128, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, c] of stops) grad.addColorStop(o, c);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
});

const site: SceneFactory = async ({ palette: P, quality }) => {
  const low = quality === 'low', high = quality === 'high';
  const rand = rng(7);
  const owned: { dispose(): void }[] = []; // geometries, textures and materials this scene made

  // ---- builder: unit shapes placed by matrix, grouped per material, merged at the end ----
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const TUBE = new THREE.CylinderGeometry(1, 1, 1, low ? 5 : 7, 1);
  const CONE = new THREE.ConeGeometry(1, 1, 10, 1);
  const PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  type Batch = Map<THREE.Material, THREE.BufferGeometry[]>;
  const statics: Batch = new Map(), crane: Batch = new Map(), hook: Batch = new Map();
  let into = statics;
  const parent = new THREE.Matrix4();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), dv = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  const put = (mat: THREE.Material, g: THREE.BufferGeometry) => {
    const c = g.clone().applyMatrix4(m4).applyMatrix4(parent);
    if (!into.has(mat)) into.set(mat, []);
    into.get(mat)!.push(c);
  };
  // Where the next shapes go: an object's own position and heading on the ground.
  const place = (x = 0, y = 0, z = 0, ry = 0) => parent.compose(pv.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), sv.set(1, 1, 1));
  const box = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rz = 0) => {
    m4.compose(pv.set(x, y, z), q.setFromEuler(e.set(0, ry, rz)), sv.set(w, h, d));
    put(mat, BOX);
  };
  // A member from a to b: a square bar (lattice, beams) or a round tube (scaffold, rebar, poles).
  const bar = (mat: THREE.Material, ax: number, ay: number, az: number, bx: number, by: number, bz: number, t: number, round = false) => {
    dv.set(bx - ax, by - ay, bz - az);
    const len = dv.length();
    q.setFromUnitVectors(Y, dv.divideScalar(len));
    m4.compose(pv.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, sv.set(round ? t / 2 : t, len, round ? t / 2 : t));
    put(mat, round ? TUBE : BOX);
  };

  // ---- the building: concrete frame, finished lower floors, gold slab edges, a core above the roof ----
  place();
  box(P.clay, W + 1.2, 0.4, D + 1.2, 0, 0.2, 0); // ground slab
  const SLABS = 5;
  for (let f = 1; f <= SLABS; f++) {
    const y = f * FH;
    box(P.clay, W + 0.6, 0.32, D + 0.6, 0, y, 0);
    // Gold edge lines along each slab's outer top edge (bright: the bloom picks them up).
    const t = 0.07, hx = (W + 0.6) / 2, hz = (D + 0.6) / 2, ty = y + 0.17;
    box(P.goldGlow, W + 0.6 + t, t, t, 0, ty, hz);
    box(P.goldGlow, W + 0.6 + t, t, t, 0, ty, -hz);
    box(P.goldGlow, t, t, D + 0.6, hx, ty, 0);
    box(P.goldGlow, t, t, D + 0.6, -hx, ty, 0);
  }
  for (let f = 0; f < SLABS; f++) for (const x of XS) for (const z of ZS) {
    if (z === 0 && x !== -9 && x !== 9 && f < 2) continue; // inner columns hidden behind the facade anyway
    box(P.clay, 0.5, FH - 0.32, 0.5, x, f * FH + FH / 2 + 0.1, z);
  }
  // Top floor: some columns already poured, the rest only starter bars.
  for (const x of XS) for (const z of ZS) {
    const y0 = SLABS * FH + 0.16, poured = (x + z) % 2 === 0 || x === -9;
    if (poured) box(P.clay, 0.5, 1.9, 0.5, x, y0 + 0.95, z);
    const top = y0 + (poured ? 1.9 : 0);
    for (const [ox, oz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) bar(P.rebar, x + ox, top, z + oz, x + ox, top + 0.9, z + oz, 0.05, true);
  }
  box(P.clay, 4, SLABS * FH + 3.6, 4.4, 4.5, (SLABS * FH + 3.6) / 2, -0.2); // lift/stair core
  box(P.goldGlow, 4.07, 0.07, 0.07, 4.5, SLABS * FH + 3.6, 2.03);
  box(P.navy, 1.1, 2.2, 0.1, 4.5, SLABS * FH + 1.3, 2.0); // the core's open doorway on the roof
  // Finished lower two floors: dark interior behind glass, clay spandrels and mullions.
  box(P.navy, W - 0.6, 2 * FH - 0.3, D - 0.6, 0, FH + 0.1, 0);
  const bayFront = (x0: number, x1: number, z: number, f: number, glazed: boolean) => {
    const w = x1 - x0 - 0.5, cx = (x0 + x1) / 2, y = f * FH + 0.16;
    box(P.clay, w, 1.0, 0.24, cx, y + 0.5, z);
    if (glazed) {
      box(P.glass, w, FH - 1.3, 0.06, cx, y + 1.0 + (FH - 1.3) / 2, z);
      box(P.clay, 0.14, FH - 1.3, 0.2, cx, y + 1.0 + (FH - 1.3) / 2, z);
    }
  };
  const baySide = (z0: number, z1: number, x: number, f: number, glazed: boolean) => {
    const w = z1 - z0 - 0.5, cz = (z0 + z1) / 2, y = f * FH + 0.16;
    box(P.clay, 0.24, 1.0, w, x, y + 0.5, cz);
    if (glazed) {
      box(P.glass, 0.06, FH - 1.3, w, x, y + 1.0 + (FH - 1.3) / 2, cz);
      box(P.clay, 0.2, FH - 1.3, 0.14, x, y + 1.0 + (FH - 1.3) / 2, cz);
    }
  };
  for (let f = 0; f < 3; f++) for (let i = 0; i < XS.length - 1; i++) {
    // Floors 0-1 finished; floor 2 is half way (spandrels on some bays, no glass yet).
    const done = f < 2, part = f === 2 && i % 2 === 0;
    if (!done && !part) continue;
    bayFront(XS[i], XS[i + 1], D / 2 + 0.02, f, done);
    bayFront(XS[i], XS[i + 1], -D / 2 - 0.02, f, done && !(f === 0 && i === 1));
  }
  for (let f = 0; f < 2; f++) for (let i = 0; i < ZS.length - 1; i++) {
    baySide(ZS[i], ZS[i + 1], -W / 2 - 0.02, f, true);
    baySide(ZS[i], ZS[i + 1], W / 2 + 0.02, f, true);
  }
  box(P.navy, 2.6, 2.6, 0.3, -6.75, 1.5, -D / 2 - 0.05); // entrance gap on the north side

  // ---- scaffolding up the east end (x = +W/2) ----
  {
    const x0 = W / 2 + 0.7, x1 = x0 + 1.3, lift = low ? 4 : 2, top = SLABS * FH + 1.5;
    const zsS = [-6.6, -4.4, -2.2, 0, 2.2, 4.4, 6.6];
    for (const z of zsS) for (const x of [x0, x1]) bar(P.slate, x, 0.3, z, x, top + 1, z, 0.09, true);
    for (let y = lift; y <= top; y += lift) {
      for (const x of [x0, x1]) bar(P.slate, x, y, zsS[0], x, y, zsS[6], 0.08, true);
      for (const z of zsS) bar(P.slate, x0 - 0.3, y, z, x1 + 0.1, y, z, 0.07, true);
      if (Math.round(y / 2) % 2 === 0 || low) box(P.clay, 1.25, 0.06, 13.4, (x0 + x1) / 2, y + 0.05, 0); // boards
      bar(P.slate, x1, y - lift, y / lift % 2 ? zsS[0] : zsS[3], x1, y, y / lift % 2 ? zsS[3] : zsS[0], 0.06, true); // braces
      bar(P.slate, x1, y - lift, y / lift % 2 ? zsS[3] : zsS[6], x1, y, y / lift % 2 ? zsS[6] : zsS[3], 0.06, true);
    }
    for (let y = lift; y <= top; y += lift * 2) bar(P.slate, x1, y + 1, zsS[0], x1, y + 1, zsS[6], 0.05, true); // guard rail
  }

  // ---- tower crane: lattice mast (static), slewing jib (moves), hook with a beam (sways) ----
  const C = CRANE, s = 1.7, hs = s / 2;
  place(C.x, 0, C.z);
  box(P.clay, 4.5, 0.7, 4.5, 0, 0.35, 0); // footing
  box(P.slate, 2.4, 0.5, 2.4, 0, 0.9, 0);
  for (const [cx, cz] of [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]]) bar(P.gold, cx, 1, cz, cx, C.h, cz, 0.16);
  {
    const bay = low ? s * 2 : s, n = Math.floor((C.h - 1) / bay);
    for (let i = 0; i < n; i++) {
      const y0 = 1 + i * bay, y1 = y0 + bay, flip = i % 2 === 0;
      const faces: [number, number, number, number][] = [[-hs, -hs, hs, -hs], [hs, -hs, hs, hs], [hs, hs, -hs, hs], [-hs, hs, -hs, -hs]];
      for (const [ax, az, bx, bz] of faces) {
        bar(P.gold, ax, y1, az, bx, y1, bz, 0.07);
        if (flip) bar(P.gold, ax, y0, az, bx, y1, bz, 0.06);
        else bar(P.gold, bx, y0, bz, ax, y1, az, 0.06);
      }
    }
  }
  // The slewing part is its own group (rotates about the mast).
  const craneTop = new THREE.Group();
  craneTop.position.set(C.x, C.h, C.z);
  into = crane;
  place();
  box(P.slate, 2.4, 0.7, 2.4, 0, 0.35, 0); // slewing unit
  box(P.clay, 1.5, 1.7, 1.6, 0.6, 0.6, 1.85); // cab
  box(P.glass, 0.06, 1.1, 1.3, 1.36, 0.75, 1.85);
  const apex = 6.5;
  for (const [cx, cz] of [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]]) bar(P.gold, cx, 0.7, cz, 0, apex, 0, 0.12);
  box(P.goldGlow, 0.25, 0.25, 0.25, 0, apex + 0.2, 0); // aviation light
  // Jib: triangular lattice, +x.
  const jb = 0.6, jh = 1.5, jbay = low ? 3.6 : 1.8, J0 = hs, J1 = C.jib;
  bar(P.gold, J0, 0.7, -jb, J1, 0.7, -jb, 0.12);
  bar(P.gold, J0, 0.7, jb, J1, 0.7, jb, 0.12);
  bar(P.gold, J0, 0.7 + jh, 0, J1 - 1, 0.7 + jh, 0, 0.12);
  for (let x = J0, i = 0; x < J1 - 0.5; x += jbay, i++) {
    const x1 = Math.min(J1, x + jbay), top = 0.7 + jh * (x1 > J1 - 1 ? 0.4 : 1);
    bar(P.gold, x, 0.7, -jb, x, 0.7, jb, 0.05);
    bar(P.gold, i % 2 ? x : x1, 0.7, -jb, i % 2 ? x1 : x, top, 0, 0.05);
    bar(P.gold, i % 2 ? x : x1, 0.7, jb, i % 2 ? x1 : x, top, 0, 0.05);
  }
  box(P.goldGlow, 0.2, 0.2, 0.2, J1, 0.9, 0); // jib tip light
  // Counter-jib with its concrete counterweights.
  const K = -C.counter;
  bar(P.slate, -hs, 0.7, -0.7, K, 0.7, -0.7, 0.14);
  bar(P.slate, -hs, 0.7, 0.7, K, 0.7, 0.7, 0.14);
  for (let x = -hs; x > K; x -= 1.4) bar(P.slate, x, 0.7, -0.7, x, 0.7, 0.7, 0.06);
  box(P.navy, -K - hs, 0.05, 1.3, (K - hs) / 2, 0.8, 0); // walkway
  for (let i = 0; i < 3; i++) box(P.slate, 0.7, 1.7, 1.8, K + 0.45 + i * 0.75, 0.05, 0);
  // Pendant ties from the apex.
  bar(P.slate, 0, apex, 0, C.jib * 0.62, 0.7 + jh, 0, 0.05);
  bar(P.slate, 0, apex, 0, K + 0.4, 0.75, -0.7, 0.05);
  bar(P.slate, 0, apex, 0, K + 0.4, 0.75, 0.7, 0.05);
  // Trolley and hook: the hook hangs from a pivot so it can sway.
  const TX = 12, drop = 5.2;
  box(P.slate, 1.0, 0.35, 1.4, TX, 0.5, 0);
  const hookPivot = new THREE.Group();
  hookPivot.position.set(TX, 0.4, 0);
  craneTop.add(hookPivot);
  into = hook;
  place();
  bar(P.slate, -0.15, 0, 0, -0.15, -drop, 0, 0.035);
  bar(P.slate, 0.15, 0, 0, 0.15, -drop, 0, 0.035);
  box(P.gold, 0.55, 0.7, 0.35, 0, -drop - 0.3, 0); // hook block
  bar(P.slate, 0, -drop - 0.65, 0, 0, -drop - 2.2, -2, 0.03); // slings to the beam ends
  bar(P.slate, 0, -drop - 0.65, 0, 0, -drop - 2.2, 2, 0.03);
  const iBeam = (mat: THREE.Material, len: number, x: number, y: number, z: number, ry = 0, sz = 0.36) => {
    box(mat, len, 0.035, sz, x, y + sz - 0.02, z, ry); // flanges
    box(mat, len, 0.035, sz, x, y + 0.02, z, ry);
    box(mat, len, sz, 0.03, x, y + sz / 2, z, ry); // web
  };
  iBeam(P.gold, 6.5, 0, -drop - 2.6, 0, Math.PI / 2); // the next beam, about to land on the top floor
  into = statics;

  // ---- the yard: fence, lamps, materials, plant, site office ----
  place();
  {
    const F = FENCE, panel = 3.4;
    const run = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / panel), ry = -Math.atan2(bz - az, bx - ax);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        box(P.slate, len / n - 0.08, 1.9, 0.07, x, 1.05, z, ry);
        box(P.navy, 0.5, 0.14, 0.7, ax + (bx - ax) * (i / n), 0.07, az + (bz - az) * (i / n), ry); // feet
      }
      for (let i = 0; i <= n; i++) box(P.navy, 0.1, 2.2, 0.1, ax + (bx - ax) * (i / n), 1.1, az + (bz - az) * (i / n), ry);
    };
    run(F.x0, F.z0, F.x1, F.z0);
    run(F.x1, F.z0, F.x1, F.z1);
    run(F.x1, F.z1, F.gate, F.z1);
    run(-F.gate, F.z1, F.x0, F.z1);
    run(F.x0, F.z1, F.x0, F.z0);
    for (const x of [-F.gate, F.gate]) for (let k = 0; k < 4; k++) box(k % 2 ? P.clay : P.orange, 0.16, 0.55, 0.16, x, 0.3 + k * 0.55, F.z1);
    for (const [x, z] of [[-2.2, 15.5], [-0.7, 15.9], [0.8, 15.6], [2.3, 15.8]]) {
      m4.compose(pv.set(x, 0.37, z), q.identity(), sv.set(0.26, 0.7, 0.26));
      put(P.orange, CONE);
      box(P.slate, 0.5, 0.05, 0.5, x, 0.025, z);
    }
  }
  // Lamp posts (their heads glow; three carry real lights).
  const LAMPS: [number, number, number][] = [[-21.5, -14.5, 0.8], [19.5, -14.5, 2.4], [19.5, 14.5, -2.4], [-21.5, 14.5, -0.8]];
  const LH = 7.5;
  for (const [x, z, ry] of LAMPS) {
    place(x, 0, z, ry);
    box(P.clay, 0.6, 0.3, 0.6, 0, 0.15, 0);
    bar(P.slate, 0, 0.3, 0, 0, LH, 0, 0.18, true);
    bar(P.slate, 0, LH - 0.1, 0, 1.2, LH, 0, 0.1);
    box(P.slate, 0.8, 0.18, 0.45, 1.3, LH - 0.05, 0);
    box(P.goldGlow, 0.65, 0.05, 0.32, 1.3, LH - 0.16, 0);
  }
  // Stacked steel beams on timber bearers, by the crane.
  place(-19.5, 0, -6.5, Math.PI / 2 + 0.1);
  for (const x of [-2.8, 0, 2.8]) box(P.rebar, 0.2, 0.18, 3.4, x, 0.09, 0);
  for (let l = 0; l < (low ? 2 : 3); l++) for (let i = 0; i < 4; i++) iBeam(P.slate, 8, 0, 0.18 + l * 0.42, -1.2 + i * 0.8 + (l % 2) * 0.2);
  // Rebar bundles.
  place(-10.5, 0, -12.5, 0.15);
  {
    const ring = low ? [[0, 0], ...hex(1)] : [[0, 0], ...hex(1), ...hex(2)];
    for (let b = 0; b < 3; b++) {
      for (const x of [-2, 0, 2]) box(P.rebar, 0.12, 0.12, 0.5, x, 0.06, b * 0.9);
      for (const [u, v] of ring) bar(P.rebar, -3, 0.25 + v * 0.06, b * 0.9 + u * 0.06, 3, 0.25 + v * 0.06, b * 0.9 + u * 0.06, 0.05, true);
    }
  }
  // Pallets of blocks.
  for (const [x, z, ry, h] of [[12.5, -12.5, 0.1, 1], [14.2, -12.3, 0.05, 0.7], [12.7, -10.6, -0.08, 0.85], [16.2, -12.6, 0.2, 1]] as const) {
    place(x, 0, z, ry);
    box(P.rebar, 1.2, 0.15, 1.0, 0, 0.075, 0);
    box(P.clay, 1.1, h * 0.9, 0.95, 0, 0.15 + h * 0.45, 0);
    box(P.navy, 1.12, 0.03, 0.97, 0, 0.15 + h * 0.6, 0); // banding strap
  }
  // Excavator, parked facing the building.
  place(-5.5, 0, 11.5, -0.55);
  for (const z of [-1.1, 1.1]) {
    box(P.navy, 4.0, 0.8, 0.7, 0, 0.42, z);
    for (const x of [-2, 2]) bar(P.navy, x, 0.42, z - 0.35, x, 0.42, z + 0.35, 0.8, true); // rounded track ends
  }
  box(P.slate, 1.6, 0.35, 1.6, 0, 0.98, 0);
  box(P.clay, 3.1, 1.1, 2.5, -0.3, 1.7, 0);
  box(P.clay, 0.9, 1.25, 2.5, -1.85, 1.8, 0);
  box(P.clay, 1.2, 1.4, 1.0, 0.6, 2.95, 0.72);
  box(P.glass, 0.05, 1.0, 0.85, 1.22, 3.0, 0.72);
  bar(P.slate, 1.0, 1.9, -0.2, 3.4, 4.5, -0.2, 0.42);
  bar(P.slate, 3.4, 4.5, -0.2, 4.6, 1.6, -0.2, 0.32);
  box(P.slate, 0.9, 0.7, 1.1, 4.7, 1.0, -0.2, 0, 0.5);
  // Flatbed truck with a few beams on the back.
  place(15.5, 0, 9.5, -1.95);
  box(P.navy, 7.6, 0.35, 1.6, 0, 0.8, 0);
  box(P.clay, 2.0, 2.2, 2.4, 2.9, 2.0, 0);
  box(P.glass, 0.05, 0.9, 2.1, 3.92, 2.5, 0);
  box(P.slate, 5.2, 0.25, 2.5, -1.1, 1.1, 0);
  for (const x of [-3, -1.6, 2.7]) for (const z of [-1.1, 1.1]) bar(P.navy, x, 0.5, z - 0.18, x, 0.5, z + 0.18, 1.0, true);
  for (let i = 0; i < 3; i++) iBeam(P.slate, 5, -1.1, 1.25, -0.8 + i * 0.8, 0, 0.3);
  // Site office cabin by the gate, its window still lit.
  place(-12, 0, 15.2, 0);
  for (const x of [-2.6, 2.6]) box(P.navy, 0.3, 0.3, 2.2, x, 0.15, 0);
  box(P.clay, 6.2, 2.6, 2.5, 0, 1.6, 0);
  box(P.slate, 6.4, 0.12, 2.7, 0, 2.95, 0);
  box(P.goldGlow, 1.7, 0.85, 0.04, 1.1, 1.85, 1.27);
  box(P.navy, 0.9, 2.0, 0.04, -1.6, 1.3, 1.27);
  place();

  const BLOBS: [number, number, number, number][] = [ // x, z, width, depth: soft dark patches under things
    [0, 0, 27, 21], [C.x, C.z, 8, 8], [-5.5, 11.5, 7.5, 5.5], [15.5, 9.5, 9, 5], [-12, 15.2, 8.5, 4.5], [-19.5, -6.5, 5, 10], [-10.5, -11.8, 8, 4.5], [14.3, -11.8, 6, 4],
  ];
  const blobs: THREE.BufferGeometry[] = [], pools: THREE.BufferGeometry[] = [];
  for (const [x, z, w, d] of BLOBS) blobs.push(PLANE.clone().applyMatrix4(m4.compose(pv.set(x, 0.03, z), q.identity(), sv.set(w, 1, d))));
  // Warm pools of light on the gravel under each lamp and outside the lit cabin window (painted, not computed).
  for (const [x, z, ry] of LAMPS) pools.push(PLANE.clone().applyMatrix4(m4.compose(pv.set(x + Math.cos(ry) * 1.6, 0.05, z - Math.sin(ry) * 1.6), q.identity(), sv.set(15, 1, 15))));
  pools.push(PLANE.clone().applyMatrix4(m4.compose(pv.set(-10.9, 0.05, 17.2), q.identity(), sv.set(5, 1, 3.5))));

  // ---- merge every batch into one mesh per material ----
  const scene = new THREE.Scene();
  const merge = (batch: Batch, into: THREE.Object3D) => {
    for (const [mat, list] of batch) {
      const g = mergeGeometries(list);
      list.forEach((x) => x.dispose());
      owned.push(g);
      into.add(new THREE.Mesh(g, mat));
    }
  };
  merge(statics, scene);
  merge(crane, craneTop);
  merge(hook, hookPivot);
  scene.add(craneTop);
  [BOX, TUBE, CONE].forEach((g) => g.dispose());

  // Ground: gravel that fades into the night at the edge (alpha), so the page's sky shows beyond.
  const gravel = canvasTexture(256, (g, s) => {
    g.fillStyle = '#8a8a8a';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) {
      const v = 90 + Math.floor(rand() * 90);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rand() * s, rand() * s, 1 + rand() * 2, 1 + rand() * 2);
    }
  });
  gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping;
  gravel.repeat.set(14, 14);
  gravel.colorSpace = THREE.SRGBColorSpace;
  gravel.anisotropy = 4;
  const fade = radial([[0, '#fff'], [0.55, '#fff'], [0.78, '#777'], [1, '#000']]);
  const groundMat = new THREE.MeshStandardMaterial({ color: COLOURS.slate, map: gravel, alphaMap: fade, transparent: true, depthWrite: false, roughness: 0.95 });
  const groundGeo = new THREE.CircleGeometry(48, 64).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.renderOrder = -2;
  scene.add(ground);
  const blobTex = radial([[0, '#fff'], [0.45, '#bbb'], [1, '#000']]);
  const blobMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLOURS.navy).multiplyScalar(0.25), alphaMap: blobTex, transparent: true, opacity: 0.75, depthWrite: false });
  const blobGeo = mergeGeometries(blobs);
  blobs.forEach((b) => b.dispose());
  PLANE.dispose();
  const blobMesh = new THREE.Mesh(blobGeo, blobMat);
  blobMesh.renderOrder = -1;
  scene.add(blobMesh);
  const poolMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLOURS.gold).multiplyScalar(0.32), map: blobTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const poolGeo = mergeGeometries(pools);
  pools.forEach((b) => b.dispose());
  const poolMesh = new THREE.Mesh(poolGeo, poolMat);
  poolMesh.renderOrder = -1;
  scene.add(poolMesh);
  owned.push(gravel, fade, groundMat, groundGeo, blobTex, blobMat, blobGeo, poolMat, poolGeo);

  // ---- light: cool sky, warm moon, gold site lights; a tiny gradient sky for the metals to reflect ----
  const env = canvasTexture(64, (g, s) => {
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, '#262b38');
    grad.addColorStop(0.42, '#4a4c56');
    grad.addColorStop(0.5, '#a88a58');
    grad.addColorStop(0.58, '#2a2a30');
    grad.addColorStop(1, '#121419');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
  env.mapping = THREE.EquirectangularReflectionMapping;
  env.colorSpace = THREE.SRGBColorSpace;
  scene.environment = env;
  scene.environmentIntensity = 0.5;
  owned.push(env);
  scene.add(new THREE.HemisphereLight(0xb9c8f0, COLOURS.navy, 0.75));
  const moon = new THREE.DirectionalLight(0xffe9c8, 0.95);
  moon.position.set(-30, 40, 22);
  scene.add(moon);
  const fill = new THREE.DirectionalLight(0x9fb8d8, 0.35);
  fill.position.set(30, 18, -25);
  scene.add(fill);

  const warm = new THREE.Color(COLOURS.gold).lerp(new THREE.Color(0xffffff), 0.25);
  const lit = LAMPS.slice(0, low ? 2 : 4).map(([x, z, ry]) => {
    const l = new THREE.PointLight(warm, 160, 28, 1.7);
    l.position.set(x + Math.cos(ry) * 1.3, LH - 0.6, z - Math.sin(ry) * 1.3);
    scene.add(l);
    return l;
  });
  const base = lit.map((l) => l.intensity);

  // Halos round every glowing light (sprites; their opacity breathes with the flicker). Not Points: large
  // point sprites cost ANGLE/D3D11 (Windows) a frame-rate collapse.
  const haloAt: [number, number, number][] = [
    ...LAMPS.map(([x, z, ry]) => [x + Math.cos(ry) * 1.3, LH - 0.2, z - Math.sin(ry) * 1.3] as [number, number, number]),
    [-10.9, 1.85, 16.5],
  ];
  const haloTex = radial([[0, 'rgba(255,255,255,0.9)'], [0.18, 'rgba(255,255,255,0.35)'], [0.5, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
  const halos = haloAt.map(([x, y, z], i) => {
    const m = new THREE.SpriteMaterial({ color: COLOURS.gold, map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const h = new THREE.Sprite(m);
    h.position.set(x, y, z);
    h.scale.setScalar(i < LAMPS.length ? 6 : 3.5);
    scene.add(h);
    owned.push(m);
    return m;
  });
  owned.push(haloTex);

  // Dust motes drifting in the lamp light.
  const MOTES = low ? 40 : high ? 110 : 80;
  const home = new Float32Array(MOTES * 4);
  for (let i = 0; i < MOTES; i++) home.set([(rand() - 0.5) * 40, 0.5 + rand() * 12, (rand() - 0.5) * 30, rand() * TAU], i * 4);
  const motePos = new THREE.Float32BufferAttribute(new Float32Array(MOTES * 3), 3);
  motePos.setUsage(THREE.DynamicDrawUsage);
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', motePos);
  const dot = radial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
  const moteMat = new THREE.PointsMaterial({ color: COLOURS.clay, size: 0.16, map: dot, transparent: true, opacity: 0.55, depthWrite: false });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  scene.add(motes);
  owned.push(moteGeo, dot, moteMat);

  scene.fog = new THREE.Fog(COLOURS.navy, 40, 120);
  const fog = scene.fog as THREE.Fog;

  // ---- camera: one slow orbit, rising a little, the look-at eased on top of the stage's damping ----
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 260);
  const look = new THREE.Vector3(), goal = new THREE.Vector3();
  const CX = -2.5, CZ = 0, A0 = 0.62; // orbit centre (between crane and building) and the starting angle
  let first = true;
  const ease = (x: number) => x * x * (3 - 2 * x);

  return {
    scene,
    camera,
    update(p, dt, t) {
      const a = A0 + p * TAU, rise = ease(p);
      // Distance that keeps crane and building framed at any aspect (phones sit further back).
      const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const dist = Math.max(21 / tv, 19.5 / (tv * camera.aspect));
      const elev = 0.3 + 0.07 * rise; // radians above the horizon: the slow rise
      const r = dist * Math.cos(elev);
      camera.position.set(CX + Math.cos(a) * r, 9 + dist * Math.sin(elev), CZ + Math.sin(a) * r);
      goal.set(CX + Math.cos(a + 1.3) * 1.5, 13.5 + rise, CZ + Math.sin(a + 1.3) * 1.5);
      if (first) { look.copy(goal); first = false; }
      else look.lerp(goal, 1 - Math.exp(-1.6 * dt));
      camera.lookAt(look);
      fog.near = dist - 6;
      fog.far = dist + 70;

      // Ambient: the crane slews a few degrees, the hook sways, the lights breathe, the dust drifts.
      craneTop.rotation.y = 0.05 + Math.sin(t * TAU / 46) * 0.07;
      hookPivot.rotation.z = Math.sin(t * TAU / 9.5) * 0.014;
      hookPivot.rotation.x = Math.sin(t * TAU / 13.7 + 1) * 0.01;
      for (let i = 0; i < lit.length; i++) lit[i].intensity = base[i] * (1 + 0.05 * Math.sin(t * TAU / (7 + i * 1.7) + i) + 0.025 * Math.sin(t * TAU / 11.3 + i * 2));
      for (let i = 0; i < halos.length; i++) halos[i].opacity = 0.85 + 0.08 * Math.sin(t * TAU / (7 + i * 1.7) + i);
      for (let i = 0; i < MOTES; i++) {
        const k = i * 4, ph = home[k + 3];
        motePos.setXYZ(i, home[k] + Math.sin(t * 0.07 + ph) * 1.2, home[k + 1] + Math.sin(t * 0.11 + ph * 2) * 0.8, home[k + 2] + Math.cos(t * 0.06 + ph) * 1.2);
      }
      motePos.needsUpdate = true;
    },
    idle: () => false,
    dispose() { owned.forEach((o) => o.dispose()); },
  };
};

// Hexagonal ring n of a bundle of round bars (unit spacing).
function hex(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < 6 * n; k++) {
    const side = Math.floor(k / n), step = k % n, a0 = side * Math.PI / 3, a1 = a0 + Math.PI / 3;
    out.push([n * Math.cos(a0) + step * (Math.cos(a1) - Math.cos(a0)), n * Math.sin(a0) + step * (Math.sin(a1) - Math.sin(a0))]);
  }
  return out;
}

export default site;
