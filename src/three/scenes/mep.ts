// MEP design course: a two-storey building section. A glowing section plane slides along the facade and cuts
// it away (local clipping) to reveal the services behind it: rectangular HVAC ductwork with branches and
// ceiling diffusers, hot/cold/waste pipework to the basins, cable trays with conduits feeding the lights and a
// distribution board. Each system then warms with a soft gold glow in turn: ducts, plumbing, electrical.
// A monitor zooms on a duct run in an MEP viewer (rendered once at build).
import * as THREE from 'three';
import type { SceneFactory } from '../types';
import { COLOURS } from '../palette';
import {
  addLights, blobShadow, loadDevice, disposeTree, drawChrome, ease, fitPoints, Grow, hex, legendRow, lerp, LineDraw,
  makeCanvas, measure, measureState, screenMaterial, type Piece,
} from './lib/course-b-kit';

const HF = 1.2, T = 0.1, X0 = -1.7, X1 = 1.7, Z0 = -0.95, Z1 = 0.95;
const RUN = X1 - X0 - 0.4; // length of the horizontal service runs
const GOLD = new THREE.Color(COLOURS.gold);

// A pipe/conduit path with rounded corners, as a tube that can grow along its length.
function pipe(points: [number, number, number][], radius: number, bend = 0.12) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const v = points.map((p) => new THREE.Vector3(...p));
  let from = v[0];
  for (let i = 1; i < v.length - 1; i++) {
    const a = v[i].clone().sub(v[i - 1]).normalize(), b = v[i + 1].clone().sub(v[i]).normalize();
    const r = Math.min(bend, v[i].distanceTo(v[i - 1]) / 2, v[i].distanceTo(v[i + 1]) / 2);
    const p0 = v[i].clone().addScaledVector(a, -r), p1 = v[i].clone().addScaledVector(b, r);
    path.add(new THREE.LineCurve3(from, p0));
    path.add(new THREE.QuadraticBezierCurve3(p0, v[i].clone(), p1));
    from = p1;
  }
  path.add(new THREE.LineCurve3(from, v[v.length - 1]));
  const len = path.getLength();
  return new THREE.TubeGeometry(path, Math.max(24, Math.round(len * 26)), radius, 8, false);
}

