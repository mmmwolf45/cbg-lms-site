// Shared helpers for the BIM, MEP and Interior course scenes (course-b-*): easing, lights, the soft blob
// shadow, progressive gold line drawing, canvas screens, a code-built monitor/laptop and camera framing.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Kit } from '../../types';
import type { Palette } from '../../palette';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// Quintic smootherstep: zero velocity and acceleration at both ends, so nothing ever starts or stops abruptly.
export const ease = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Props another agent exports to public/three (see CATALOG.md). Only names listed here are fetched, so a
// missing file never costs a request or a console 404; the code-built fallback is used instead.
const READY_GLB = new Set<string>(['monitor', 'laptop', 'sofa', 'armchair', 'coffee-table', 'floor-lamp', 'plant', 'rug-rect', 'side-table']);
export async function loadProp(kit: Kit, name: string): Promise<THREE.Object3D | null> {
  if (!READY_GLB.has(name)) return null;
  try { return (await kit.loadGLB(name)).scene; } catch { return null; }
}

// Night lighting per the README: cool sky / navy ground, one warm moonlight, optional gold point lights.
export function addLights(scene: THREE.Object3D, sky = 0.8, moon = 1.3) {
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x0f1b33, sky));
  const sun = new THREE.DirectionalLight(0xfff1d6, moon);
  sun.position.set(-4.5, 6.5, 3.5);
  scene.add(sun);
  return sun;
}

// A soft dark ellipse under a model instead of real-time shadows.
export function blobShadow(w: number, d: number, opacity = 0.6) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(3,8,20,1)');
  grad.addColorStop(0.55, 'rgba(3,8,20,0.55)');
  grad.addColorStop(1, 'rgba(3,8,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return { mesh, mat, dispose: () => { tex.dispose(); mat.dispose(); mesh.geometry.dispose(); } };
}

// Gold lines that draw themselves: segments are cut into short steps (STEP long) and revealed in order with
// the draw range, so the pen moves continuously and the vertex buffer is never rewritten (buffer uploads
// every frame stall the composer on ANGLE/D3D11). set(t) allocates nothing.
const STEP = 0.025;
export class LineDraw {
  readonly lines: THREE.LineSegments;
  private n: number;
  constructor(segments: number[], material: THREE.Material) {
    const out: number[] = [];
    for (let o = 0; o < segments.length; o += 6) {
      const [ax, ay, az, bx, by, bz] = segments.slice(o, o + 6);
      const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / STEP));
      for (let i = 0; i < k; i++) {
        const f0 = i / k, f1 = (i + 1) / k;
        out.push(ax + (bx - ax) * f0, ay + (by - ay) * f0, az + (bz - az) * f0, ax + (bx - ax) * f1, ay + (by - ay) * f1, az + (bz - az) * f1);
      }
    }
    this.n = out.length / 6;
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    geo.computeBoundingSphere();
    this.lines = new THREE.LineSegments(geo, material);
    this.lines.frustumCulled = false;
  }
  set(t: number) {
    const k = Math.round(clamp01(t) * this.n);
    this.lines.geometry.setDrawRange(0, k * 2);
    this.lines.visible = k > 0;
  }
  dispose() { this.lines.geometry.dispose(); }
}

// Segment helpers for LineDraw/LineSegments inputs.
export function rectXZ(out: number[], x0: number, z0: number, x1: number, z1: number, y: number) {
  out.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
}
export function circleXZ(out: number[], cx: number, cz: number, r: number, y: number, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2;
    out.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, cx + Math.cos(b) * r, y, cz + Math.sin(b) * r);
  }
}
// Edges of an axis-aligned box (12 segments).
export function boxEdges(out: number[], cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  rectXZ(out, x0, z0, x1, z1, y0);
  rectXZ(out, x0, z0, x1, z1, y1);
  out.push(x0, y0, z0, x0, y1, z0, x1, y0, z0, x1, y1, z0, x1, y0, z1, x1, y1, z1, x0, y0, z1, x0, y1, z1);
}

