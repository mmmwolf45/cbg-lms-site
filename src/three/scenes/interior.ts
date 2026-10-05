// Interior design course: a room (floor, two walls, a window) draws itself in glowing gold edges and then
// materialises as solid surfaces; furniture (sofa, armchair, coffee table, floor lamp, plant, rug) is placed
// in, mock-up style. Through the action the room steps through three colour schemes with slow crossfades
// (walls, upholstery, rug), and a laptop beside it shows the design software: palettes and a plan view.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneFactory } from '../types';
import { COLOURS } from '../palette';
import {
  addLights, blobShadow, disposeTree, drawChrome, ease, fitPoints, hex, lerp, LineDraw, loadDevice, loadProp, makeCanvas,
  measure, rectXZ, roundRect, screenMaterial,
} from './lib/course-b-kit';

const RW = 4.6, RD = 3.6, WH = 2.6, WT = 0.12; // room width, depth, wall height, wall thickness
const WIN = { x0: -1.6, x1: -0.3, y0: 0.85, y1: 2.15 }; // window opening in the back wall

// Three schemes, every colour derived from palette swatches.
const mix = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const { clay, slate, navy, gold, rebar, glass } = COLOURS;
const SCHEMES = [
  { name: 'Clay and slate', wall: mix(clay, clay, 0), sofa: mix(slate, navy, 0.15), chair: mix(clay, gold, 0.45), rug: mix(navy, slate, 0.5) },
  { name: 'Terracotta', wall: mix(clay, rebar, 0.17), sofa: mix(rebar, clay, 0.1), chair: mix(clay, gold, 0.18), rug: mix(clay, gold, 0.32) },
  { name: 'Coastal', wall: mix(clay, glass, 0.45), sofa: mix(navy, slate, 0.4), chair: mix(glass, clay, 0.4), rug: mix(clay, glass, 0.3) },
] as const;
type Key = 'wall' | 'sofa' | 'chair' | 'rug';

