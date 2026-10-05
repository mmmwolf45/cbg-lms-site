// BIM course: "not just a blueprint, a whole building model". Gold lines draw a floor plan, columns and walls
// rise out of it level by level, then the model fills in as colour-coded BIM layers (clay structure, slate
// ducts, blue plumbing, glass facade, gold slab edges) and the floors part slightly so you see inside.
// A monitor beside it shows the same model in a BIM viewer with a layer legend (rendered once at build).
import * as THREE from 'three';
import type { SceneFactory } from '../types';
import { COLOURS } from '../palette';
import {
  addLights, blobShadow, loadDevice, circleXZ, disposeTree, drawChrome, ease, frame, Grow, hex, legendRow,
  lerp, LineDraw, makeCanvas, rectXZ, screenMaterial, type Piece,
} from './lib/course-b-kit';

const W = 3.2, D = 2.2, H = 0.72, T = 0.07; // footprint, storey height, slab thickness
const COLS_X = [-1.5, -0.5, 0.5, 1.5], COLS_Z = [-1.0, 0, 1.0];

const bim: SceneFactory = async (kit) => {
  const { palette, quality } = kit;
  const low = quality === 'low';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const lights = new THREE.Group();
  addLights(lights);
  scene.add(lights);

  const world = new THREE.Group(); // floats gently
  const model = new THREE.Group(); // turns with progress
  world.add(model);
  scene.add(world);

  // Build timing per storey: level L rises after level L-1; retracts top-down on the way out.
  const rise = (L: number) => 0.14 + L * 0.075;
  const exitAt = (L: number) => 0.82 + (3 - L) * 0.028;
  const struct: Piece[] = [], glass: Piece[] = [], ducts: Piece[] = [], pipes: Piece[] = [], fins: Piece[] = [];

  for (let L = 0; L <= 3; L++) {
    // slab (the 4th is the roof)
    const t0 = L === 0 ? 0.0 : rise(L - 1) + 0.06;
    struct.push({ x: 0, y: L * H + T / 2, z: 0, sx: W + 0.08, sy: T, sz: D + 0.08, grow: 'xz', t0, t1: t0 + 0.09, e0: exitAt(L) + 0.02, e1: exitAt(L) + 0.1, level: L });
  }
  for (let L = 0; L < 3; L++) {
    const t0 = rise(L), e0 = exitAt(L), e1 = e0 + 0.07, h = H - T, yc = L * H + T + h / 2;
    let k = 0;
    for (const x of COLS_X) for (const z of COLS_Z) {
      const d = (k++ % 5) * 0.006;
      struct.push({ x, y: yc, z, sx: 0.12, sy: h, sz: 0.12, grow: 'y', from: -1, t0: t0 + d, t1: t0 + d + 0.08, e0, e1, level: L });
    }
    // lift/stair core (U)
    const wall = (x: number, z: number, sx: number, sz: number, dt: number) =>
      struct.push({ x, y: yc, z, sx, sy: h, sz, grow: 'y', from: -1, t0: t0 + 0.02 + dt, t1: t0 + 0.11 + dt, e0, e1, level: L });
    wall(-0.2, -0.95, 0.56, 0.07, 0);
    wall(-0.45, -0.65, 0.07, 0.6, 0.01);
    wall(0.05, -0.65, 0.07, 0.6, 0.01);

    // facade glass on all four sides, rising from the slab
    const g0 = 0.36 + L * 0.03, gh = h - 0.02;
    // (only the two far faces, so the near faces stay open and the inside reads)
    for (const [x, z, sx, sz] of [[0, -D / 2 + 0.01, W - 0.02, 0.02], [-W / 2 + 0.01, 0, 0.02, D - 0.02]] as const)
      glass.push({ x, y: yc, z, sx, sy: gh, sz, grow: 'y', from: -1, t0: g0, t1: g0 + 0.08, e0: e0 - 0.01, e1: e1 - 0.02, level: L });
    if (!low) {
      for (const x of [-1.0, 0, 1.0]) for (const z of [-D / 2 + 0.03])
        fins.push({ x, y: yc, z, sx: 0.025, sy: h, sz: 0.04, grow: 'y', from: -1, t0: g0 + 0.01, t1: g0 + 0.09, e0: e0 - 0.01, e1: e1 - 0.02, level: L });
      for (const z of [-0.5, 0.5]) for (const x of [-W / 2 + 0.03])
        fins.push({ x, y: yc, z, sx: 0.04, sy: h, sz: 0.025, grow: 'y', from: -1, t0: g0 + 0.01, t1: g0 + 0.09, e0: e0 - 0.01, e1: e1 - 0.02, level: L });
    }

    // HVAC: main duct along x under the next slab, two branches, ceiling diffusers, riser in the core
    const d0 = 0.33 + L * 0.03, yTop = (L + 1) * H;
    ducts.push({ x: 0, y: yTop - 0.09, z: 0.55, sx: 2.7, sy: 0.12, sz: 0.2, grow: 'x', from: -1, t0: d0, t1: d0 + 0.08, e0, e1, level: L });
    for (const x of [-0.95, 0.95]) {
      ducts.push({ x, y: yTop - 0.085, z: 0.3, sx: 0.12, sy: 0.09, sz: 0.42, grow: 'z', from: -1, t0: d0 + 0.04, t1: d0 + 0.1, e0, e1, level: L });
      if (!low) ducts.push({ x, y: yTop - 0.135, z: 0.12, sx: 0.2, sy: 0.025, sz: 0.2, grow: 'all', t0: d0 + 0.08, t1: d0 + 0.12, e0, e1, level: L });
    }
    ducts.push({ x: -0.2, y: L * H + H / 2, z: -0.66, sx: 0.18, sy: H, sz: 0.18, grow: 'y', from: -1, t0: d0 - 0.02, t1: d0 + 0.05, e0, e1, level: L });

    // plumbing: two runs along x and a riser (unit cylinder: local y is the pipe's length)
    for (const [z, y] of [[-0.3, yTop - 0.15], [-0.4, yTop - 0.2]] as const)
      pipes.push({ x: 0, y, z, sx: 0.055, sy: 2.7, sz: 0.055, grow: 'y', from: -1, rz: Math.PI / 2, t0: d0 + 0.02, t1: d0 + 0.1, e0, e1, level: L });
    pipes.push({ x: 1.3, y: L * H + H / 2, z: -0.85, sx: 0.07, sy: H, sz: 0.07, grow: 'y', from: -1, t0: d0, t1: d0 + 0.06, e0, e1, level: L });
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, low ? 8 : 14, 1);
  const grows = [
    new Grow(box, palette.clay, struct),
    new Grow(box, palette.glass, glass),
    new Grow(box, palette.slate, ducts),
    new Grow(cyl, palette.screen, pipes),
    ...(fins.length ? [new Grow(box, palette.clay, fins)] : []),
  ];
  grows[1].mesh.renderOrder = 2; // glass after the opaque layers
  grows.forEach((g) => model.add(g.mesh));

  // Gold slab edges, one line object per slab so they ride with the exploded floors.
  const slabEdges: THREE.LineSegments[] = [];
  for (let L = 0; L <= 3; L++) {
    const seg: number[] = [];
    rectXZ(seg, -W / 2 - 0.045, -D / 2 - 0.045, W / 2 + 0.045, D / 2 + 0.045, T + 0.002);
    const ls = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)), palette.goldLine);
    slabEdges.push(ls);
    model.add(ls);
  }

  // The floor plan the model rises from: grid axes with bubbles, outline, columns, core and partitions.
  const plan: number[] = [], y = T + 0.004;
  for (const x of COLS_X) { plan.push(x, y, -1.55, x, y, 1.55); circleXZ(plan, x, 1.67, 0.11, y, 14); }
  for (const z of COLS_Z) { plan.push(-2.05, y, z, 2.05, y, z); circleXZ(plan, -2.17, z, 0.11, y, 14); }
  rectXZ(plan, -W / 2, -D / 2, W / 2, D / 2, y);
  for (const x of COLS_X) for (const z of COLS_Z) rectXZ(plan, x - 0.09, z - 0.09, x + 0.09, z + 0.09, y);
  rectXZ(plan, -0.49, -0.99, 0.09, -0.35, y);
  const planDraw = new LineDraw(plan, palette.goldLine);
  model.add(planDraw.lines);

  // HVAC routing traced in screen blue along each storey's ducts (drawn as the ducts run out).
  const ductLines: LineDraw[] = [];
  for (let L = 0; L < 3; L++) {
    const seg: number[] = [], yTop = (L + 1) * H;
    seg.push(-1.35, yTop - 0.02, 0.55, 1.35, yTop - 0.02, 0.55);
    for (const x of [-0.95, 0.95]) seg.push(x, yTop - 0.03, 0.55, x, yTop - 0.03, 0.09);
    for (const x of [-0.95, 0.95]) rectXZ(seg, x - 0.1, 0.02, x + 0.1, 0.22, yTop - 0.15);
    const ld = new LineDraw(seg, palette.screenGlow);
    ductLines.push(ld);
    model.add(ld.lines);
  }

  const shadow = blobShadow(6.4, 4.6, 0.7);
  shadow.mesh.position.y = -0.01;
  world.add(shadow.mesh);

  // Exploded-floor offsets (level 0 stays on the plan).
  const levels = new Float32Array(4);
  const setLevels = (p: number) => {
    const sep = 0.36 * ease(0.36, 0.5, p) + 0.1 * ease(0.5, 0.8, p);
    for (let L = 0; L < 4; L++) levels[L] = L * sep;
  };
  const apply = (p: number) => {
    setLevels(p);
    for (const g of grows) g.update(p, levels);
    for (let L = 0; L < 4; L++) {
      const s = struct[L], g = Math.max(1e-4, ease(s.t0, s.t1, p) * (1 - ease(s.e0, s.e1, p)));
      slabEdges[L].position.y = L * H + levels[L];
      slabEdges[L].scale.set(g, 1, g);
      slabEdges[L].visible = g > 0.002;
    }
    planDraw.set(ease(0.0, 0.2, p) * (1 - ease(0.9, 0.99, p)));
    for (let L = 0; L < 3; L++) {
      const d0 = 0.33 + L * 0.03, e0 = exitAt(L);
      ductLines[L].set(ease(d0 + 0.02, d0 + 0.12, p) * (1 - ease(e0 - 0.02, e0 + 0.04, p)));
      ductLines[L].lines.position.y = levels[L];
    }
  };

  // ---- the monitor: a BIM viewer showing this same model with a layer legend (rendered once) ----
  const ui = makeCanvas(1024, 640);
  const panel = drawChrome(ui.ctx, 1024, 640, 'BIM model', ['3D view', 'Plans', 'Sheets', 'Schedules']);
  const c = ui.ctx;
  c.fillStyle = 'rgba(233,226,212,0.5)'; c.font = '600 13px system-ui, sans-serif';
  c.fillText('LAYERS', 22, 72);
  const rows: [number, string, boolean][] = [
    [COLOURS.clay, 'Structure', true], [0x6f84a8, 'HVAC ducts', false], [COLOURS.screen, 'Plumbing', false],
    [COLOURS.glass, 'Facade glazing', false], [COLOURS.gold, 'Slab edges', false],
  ];
  rows.forEach(([col, label, act], i) => legendRow(c, 22, 108 + i * 42, panel - 30, hex(col), label, act));
  c.fillStyle = 'rgba(233,226,212,0.5)'; c.font = '600 13px system-ui, sans-serif';
  c.fillText('LEVELS', 22, 345);
  ['Roof', 'Level 2', 'Level 1', 'Ground'].forEach((l, i) => {
    c.fillStyle = i === 2 ? '#d6b160' : 'rgba(233,226,212,0.7)';
    c.font = '500 15px system-ui, sans-serif';
    c.fillText(l, 30, 378 + i * 30);
  });
  c.fillStyle = 'rgba(233,226,212,0.55)'; c.font = '500 13px system-ui, sans-serif';
  c.fillText('Exploded view, 3 storeys', panel + 16, 640 - 14);
  // view cube, top-right
  c.strokeStyle = 'rgba(214,177,96,0.8)'; c.lineWidth = 1.5;
  const vx = 1024 - 70, vy = 92;
  c.beginPath();
  c.moveTo(vx, vy - 24); c.lineTo(vx + 26, vy - 10); c.lineTo(vx, vy + 4); c.lineTo(vx - 26, vy - 10); c.closePath();
  c.moveTo(vx - 26, vy - 10); c.lineTo(vx - 26, vy + 18); c.lineTo(vx, vy + 32); c.lineTo(vx + 26, vy + 18); c.lineTo(vx + 26, vy - 10);
  c.moveTo(vx, vy + 4); c.lineTo(vx, vy + 32);
  c.stroke();
  ui.tex.needsUpdate = true;

  const sub = new THREE.Scene();
  sub.background = ui.tex;
  apply(0.5);
  sub.add(lights, model);
  const sw = low ? 768 : 1024, sh = sw * 0.625;
  const subCam = new THREE.PerspectiveCamera(30, 1024 / 640, 0.1, 50);
  subCam.position.set(5.6, 4.6, 7.4);
  subCam.lookAt(0, 1.35, 0);
  subCam.setViewOffset(1024, 640, -118, 10, 1024, 640);
  model.rotation.y = -0.35;
  const shot = kit.snapshot(sub, subCam, sw, sh);
  sub.background = null;
  scene.add(lights);
  world.add(model);

  const screenMat = screenMaterial(shot);
  const device = await loadDevice(kit, 'monitor', screenMat, 2.3);
  device.group.rotation.y = -0.28;
  scene.add(device.group);

  // ---- layout and framing: desktop puts the monitor right of the model; narrow screens tuck it in front ----
  const target = new THREE.Vector3(), dir = new THREE.Vector3(0, 0.44, 1).normalize();
  let aspect = -1, hw = 3, hh = 2;
  const layout = () => {
    aspect = camera.aspect;
    const k = ease(1.25, 0.85, aspect); // 0 wide .. 1 narrow
    world.position.set(lerp(-1.15, -0.25, k), 0, lerp(0, -0.4, k));
    device.group.position.set(lerp(2.25, 1.35, k), lerp(0.25, -0.05, k), lerp(0.4, 1.9, k));
    device.group.scale.setScalar(lerp(1, 0.68, k));
    target.set(lerp(0.45, 0.25, k), lerp(1.55, 1.45, k), lerp(0.1, 0.4, k));
    hw = lerp(4.4, 2.9, k); hh = lerp(2.6, 2.9, k);
  };

  let lastP = -1;
  return {
    scene,
    camera,
    update(p, _dt, time) {
      if (camera.aspect !== aspect) { layout(); frame(camera, target, dir, hw, hh); }
      if (p !== lastP) {
        lastP = p;
        apply(p);
        model.rotation.y = lerp(-1.0, -0.3, p);
        const out = ease(0.84, 1, p), inn = 1 - ease(0, 0.16, p);
        model.position.y = 0.25 * out - 0.15 * inn;
        device.group.visible = p > 0.02 && p < 0.995;
        const ds = ease(0.04, 0.2, p) * (1 - ease(0.86, 0.99, p));
        device.group.scale.setScalar(lerp(1, 0.68, ease(1.25, 0.85, aspect)) * Math.max(1e-3, ds));
        shadow.mat.opacity = 0.7 * ease(0, 0.14, p) * (1 - ease(0.88, 1, p));
      }
      world.position.y = Math.sin((time / 9) * Math.PI * 2) * 0.025;
    },
    dispose() {
      box.dispose(); cyl.dispose();
      grows.forEach((g) => g.mesh.dispose());
      slabEdges.forEach((l) => l.geometry.dispose());
      planDraw.dispose(); shadow.dispose(); ductLines.forEach((l) => l.dispose());
      ui.tex.dispose(); shot.dispose(); screenMat.dispose();
      device.dispose();
      disposeTree(scene);
    },
  };
};
export default bim;