// A 2D canvas wrapped as a texture, for screens. Draw with ctx, then set tex.needsUpdate = true.
// willReadFrequently keeps the canvas CPU-backed: uploading a GPU-accelerated canvas held the frame rate at
// ~19 fps on ANGLE/D3D11 for as long as the scene ran.
export function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx, tex };
}
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
export const hex = (c: number | THREE.Color) => '#' + (typeof c === 'number' ? new THREE.Color(c) : c).getHexString();

// Software-window chrome drawn on a screen canvas: navy body, title bar, a side panel. Returns the panel
// width so callers can place their own rows.
export function drawChrome(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, tabs: string[], panel = 230) {
  ctx.fillStyle = '#0a1426'; ctx.fillRect(0, 0, w, h);
  // viewport: soft vertical gradient so the model sits in a lit "space"
  const g = ctx.createLinearGradient(0, 44, 0, h);
  g.addColorStop(0, '#16284a'); g.addColorStop(1, '#0c1830');
  ctx.fillStyle = g; ctx.fillRect(panel, 44, w - panel, h - 44 - 28);
  ctx.fillStyle = '#111f3b'; ctx.fillRect(0, 0, w, 44);
  ctx.fillStyle = '#0e1a33'; ctx.fillRect(0, 44, panel, h - 44);
  ctx.fillStyle = '#0e1a33'; ctx.fillRect(panel, h - 28, w - panel, 28);
  ctx.fillStyle = 'rgba(214,177,96,0.9)';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 18, 22);
  let x = 18 + ctx.measureText(title).width + 34;
  ctx.font = '500 15px system-ui, sans-serif';
  tabs.forEach((t, i) => {
    const tw = ctx.measureText(t).width + 26;
    if (i === 0) { ctx.fillStyle = '#1d3260'; roundRect(ctx, x - 13, 9, tw, 26, 6); ctx.fill(); }
    ctx.fillStyle = i === 0 ? '#e9e2d4' : 'rgba(233,226,212,0.55)';
    ctx.fillText(t, x, 22);
    x += tw + 8;
  });
  return panel;
}
// One legend row: swatch, label, optional "eye" dot on the right.
export function legendRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, colour: string, label: string, active = false) {
  if (active) { ctx.fillStyle = 'rgba(214,177,96,0.14)'; roundRect(ctx, x - 8, y - 17, w, 34, 7); ctx.fill(); }
  ctx.fillStyle = colour; roundRect(ctx, x, y - 8, 16, 16, 4); ctx.fill();
  ctx.fillStyle = active ? '#f3ecdc' : 'rgba(233,226,212,0.78)';
  ctx.font = `${active ? 600 : 500} 16px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 28, y + 1);
  ctx.strokeStyle = active ? 'rgba(214,177,96,0.95)' : 'rgba(233,226,212,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + w - 30, y, 5, 0, Math.PI * 2); ctx.stroke();
}

// Screen material: unlit, not tone-mapped (reads like an emissive display), kept below the bloom threshold.
export function screenMaterial(map: THREE.Texture) {
  return new THREE.MeshBasicMaterial({ map, color: new THREE.Color(0.92, 0.92, 0.92), toneMapped: false });
}

// A desk monitor or an open laptop, code-built from palette swatches (a GLB replaces it when the catalogue
// has one). The screen faces +Z; origin at the bottom centre of the stand/base.
export function buildDevice(palette: Palette, kind: 'monitor' | 'laptop', screen: THREE.Material, width = 1.6) {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const gold: number[] = [];
  let sw: number, sh: number;
  const lid = new THREE.Group();
  if (kind === 'monitor') {
    sw = width; sh = width * 0.6;
    const bezel = new RoundedBoxGeometry(sw + 0.08, sh + 0.08, 0.06, 2, 0.025);
    bezel.translate(0, 0.42 + sh / 2, 0);
    const back = new RoundedBoxGeometry(sw * 0.5, sh * 0.45, 0.08, 2, 0.03);
    back.translate(0, 0.42 + sh / 2, -0.05);
    const neck = new THREE.BoxGeometry(0.09, 0.5, 0.05);
    neck.translate(0, 0.27, -0.08);
    const foot = new RoundedBoxGeometry(width * 0.34, 0.035, width * 0.2, 2, 0.015);
    foot.translate(0, 0.0175, -0.04);
    geos.push(bezel, back, neck.toNonIndexed(), foot);
    neck.dispose();
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screen);
    scr.position.set(0, 0.42 + sh / 2, 0.032);
    scr.name = 'screen';
    group.add(scr);
    const y0 = 0.42 - 0.04, y1 = 0.42 + sh + 0.04, x = sw / 2 + 0.04, z = 0.033;
    gold.push(-x, y0, z, x, y0, z, x, y0, z, x, y1, z, x, y1, z, -x, y1, z, -x, y1, z, -x, y0, z);
  } else {
    sw = width * 0.9; sh = sw * 0.62;
    const base = new RoundedBoxGeometry(width, 0.05, width * 0.66, 2, 0.02);
    base.translate(0, 0.025, 0);
    geos.push(base);
    const lidBox = new RoundedBoxGeometry(width, sh + 0.1, 0.035, 2, 0.015);
    lidBox.translate(0, (sh + 0.1) / 2, -0.018);
    const lidMesh = new THREE.Mesh(lidBox, palette.navy);
    lid.add(lidMesh);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screen);
    scr.position.set(0, (sh + 0.1) / 2, 0.001);
    scr.name = 'screen';
    lid.add(scr);
    const lg: number[] = [];
    const x = width / 2, y1 = sh + 0.1;
    lg.push(-x, 0, 0.002, -x, y1, 0.002, -x, y1, 0.002, x, y1, 0.002, x, y1, 0.002, x, 0, 0.002);
    const lidLine = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lg, 3)), palette.goldLine);
    lid.add(lidLine);
    lid.position.set(0, 0.05, -width * 0.33);
    lid.rotation.x = -0.32;
    group.add(lid);
    // keyboard deck and trackpad as a slightly darker inset
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.86, width * 0.3), palette.navy);
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(0, 0.051, -width * 0.1);
    group.add(deck);
    const z = width * 0.33;
    gold.push(-width / 2, 0.05, z, width / 2, 0.05, z);
  }
  const body = new THREE.Mesh(mergeGeometries(geos)!, kind === 'monitor' ? palette.navy : palette.slate);
  geos.forEach((g) => g.dispose());
  group.add(body);
  const line = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gold, 3)), palette.goldLine);
  group.add(line);
  return {
    group, lid,
    dispose: () => group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }),
  };
}

// Keep a composition of half-size (hw, hh) around `target` in frame for the camera's current aspect.
// dir: unit vector from target to camera. Allocates nothing.
const _v = new THREE.Vector3();
export function frame(camera: THREE.PerspectiveCamera, target: THREE.Vector3, dir: THREE.Vector3, hw: number, hh: number) {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const d = Math.max(hh / t, hw / (t * Math.max(camera.aspect, 0.3)));
  camera.position.copy(_v.copy(dir).multiplyScalar(d).add(target));
  camera.lookAt(target);
}

// Dispose every geometry under a root (palette materials are shared and stay).
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
}

// Many pieces of one shape and material (walls, columns, ducts...) in ONE draw call, each growing in along
// a local axis between t0..t1 and retracting between e0..e1. `level` picks a vertical offset from the
// array passed to update (for exploded floors). Unit geometry: a 1x1x1 box or a radius 0.5, height 1 cylinder.
// The growth runs in the vertex shader from one progress uniform: instance buffers are written once, never
// per frame (per-frame instance uploads stalled the MSAA composer on ANGLE/D3D11: 60 -> 19 fps).
// The material is patched in place, so pass a scene-owned clone, used only by Grow meshes.
export interface Piece {
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  grow: 'x' | 'y' | 'z' | 'xz' | 'all';
  from?: -1 | 0; // -1 grows out of the piece's min side along the axis, 0 from its centre
  t0: number; t1: number; e0: number; e1: number;
  level?: number;
  rx?: number; ry?: number; rz?: number;
}
type GrowUniforms = { uP: { value: number }; uLevels: { value: Float32Array } };
const GROW_GLSL = `
attribute vec4 aTime;
attribute vec4 aAxis;
attribute float aLevel;
uniform float uP;
uniform float uLevels[4];
float growEase(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
`;
function patchGrow(mat: THREE.Material): GrowUniforms {
  if (mat.userData.grow) return mat.userData.grow as GrowUniforms;
  const u: GrowUniforms = { uP: { value: 0 }, uLevels: { value: new Float32Array(4) } };
  mat.userData.grow = u;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uP = u.uP;
    sh.uniforms.uLevels = u.uLevels;
    sh.vertexShader = GROW_GLSL + sh.vertexShader
      .replace('#include <begin_vertex>', `
        float gGrow = max(1e-4, growEase(aTime.x, aTime.y, uP) * (1.0 - growEase(aTime.z, aTime.w, uP)));
        vec3 g3 = mix(vec3(min(1.0, gGrow * 5.0)), vec3(gGrow), aAxis.xyz);
        vec3 transformed = position * g3 - 0.5 * (1.0 - g3) * aAxis.xyz * aAxis.w;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
        int li = int(aLevel + 0.5);
        mvPosition.y += li == 1 ? uLevels[1] : li == 2 ? uLevels[2] : li == 3 ? uLevels[3] : uLevels[0];
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'course-b-grow';
  return u;
}
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export class Grow {
  readonly mesh: THREE.InstancedMesh;
  private u: GrowUniforms;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, readonly pieces: Piece[]) {
    const g = geo.clone(); // own copy: carries the per-instance attributes
    const n = pieces.length, time = new Float32Array(n * 4), axis = new Float32Array(n * 4), level = new Float32Array(n);
    pieces.forEach((c, i) => {
      time.set([c.t0, c.t1, c.e0, c.e1], i * 4);
      const gx = c.grow === 'x' || c.grow === 'xz' || c.grow === 'all', gy = c.grow === 'y' || c.grow === 'all', gz = c.grow === 'z' || c.grow === 'xz' || c.grow === 'all';
      axis.set([+gx, +gy, +gz, c.from === -1 ? 1 : 0], i * 4);
      level[i] = c.level ?? 0;
    });
    g.setAttribute('aTime', new THREE.InstancedBufferAttribute(time, 4));
    g.setAttribute('aAxis', new THREE.InstancedBufferAttribute(axis, 4));
    g.setAttribute('aLevel', new THREE.InstancedBufferAttribute(level, 1));
    this.u = patchGrow(mat);
    this.mesh = new THREE.InstancedMesh(g, mat, n);
    this.mesh.frustumCulled = false;
    growOf.set(this.mesh, this);
    pieces.forEach((c, i) => {
      _q.setFromEuler(_e.set(c.rx ?? 0, c.ry ?? 0, c.rz ?? 0));
      this.mesh.setMatrixAt(i, _m.compose(_p.set(c.x, c.y, c.z), _q, _s.set(c.sx, c.sy, c.sz)));
    });
  }
  update(p: number, levels?: ArrayLike<number>) {
    this.u.uP.value = p;
    if (levels) for (let i = 0; i < 4; i++) this.u.uLevels.value[i] = levels[i] ?? 0;
  }
  // Mesh-local bounds of the pieces at progress p (for framing; runs on resize, not per frame).
  boundsAt(p: number, levels: ArrayLike<number> | undefined, out: THREE.Box3) {
    out.makeEmpty();
    const b = new THREE.Box3(), unit = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
    for (const c of this.pieces) {
      const g = ease(c.t0, c.t1, p) * (1 - ease(c.e0, c.e1, p));
      if (g < 0.01) continue;
      _q.setFromEuler(_e.set(c.rx ?? 0, c.ry ?? 0, c.rz ?? 0));
      _p.set(c.x, c.y + (levels && c.level !== undefined ? levels[c.level] : 0), c.z);
      out.union(b.copy(unit).applyMatrix4(_m.compose(_p, _q, _s.set(c.sx, c.sy, c.sz))));
    }
    return out;
  }
  dispose() { this.mesh.geometry.dispose(); this.mesh.dispose(); }
}