const interior: SceneFactory = async (kit) => {
  const { palette } = kit;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  addLights(scene, 0.85, 1.2);
  const world = new THREE.Group(), room = new THREE.Group();
  world.add(room);
  scene.add(world);

  // Scene-owned materials: the scheme colours crossfade, and the shell fades in from its gold edges.
  const fabric = (c: THREE.Color) => { const m = palette.clay.clone(); m.color.copy(c); m.roughness = 0.92; return m; };
  const wallMat = fabric(SCHEMES[0].wall); wallMat.transparent = true;
  const FLOOR = mix(rebar, gold, 0.4).lerp(new THREE.Color(clay), 0.38);
  const floorMat = fabric(FLOOR); floorMat.transparent = true; floorMat.roughness = 0.7;
  const mats: Record<Key, THREE.MeshStandardMaterial> = { wall: wallMat, sofa: fabric(SCHEMES[0].sofa), chair: fabric(SCHEMES[0].chair), rug: fabric(SCHEMES[0].rug) };
  const owned = [wallMat, floorMat, mats.sofa, mats.chair, mats.rug];

  // ---- the shell: floor slab, back wall with a window opening, left wall ----
  const boxAt = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const bz0 = -RD / 2 - WT, bz1 = -RD / 2, lx0 = -RW / 2 - WT, lx1 = -RW / 2;
  const wallParts = [
    boxAt(lx0, WIN.x0, 0, WH, bz0, bz1), boxAt(WIN.x1, RW / 2, 0, WH, bz0, bz1),
    boxAt(WIN.x0, WIN.x1, 0, WIN.y0, bz0, bz1), boxAt(WIN.x0, WIN.x1, WIN.y1, WH, bz0, bz1),
    boxAt(lx0, lx1, 0, WH, bz1, RD / 2),
  ];
  const walls = new THREE.Mesh(mergeGeometries(wallParts)!, wallMat);
  wallParts.forEach((g) => g.dispose());
  walls.renderOrder = 1;
  const floor = new THREE.Mesh(boxAt(lx0, RW / 2 + 0.04, -0.14, 0, bz0, RD / 2 + 0.04), floorMat);
  const pane = new THREE.Mesh(boxAt(WIN.x0, WIN.x1, WIN.y0, WIN.y1, bz0 + 0.05, bz0 + 0.07), palette.glass);
  pane.renderOrder = 2;
  // a framed print on the left wall
  const art = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.7, 1.0), palette.navy);
  art.position.set(lx1 + 0.02, 1.55, 0.45);
  room.add(floor, walls, pane, art);

  // ---- gold edges: floor outline, corners, wall tops, skirting, window and picture frames ----
  const e: number[] = [];
  rectXZ(e, lx0, bz0, RW / 2 + 0.04, RD / 2 + 0.04, 0.002);
  e.push(lx1, 0, bz1, lx1, WH, bz1, RW / 2, 0, bz1, RW / 2, WH, bz1, lx1, 0, RD / 2, lx1, WH, RD / 2);
  e.push(lx1, WH, bz1, RW / 2, WH, bz1, lx1, WH, bz1, lx1, WH, RD / 2);
  e.push(lx0, WH, bz0, RW / 2, WH, bz0, lx0, WH, bz0, lx0, WH, RD / 2);
  const z = bz1 + 0.003, mx = (WIN.x0 + WIN.x1) / 2, my = (WIN.y0 + WIN.y1) / 2;
  e.push(WIN.x0, WIN.y0, z, WIN.x1, WIN.y0, z, WIN.x1, WIN.y0, z, WIN.x1, WIN.y1, z, WIN.x1, WIN.y1, z, WIN.x0, WIN.y1, z, WIN.x0, WIN.y1, z, WIN.x0, WIN.y0, z);
  e.push(mx, WIN.y0, z, mx, WIN.y1, z, WIN.x0, my, z, WIN.x1, my, z);
  const ax = lx1 + 0.04;
  e.push(ax, 1.2, -0.05, ax, 1.9, -0.05, ax, 1.9, -0.05, ax, 1.9, 0.95, ax, 1.9, 0.95, ax, 1.2, 0.95, ax, 1.2, 0.95, ax, 1.2, -0.05);
  const edges = new LineDraw(e, palette.goldLine);
  room.add(edges.lines);

  // ---- furniture from the catalogue (code-built stand-ins if a model is missing) ----
  type Item = { holder: THREE.Group; y: number; t0: number; e0: number };
  const items: Item[] = [];
  const place = async (name: string, x: number, zz: number, ry: number, scale: number, remap: Partial<Record<string, THREE.Material>>, fallback: [number, number, number], t0: number) => {
    let obj = await loadProp(kit, name);
    if (obj) {
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const hit = (Object.keys(remap) as (keyof typeof palette)[]).find((k) => m.material === palette[k]);
        if (hit) m.material = remap[hit]!;
      });
    } else {
      const g = new RoundedBoxGeometry(fallback[0], fallback[1], fallback[2], 2, Math.min(...fallback) * 0.2);
      obj = new THREE.Mesh(g.translate(0, fallback[1] / 2, 0), (remap.clay as THREE.Material) ?? palette.clay);
    }
    obj.scale.setScalar(scale);
    const holder = new THREE.Group();
    holder.add(obj);
    holder.position.set(x, 0, zz);
    holder.rotation.y = ry;
    room.add(holder);
    items.push({ holder, y: 0, t0, e0: 0.82 + items.length * 0.012 });
    return holder;
  };
  await Promise.all([
    place('rug-rect', 0.3, 0.05, 0, 0.92, { clay: mats.rug }, [2.9, 0.02, 1.7], 0.15),
    place('sofa', 0.45, -1.3, 0, 1, { clay: mats.sofa }, [2.2, 0.8, 0.82], 0.18),
    place('armchair', -1.45, 0.25, Math.PI / 2, 0.78, { clay: mats.chair }, [1.1, 0.8, 0.82], 0.21),
    place('coffee-table', 0.35, 0.15, 0, 0.72, {}, [0.95, 0.33, 0.58], 0.24),
    place('floor-lamp', 1.95, -1.35, -0.4, 1, {}, [0.3, 1.72, 0.3], 0.27),
    place('plant', -1.9, -1.35, 0.5, 1.05, {}, [0.42, 1.3, 0.42], 0.29),
    place('side-table', -1.5, -0.95, Math.PI / 2, 0.75, {}, [0.75, 0.54, 0.31], 0.31),
  ]);
  // warm light from the floor lamp's shade
  const lampLight = new THREE.PointLight(0xffd9a0, 0, 5.5, 1.6);
  lampLight.position.set(1.7, 1.35, -0.9);
  room.add(lampLight);

  const shadow = blobShadow(7.2, 5.6, 0.7);
  shadow.mesh.position.y = -0.15;
  world.add(shadow.mesh);

  // ---- the laptop: palettes and a plan view of the room, redrawn only while a crossfade moves ----
  const ui = makeCanvas(1024, 576);
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const blended = (k: Key, b1: number, b2: number, out: THREE.Color) => out.lerpColors(SCHEMES[0][k], SCHEMES[1][k], b1).lerp(tmp2.copy(SCHEMES[2][k]), b2);
  const drawUI = (b1: number, b2: number) => {
    const c = ui.ctx, W = 1024, H = 576;
    const panel = drawChrome(c, W, H, 'Interior design', ['Living room', 'Materials', 'Lighting'], 270);
    c.fillStyle = 'rgba(233,226,212,0.5)'; c.font = '600 13px system-ui, sans-serif';
    c.fillText('COLOUR SCHEMES', 22, 70);
    const weights = [1 - b1, b1 * (1 - b2), b2];
    SCHEMES.forEach((s, i) => {
      const y = 92 + i * 128, w = weights[i];
      c.fillStyle = `rgba(29,50,96,${0.35 + 0.5 * w})`; roundRect(c, 14, y, panel - 28, 112, 10); c.fill();
      c.strokeStyle = `rgba(214,177,96,${0.15 + 0.85 * w})`; c.lineWidth = 2; roundRect(c, 14, y, panel - 28, 112, 10); c.stroke();
      c.fillStyle = `rgba(243,236,220,${0.6 + 0.4 * w})`; c.font = '600 16px system-ui, sans-serif';
      c.fillText(s.name, 30, y + 24);
      (['wall', 'sofa', 'chair', 'rug'] as Key[]).forEach((k, j) => {
        c.fillStyle = hex(s[k]); roundRect(c, 30 + j * 56, y + 46, 46, 46, 8); c.fill();
      });
    });
    // plan view of the room in the current blend
    const ox = panel + 120, oy = 92, sc = 120;
    const P = (x: number, zz: number) => [ox + (x + RW / 2 + 0.3) * sc, oy + (zz + RD / 2 + 0.2) * sc] as const;
    const rect = (x0: number, z0: number, x1: number, z1: number, col: string, r = 6) => {
      const [a, b] = P(x0, z0), [cc, d] = P(x1, z1);
      c.fillStyle = col; roundRect(c, a, b, cc - a, d - b, r); c.fill();
    };
    rect(-RW / 2, -RD / 2, RW / 2, RD / 2, hex(FLOOR), 2);
    const wc = hex(blended('wall', b1, b2, tmp));
    rect(-RW / 2 - 0.14, -RD / 2 - 0.14, RW / 2, -RD / 2, wc, 2);
    rect(-RW / 2 - 0.14, -RD / 2 - 0.14, -RW / 2, RD / 2, wc, 2);
    rect(WIN.x0, -RD / 2 - 0.14, WIN.x1, -RD / 2, hex(glass), 2);
    rect(-1.15, -0.8, 1.75, 0.9, hex(blended('rug', b1, b2, tmp)), 8);
    rect(-0.65, -1.72, 1.55, -0.95, hex(blended('sofa', b1, b2, tmp)), 12);
    rect(-1.85, -0.3, -1.05, 0.8, hex(blended('chair', b1, b2, tmp)), 12);
    rect(-0.1, -0.15, 0.8, 0.45, hex(clay), 6);
    c.fillStyle = hex(gold); c.beginPath(); c.arc(...P(1.95, -1.35), 14, 0, Math.PI * 2); c.fill();
    c.fillStyle = hex(slate); c.beginPath(); c.arc(...P(-1.9, -1.35), 18, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(214,177,96,0.9)'; c.lineWidth = 2;
    const [a, b] = P(-RW / 2, -RD / 2), [cc, d] = P(RW / 2, RD / 2);
    c.strokeRect(a, b, cc - a, d - b);
    c.fillStyle = 'rgba(233,226,212,0.55)'; c.font = '500 13px system-ui, sans-serif';
    c.fillText('Plan view, living room', panel + 16, H - 14);
    ui.tex.needsUpdate = true;
  };
  drawUI(0, 0);
  const screenMat = screenMaterial(ui.tex);
  const device = await loadDevice(kit, 'laptop', screenMat, 1.9);
  scene.add(device.group);

  const apply = (p: number) => {
    const b1 = ease(0.38, 0.47, p), b2 = ease(0.6, 0.69, p);
    for (const k of ['wall', 'sofa', 'chair', 'rug'] as Key[]) blended(k, b1, b2, mats[k].color);
    const key = Math.round(b1 * 16) * 100 + Math.round(b2 * 16);
    if (key !== uiKey) { uiKey = key; drawUI(Math.round(b1 * 16) / 16, Math.round(b2 * 16) / 16); }
    edges.set(ease(0.0, 0.15, p) * (1 - ease(0.9, 0.99, p)));
    const shell = ease(0.07, 0.21, p) * (1 - ease(0.88, 0.97, p));
    wallMat.opacity = shell; floorMat.opacity = ease(0.04, 0.16, p) * (1 - ease(0.9, 0.98, p));
    walls.visible = shell > 0.003; floor.visible = floorMat.opacity > 0.003;
    // when solid, write depth like an opaque surface (no see-through sorting artefacts)
    wallMat.depthWrite = shell > 0.95; floorMat.depthWrite = floorMat.opacity > 0.95;
    const g = Math.max(1e-3, shell);
    pane.scale.set(1, g, 1); art.scale.set(1, g, g);
    pane.visible = art.visible = shell > 0.003;
    for (const it of items) {
      const a = ease(it.t0, it.t0 + 0.11, p) * (1 - ease(it.e0, it.e0 + 0.08, p));
      it.holder.position.y = (1 - a) * 0.55;
      it.holder.scale.setScalar(Math.max(1e-3, 0.4 + 0.6 * a));
      it.holder.visible = a > 0.003;
    }
    const lampOn = ease(0.32, 0.42, p) * (1 - ease(0.84, 0.9, p));
    lampLight.intensity = 1.6 * lampOn;
  };
  let uiKey = -1;

  // ---- layout and framing (see bim.ts): measured over the progress range, 8% margin ----
  const dir = new THREE.Vector3(0, 0.62, 1).normalize();
  let aspect = -1, devScale = 1;
  const pose = (p: number) => {
    apply(p);
    room.rotation.y = lerp(-0.68, -0.46, p);
    const ds = ease(0.06, 0.22, p) * (1 - ease(0.86, 0.98, p));
    device.group.scale.setScalar(devScale * Math.max(1e-3, ds));
    device.group.visible = ds > 0.002;
    shadow.mat.opacity = 0.7 * ease(0, 0.14, p) * (1 - ease(0.88, 1, p));
  };
  const layout = () => {
    aspect = camera.aspect;
    const k = ease(1.25, 0.95, aspect);
    world.position.set(lerp(-0.3, 0, k), 0, lerp(0, -0.3, k));
    device.group.position.set(lerp(3.2, 1.45, k), lerp(0, -0.55, k), lerp(1.2, 3.1, k));
    device.group.rotation.y = lerp(-0.45, -0.25, k);
    devScale = lerp(1, 0.85, k);
    const pts: THREE.Vector3[] = [];
    for (const s of [0.3, 0.5, 0.7, 0.85]) {
      pose(s);
      device.group.scale.setScalar(devScale);
      measure(world, pts, shadow.mesh);
      measure(device.group, pts);
    }
    fitPoints(camera, dir, pts, 0.08);
  };

  let lastP = -1;
  return {
    scene,
    camera,
    update(p, _dt, time) {
      if (camera.aspect !== aspect) { layout(); lastP = -1; }
      if (p !== lastP) { lastP = p; pose(p); }
      world.position.y = Math.sin((time / 9) * Math.PI * 2) * 0.025;
    },
    dispose() {
      edges.dispose(); shadow.dispose();
      ui.tex.dispose(); screenMat.dispose();
      owned.forEach((m) => m.dispose());
      device.dispose();
      disposeTree(scene);
    },
  };
};
export default interior;