const mep: SceneFactory = async (kit) => {
  const { palette, quality } = kit;
  const low = quality === 'low';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const lights = new THREE.Group();
  addLights(lights, 0.8, 1.1);
  scene.add(lights);
  const world = new THREE.Group(), model = new THREE.Group();
  world.add(model);
  scene.add(world);

  // Scene-owned materials (derived from the palette): the section-plane clipping and the per-system glow
  // need their own instances; everything else uses the shared swatches.
  const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 10);
  const clayCut = palette.clay.clone(); clayCut.clippingPlanes = [plane];
  const glassCut = palette.glass.clone(); glassCut.clippingPlanes = [plane];
  const goldCut = palette.goldLine.clone(); goldCut.clippingPlanes = [plane];
  const ductMat = palette.slate.clone(); ductMat.emissive.copy(GOLD); ductMat.emissiveIntensity = 0;
  const cold = palette.screen.clone(), hot = palette.rebar.clone(), waste = palette.slate.clone();
  for (const m of [hot, waste]) { m.emissive.copy(GOLD); m.emissiveIntensity = 0; }
  const coldEmissive = cold.emissive.clone(), coldIntensity = cold.emissiveIntensity;
  const trayMat = palette.slate.clone(); trayMat.emissive.copy(GOLD); trayMat.emissiveIntensity = 0;
  const cableMat = palette.gold.clone(), conduitMat = palette.gold.clone();
  const clayG = palette.clay.clone(), navyG = palette.navy.clone();
  const lampMat = palette.goldGlow.clone();
  const sectionMat = palette.glass.clone(); sectionMat.opacity = 0.14; sectionMat.depthWrite = false; sectionMat.side = THREE.DoubleSide;
  const owned = [clayCut, glassCut, goldCut, ductMat, cold, hot, waste, trayMat, cableMat, conduitMat, clayG, navyG, lampMat, sectionMat];

  // ---- structure: slabs, back and end walls, right-hand columns, basins and the distribution board ----
  const struct: Piece[] = [], ducts: Piece[] = [], tray: Piece[] = [], facade: Piece[] = [], glazing: Piece[] = [];
  const exitS = 0.9;
  for (let f = 0; f <= 2; f++) {
    const t0 = [0, 0.09, 0.14][f];
    struct.push({ x: 0.05, y: f * HF + T / 2, z: 0, sx: X1 - X0 + 0.3, sy: T, sz: Z1 - Z0 + 0.04, grow: 'xz', t0, t1: t0 + 0.1, e0: exitS + (2 - f) * 0.02, e1: exitS + 0.06 + (2 - f) * 0.02 });
  }
  const wallH = 2 * HF - T, wallY = T + wallH / 2;
  struct.push({ x: 0.05, y: wallY, z: Z0 + 0.05, sx: X1 - X0 + 0.1, sy: wallH, sz: 0.1, grow: 'y', from: -1, t0: 0.04, t1: 0.15, e0: exitS, e1: exitS + 0.07 });
  struct.push({ x: X0 + 0.05, y: wallY, z: 0, sx: 0.1, sy: wallH, sz: Z1 - Z0 - 0.2, grow: 'y', from: -1, t0: 0.05, t1: 0.16, e0: exitS, e1: exitS + 0.07 });
  for (const z of [Z0 + 0.12, Z1 - 0.12]) for (let f = 0; f < 2; f++)
    struct.push({ x: X1 - 0.05, y: f * HF + T + (HF - T) / 2, z, sx: 0.14, sy: HF - T, sz: 0.14, grow: 'y', from: -1, t0: 0.06 + f * 0.03, t1: 0.15 + f * 0.03, e0: exitS, e1: exitS + 0.06 });

  // ---- facade (clipped by the section plane): sill and head panels, glazing band, gold window frames ----
  const goldSeg: number[] = [];
  for (let f = 0; f < 2; f++) {
    const yb = f * HF + T, top = (f + 1) * HF, z = Z1 - 0.03, w = X1 - X0 + 0.14;
    const t0 = 0.06 + f * 0.03;
    facade.push({ x: 0, y: yb + 0.16, z, sx: w, sy: 0.32, sz: 0.06, grow: 'y', from: -1, t0, t1: t0 + 0.08, e0: 0.86, e1: 0.9 });
    facade.push({ x: 0, y: top - 0.21, z, sx: w, sy: 0.42, sz: 0.06, grow: 'y', from: -1, t0: t0 + 0.04, t1: t0 + 0.12, e0: 0.86, e1: 0.9 });
    glazing.push({ x: 0, y: (yb + 0.32 + top - 0.42) / 2, z: z + 0.005, sx: w, sy: top - 0.42 - yb - 0.32, sz: 0.02, grow: 'y', from: -1, t0: t0 + 0.02, t1: t0 + 0.1, e0: 0.86, e1: 0.9 });
    const y0 = yb + 0.32, y1 = top - 0.42, zz = Z1 + 0.003;
    for (let x = X0 - 0.07; x <= X1 + 0.08; x += (w) / 5) goldSeg.push(x, y0, zz, x, y1, zz);
    goldSeg.push(X0 - 0.07, y0, zz, X1 + 0.07, y0, zz, X0 - 0.07, y1, zz, X1 + 0.07, y1, zz);
  }
  const frames = new LineDraw(goldSeg, goldCut);
  model.add(frames.lines);
  // gold slab edges, drawn in as the structure assembles
  const edgeSeg: number[] = [];
  for (let f = 0; f <= 2; f++) {
    const y = f * HF + T + 0.002, x0 = X0 - 0.1, x1 = X1 + 0.2, z0 = Z0 - 0.02, z1 = Z1 + 0.02;
    edgeSeg.push(x0, y, z1, x1, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x0, y, z0);
    edgeSeg.push(x0, y - T, z1, x1, y - T, z1);
  }
  const edges = new LineDraw(edgeSeg, palette.goldLine);
  model.add(edges.lines);

  // ---- HVAC: main supply duct per storey, three branches, necks and square ceiling diffusers, a riser ----
  for (let f = 0; f < 2; f++) {
    const top = (f + 1) * HF, t0 = 0.08 + f * 0.03;
    ducts.push({ x: -0.05, y: top - 0.17, z: -0.3, sx: RUN, sy: 0.22, sz: 0.32, grow: 'x', from: -1, t0, t1: t0 + 0.1, e0: 0.83 + f * 0.02, e1: 0.88 + f * 0.02 });
    for (const x of [-1.05, 0, 1.05]) {
      ducts.push({ x, y: top - 0.16, z: 0.12, sx: 0.2, sy: 0.15, sz: 0.54, grow: 'z', from: -1, t0: t0 + 0.05, t1: t0 + 0.11, e0: 0.82 + f * 0.02, e1: 0.86 + f * 0.02 });
      ducts.push({ x, y: top - 0.25, z: 0.33, sx: 0.13, sy: 0.08, sz: 0.13, grow: 'y', t0: t0 + 0.09, t1: t0 + 0.12, e0: 0.82, e1: 0.85 });
      ducts.push({ x, y: top - 0.3, z: 0.33, sx: 0.34, sy: 0.03, sz: 0.34, grow: 'xz', t0: t0 + 0.1, t1: t0 + 0.13, e0: 0.82, e1: 0.85 });
    }
  }
  ducts.push({ x: X1 - 0.2, y: T + HF - 0.35 + (HF + 0.35 - T) / 2, z: -0.3, sx: 0.26, sy: HF + 0.35 - T, sz: 0.3, grow: 'y', from: -1, t0: 0.06, t1: 0.16, e0: 0.84, e1: 0.9 });

  // ---- electrical: U-section cable tray per storey with gold cables, pendant lights, the board ----
  const cables: Piece[] = [];
  for (let f = 0; f < 2; f++) {
    const top = (f + 1) * HF, t0 = 0.1 + f * 0.03, y = top - 0.13, e0 = 0.83 + f * 0.02, e1 = e0 + 0.05;
    tray.push({ x: -0.05, y, z: 0.6, sx: RUN, sy: 0.015, sz: 0.2, grow: 'x', from: -1, t0, t1: t0 + 0.1, e0, e1 });
    for (const dz of [-0.1, 0.1]) tray.push({ x: -0.05, y: y + 0.035, z: 0.6 + dz, sx: RUN, sy: 0.07, sz: 0.012, grow: 'x', from: -1, t0, t1: t0 + 0.1, e0, e1 });
    for (const [dz, dy] of [[-0.05, 0.022], [0.0, 0.022], [0.05, 0.022], [-0.025, 0.05], [0.025, 0.05]])
      cables.push({ x: -0.05, y: y + dy, z: 0.6 + dz, sx: 0.026, sy: RUN - 0.05, sz: 0.026, rz: Math.PI / 2, grow: 'y', from: -1, t0: t0 + 0.02, t1: t0 + 0.12, e0, e1 });
    for (const x of [-0.65, 0.65]) { // pendant body + rods
      tray.push({ x, y: top - 0.44, z: 0.33, sx: 0.78, sy: 0.05, sz: 0.13, grow: 'x', t0: t0 + 0.06, t1: t0 + 0.12, e0, e1 });
      for (const dx of [-0.3, 0.3]) cables.push({ x: x + dx, y: top - 0.23, z: 0.33, sx: 0.012, sy: 0.4, sz: 0.012, grow: 'y', t0: t0 + 0.05, t1: t0 + 0.1, e0, e1 });
    }
  }
  tray.push({ x: 1.0, y: T + 0.8, z: Z0 + 0.14, sx: 0.42, sy: 0.58, sz: 0.09, grow: 'all', t0: 0.12, t1: 0.2, e0: 0.86, e1: 0.92 });

  const fixtures: Piece[] = [];
  for (let f = 0; f < 2; f++) { // vanity units with basins on the back wall
    const yb = f * HF + T;
    fixtures.push({ x: 0.25, y: yb + 0.74, z: Z0 + 0.28, sx: 0.62, sy: 0.12, sz: 0.36, grow: 'all', t0: 0.12, t1: 0.2, e0: 0.86, e1: 0.92 });
  }
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1);
  const grows = [
    new Grow(box, clayG, struct),
    new Grow(box, clayCut, facade),
    new Grow(box, glassCut, glazing),
    new Grow(box, ductMat, ducts),
    new Grow(box, trayMat, tray),
    new Grow(cyl, cableMat, cables),
    new Grow(box, navyG, fixtures),
  ];
  grows[2].mesh.renderOrder = 2;
  grows.forEach((g) => model.add(g.mesh));

  // light strips under the pendants (warm on when the electrical system lights up)
  const lampGeo = new THREE.BoxGeometry(0.76, 0.035, 0.02);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 4);
  { let i = 0; const m = new THREE.Matrix4(); for (let f = 0; f < 2; f++) for (const x of [-0.65, 0.65]) lamps.setMatrixAt(i++, m.makeTranslation(x, (f + 1) * HF - 0.455, 0.405)); }
  model.add(lamps);

  // ---- pipework and conduits: tubes that run out along their paths ----
  const tubes: { mesh: THREE.Mesh; t0: number; t1: number; e0: number; e1: number }[] = [];
  const addTube = (pts: [number, number, number][], r: number, mat: THREE.Material, t0: number, t1: number, e0 = 0.83, e1 = 0.89) => {
    const mesh = new THREE.Mesh(pipe(pts, r), mat);
    tubes.push({ mesh, t0, t1, e0, e1 });
    model.add(mesh);
  };
  const zc = Z0 + 0.17, zh = Z0 + 0.25, zw = Z0 + 0.33;
  // cold water: riser at the left, a run under each ceiling, a drop to each basin
  addTube([[-1.2, T, zc], [-1.2, 2 * HF - 0.36, zc], [0.15, 2 * HF - 0.36, zc], [0.15, HF + T + 0.86, zc]], 0.032, cold, 0.1, 0.2);
  addTube([[-1.2, HF - 0.36, zc], [0.15, HF - 0.36, zc], [0.15, T + 0.86, zc]], 0.032, cold, 0.13, 0.21);
  // hot water alongside
  addTube([[-1.05, T, zh], [-1.05, 2 * HF - 0.44, zh], [0.35, 2 * HF - 0.44, zh], [0.35, HF + T + 0.86, zh]], 0.032, hot, 0.11, 0.21);
  addTube([[-1.05, HF - 0.44, zh], [0.35, HF - 0.44, zh], [0.35, T + 0.86, zh]], 0.032, hot, 0.14, 0.22);
  // waste: from each basin down and across to the stack
  addTube([[0.25, HF + T + 0.7, zw], [0.25, HF + T + 0.42, zw], [-0.85, HF + T + 0.42, zw], [-0.85, T, zw]], 0.05, waste, 0.12, 0.21);
  addTube([[0.25, T + 0.7, zw], [0.25, T + 0.42, zw], [-0.85, T + 0.42, zw]], 0.05, waste, 0.14, 0.21);
  // conduits: board up to the ceiling and across to the tray; tray drops to the pendants
  addTube([[1.0, T + 1.09, Z0 + 0.14], [1.0, HF - 0.08, Z0 + 0.14], [1.0, HF - 0.08, 0.6]], 0.02, conduitMat, 0.14, 0.22);
  if (!low) addTube([[1.15, T + 1.09, Z0 + 0.14], [1.15, HF + T, Z0 + 0.14], [1.15, 2 * HF - 0.08, Z0 + 0.14], [1.15, 2 * HF - 0.08, 0.6]], 0.02, conduitMat, 0.15, 0.23);

  // ---- the section plane: a gold frame with a faint glass face, sliding along x ----
  const sec = new THREE.Group();
  const secH = 2 * HF + T + 0.2, secD = Z1 - Z0 + 0.4;
  const secFace = new THREE.Mesh(new THREE.PlaneGeometry(secD, secH), sectionMat);
  secFace.rotation.y = Math.PI / 2;
  secFace.position.y = secH / 2 - 0.05;
  sec.add(secFace);
  const sf: number[] = [];
  const zA = -secD / 2, zB = secD / 2, yA = -0.05, yB = secH - 0.05;
  sf.push(0, yA, zA, 0, yA, zB, 0, yA, zB, 0, yB, zB, 0, yB, zB, 0, yB, zA, 0, yB, zA, 0, yA, zA);
  const secFrame = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sf, 3)), palette.goldLine);
  sec.add(secFrame);
  model.add(sec);

  const shadow = blobShadow(6.2, 4.2, 0.72);
  shadow.mesh.position.y = -0.01;
  world.add(shadow.mesh);

  // highlight windows: ducts, then plumbing, then electrical (each rises and settles back to a faint glow)
  const hl = (a: number, p: number) => ease(a, a + 0.06, p) * (1 - 0.82 * ease(a + 0.13, a + 0.19, p));
  const apply = (p: number) => {
    for (const g of grows) g.update(p);
    // section plane sweeps left to right across the facade, then folds away
    const X = lerp(X0 - 0.2, X1 + 0.25, ease(0.18, 0.4, p));
    plane.constant = -X;
    sec.position.x = X;
    const s = ease(0.13, 0.19, p) * (1 - ease(0.4, 0.46, p));
    sec.scale.set(1, Math.max(1e-3, s), Math.max(1e-3, s));
    sec.visible = s > 0.002;
    frames.set(ease(0.06, 0.18, p) * (1 - ease(0.84, 0.9, p)));
    edges.set(ease(0.02, 0.2, p) * (1 - ease(0.86, 0.97, p)));
    for (const t of tubes) {
      const n = t.mesh.geometry.index!.count, g = ease(t.t0, t.t1, p) * (1 - ease(t.e0, t.e1, p));
      t.mesh.geometry.setDrawRange(0, Math.floor((n / 6) * g) * 6);
      t.mesh.visible = g > 0.001;
    }
    const hD = hl(0.38, p), hP = hl(0.52, p), hE = ease(0.66, 0.72, p);
    ductMat.emissiveIntensity = 1.3 * hD;
    hot.emissiveIntensity = waste.emissiveIntensity = 1.2 * hP;
    cold.emissive.copy(coldEmissive).lerp(GOLD, hP * 0.8);
    cold.emissiveIntensity = lerp(coldIntensity, 1.0, hP);
    trayMat.emissiveIntensity = 1.3 * hE * (1 - 0.7 * ease(0.78, 0.84, p));
    cableMat.emissiveIntensity = conduitMat.emissiveIntensity = 0.08 + 0.7 * hE * (1 - 0.6 * ease(0.78, 0.84, p));
    lampMat.color.copy(GOLD).multiplyScalar(lerp(0.32, 2.4, hE) * (1 - ease(0.84, 0.9, p)));
    lamps.visible = ease(0.12, 0.2, p) * (1 - ease(0.86, 0.9, p)) > 0.01;
  };

  // ---- the monitor: an MEP viewer zoomed on the level 1 supply duct and diffuser (rendered once) ----
  const ui = makeCanvas(1024, 640);
  const panel = drawChrome(ui.ctx, 1024, 640, 'MEP design', ['Section A', 'HVAC', 'Plumbing', 'Electrical']);
  const c = ui.ctx;
  c.fillStyle = 'rgba(233,226,212,0.5)'; c.font = '600 13px system-ui, sans-serif';
  c.fillText('SYSTEMS', 22, 72);
  const rows: [number, string, boolean][] = [
    [COLOURS.gold, 'Supply air', true], [COLOURS.screen, 'Cold water', false], [COLOURS.rebar, 'Hot water', false],
    [0x6f84a8, 'Waste', false], [0xc9a24f, 'Power and lighting', false],
  ];
  rows.forEach(([col, label, act], i) => legendRow(c, 22, 108 + i * 42, panel - 30, hex(col), label, act));
  c.fillStyle = 'rgba(233,226,212,0.5)'; c.font = '600 13px system-ui, sans-serif';
  c.fillText('SELECTED', 22, 345);
  c.font = '500 15px system-ui, sans-serif';
  [['Duct', 'Rectangular'], ['Level', 'Level 1 ceiling'], ['Terminal', 'Square diffuser']].forEach(([k, v], i) => {
    c.fillStyle = 'rgba(233,226,212,0.55)'; c.fillText(k, 22, 378 + i * 30);
    c.fillStyle = '#e9e2d4'; c.fillText(v, 100, 378 + i * 30);
  });
  c.fillStyle = 'rgba(233,226,212,0.55)'; c.font = '500 13px system-ui, sans-serif';
  c.fillText('Section A, level 1 ceiling void', panel + 16, 640 - 14);
  ui.tex.needsUpdate = true;

  const sub = new THREE.Scene();
  sub.background = ui.tex;
  apply(0.405);
  sub.add(lights, model);
  const sw = low ? 768 : 1024, sh = sw * 0.625;
  // isolate the services from the building (as an MEP viewer does) and zoom on the level 1 ceiling runs
  const hide = [edges.lines, grows[0].mesh, grows[1].mesh, grows[2].mesh, grows[4].mesh, grows[5].mesh, grows[6].mesh, lamps, frames.lines];
  hide.forEach((o) => { o.visible = false; });
  const subCam = new THREE.PerspectiveCamera(31, 1024 / 640, 0.05, 50);
  subCam.position.set(1.5, HF + 0.5, 3.1);
  subCam.lookAt(-0.15, HF - 0.32, -0.15);
  subCam.setViewOffset(1024, 640, -150, 20, 1024, 640);
  model.rotation.y = 0.3;
  const shot = kit.snapshot(sub, subCam, sw, sh);
  hide.forEach((o) => { o.visible = true; });
  sub.background = null;
  scene.add(lights);
  world.add(model);

  const screenMat = screenMaterial(shot);
  const device = await loadDevice(kit, 'monitor', screenMat, 2.1);
  device.group.rotation.y = -0.3;
  scene.add(device.group);

  // ---- layout and framing (see bim.ts): measured over the progress range, 8% margin ----
  const dir = new THREE.Vector3(0, 0.16, 1).normalize();
  let aspect = -1, devScale = 1;
  const pose = (p: number) => {
    apply(p);
    model.rotation.y = lerp(0.4, 0.1, p);
    model.position.y = -0.15 * (1 - ease(0, 0.16, p)) - 0.2 * ease(0.86, 1, p);
    const ds = ease(0.06, 0.2, p) * (1 - ease(0.86, 0.98, p));
    device.group.scale.setScalar(devScale * Math.max(1e-3, ds));
    device.group.visible = ds > 0.002;
    shadow.mat.opacity = 0.72 * ease(0, 0.14, p) * (1 - ease(0.88, 1, p));
  };
  const layout = () => {
    aspect = camera.aspect;
    const k = ease(1.25, 0.95, aspect);
    world.position.set(lerp(-1.0, 0, k), 0, lerp(0, -0.4, k));
    device.group.position.set(lerp(2.45, 1.0, k), lerp(0.15, -0.95, k), lerp(0.8, 1.9, k));
    devScale = lerp(1, 0.9, k);
    const pts: THREE.Vector3[] = [];
    for (const s of [0.25, 0.5, 0.75, 0.9]) {
      pose(s);
      device.group.scale.setScalar(devScale);
      measureState(s);
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
      world.position.y = Math.sin((time / 10) * Math.PI * 2) * 0.02;
    },
    dispose() {
      box.dispose(); cyl.dispose(); lampGeo.dispose();
      grows.forEach((g) => g.dispose());
      lamps.dispose();
      frames.dispose(); edges.dispose(); shadow.dispose();
      ui.tex.dispose(); shot.dispose(); screenMat.dispose();
      owned.forEach((m) => m.dispose());
      device.dispose();
      disposeTree(scene);
    },
  };
};
export default mep;