// The catalogue monitor/laptop when available (scaled to `width`), else the code-built one. The GLB screen is
// a 4-vertex quad without UVs: UVs are generated from its x/y extent so a screen texture maps the full face.
export async function loadDevice(kit: Kit, kind: 'monitor' | 'laptop', screen: THREE.Material, width: number) {
  const glb = await loadProp(kit, kind);
  const scr = glb?.getObjectByName('screen') as THREE.Mesh | undefined;
  if (!glb || !scr?.isMesh) return buildDevice(kit.palette, kind, screen, width);
  const group = new THREE.Group();
  const size = new THREE.Box3().setFromObject(glb).getSize(new THREE.Vector3());
  glb.scale.setScalar(width / size.x);
  group.add(glb);
  const g = scr.geometry.clone();
  g.computeBoundingBox();
  const b = g.boundingBox!, pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - b.min.x) / (b.max.x - b.min.x);
    uv[i * 2 + 1] = (pos.getY(i) - b.min.y) / (b.max.y - b.min.y);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  scr.geometry = g;
  scr.material = screen;
  scr.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), kit.palette.goldLine));
  return { group, lid: group, dispose: () => disposeTree(group) };
}

// Frame a set of world-space points: the camera looks along -dir at them, at the distance where every point
// sits inside the view with `margin` (fraction of the width/height) on each side, re-centred on the projected
// extent. Runs on resize only (it allocates a little).
export function fitPoints(camera: THREE.PerspectiveCamera, dir: THREE.Vector3, pts: THREE.Vector3[], margin = 0.08) {
  const target = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
  const lim = 1 - 2 * margin, v = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const place = (d: number) => {
    camera.position.copy(dir).multiplyScalar(d).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  };
  const bounds = () => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      v.copy(p).applyMatrix4(camera.matrixWorldInverse);
      if (v.z > -camera.near) return null; // behind or too close
      v.applyMatrix4(camera.projectionMatrix);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    return [x0, x1, y0, y1];
  };
  let d = 10;
  for (let pass = 0; pass < 3; pass++) {
    let lo = 0.2, hi = 200;
    for (let i = 0; i < 40; i++) {
      d = (lo + hi) / 2;
      place(d);
      const b = bounds();
      if (!b || Math.max(-b[0], b[1], -b[2], b[3]) > lim) lo = d; else hi = d;
    }
    d = hi;
    place(d);
    const b = bounds();
    if (!b) break;
    const h = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * d;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, ((b[0] + b[1]) / 2) * h * camera.aspect).addScaledVector(up, ((b[2] + b[3]) / 2) * h);
  }
  place(d);
}

// Grow meshes report their bounds from the pose being measured (set via measureState before measure()).
const growOf = new WeakMap<THREE.Object3D, Grow>();
const growState: { p: number; levels?: ArrayLike<number> } = { p: 0.5 };
export function measureState(p: number, levels?: ArrayLike<number>) { growState.p = p; growState.levels = levels; }

// Collects the world-space corners of every visible drawable's bounds under root (instanced meshes are
// re-measured from their current instances), for fitPoints. `skip` (e.g. the soft shadow) is ignored.
export function measure(root: THREE.Object3D, pts: THREE.Vector3[], skip?: THREE.Object3D) {
  root.updateMatrixWorld(true);
  root.traverseVisible((o) => {
    if (o === skip || o.parent === skip) return;
    const m = o as THREE.Mesh;
    if (!m.geometry) return;
    let bb: THREE.Box3 | null;
    const grow = growOf.get(o);
    if (grow) bb = grow.boundsAt(growState.p, growState.levels, new THREE.Box3());
    else if ((o as THREE.InstancedMesh).isInstancedMesh) { (o as THREE.InstancedMesh).computeBoundingBox(); bb = (o as THREE.InstancedMesh).boundingBox; }
    else { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); bb = m.geometry.boundingBox; }
    if (!bb || bb.isEmpty()) return;
    for (let i = 0; i < 8; i++)
      pts.push(new THREE.Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld));
  });
}
