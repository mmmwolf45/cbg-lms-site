// Structural Design: a small steel frame, a reinforced-concrete column, beam and slab whose concrete clears to
// show the rebar cage, a monitor with the frame's analysis model, and in front a steel beam-to-column
// joint that calmly separates into column, bolts, end plate and beam (with the column's stiffeners sliding
// out) and closes again. 0-0.18 arrive, 0.18-0.82 the action, 0.82-1 drift away.
import * as THREE from 'three';
import type { Kit, SceneFactory } from '../types';
import { COLOURS } from '../palette';
import { Bag, Drift, Framer, blob, ease, FONT, fitScreen, goldEdges, lights, merge, placed, roundedSlab, screenMat } from './lib/course-a-kit';

// An I-section (depth d, flange width bf, flange tf, web tw) extruded along +z from 0 to len.
function iSection(len: number, d: number, bf: number, tf: number, tw: number) {
  const s = new THREE.Shape(), h = d / 2, b = bf / 2, w = tw / 2;
  s.moveTo(-b, -h); s.lineTo(b, -h); s.lineTo(b, -h + tf); s.lineTo(w, -h + tf); s.lineTo(w, h - tf); s.lineTo(b, h - tf);
  s.lineTo(b, h); s.lineTo(-b, h); s.lineTo(-b, h - tf); s.lineTo(-w, h - tf); s.lineTo(-w, -h + tf); s.lineTo(-b, -h + tf); s.lineTo(-b, -h);
  return new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
}
// column: vertical from y = 0, flanges facing ±x
const column = (len: number, d: number, bf: number, tf: number, tw: number) => iSection(len, d, bf, tf, tw).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
// beam: along +x from x = 0, web vertical
const beamX = (len: number, d: number, bf: number, tf: number, tw: number) => iSection(len, d, bf, tf, tw).rotateY(Math.PI / 2);
const beamZ = (len: number, d: number, bf: number, tf: number, tw: number) => iSection(len, d, bf, tf, tw);

function steelFrame(bag: Bag, kit: Kit) {
  const parts: THREE.BufferGeometry[] = [], W = 0.22, D = 0.26, H = 0.2, sec = [0.026, 0.02, 0.004, 0.003] as const;
  for (const x of [-W, 0, W]) for (const z of [-D / 2, D / 2]) parts.push(column(2 * H + 0.01, ...sec).translate(x, 0, z));
  for (let f = 1; f <= 2; f++) {
    const y = f * H - 0.013 + 0.01 * (f - 1);
    for (const z of [-D / 2, D / 2]) parts.push(beamX(2 * W, 0.024, 0.016, 0.003, 0.0025).translate(-W, y, z));
    for (const x of [-W, 0, W]) parts.push(beamZ(D, 0.024, 0.016, 0.003, 0.0025).translate(x, y, -D / 2));
  }
  // bracing in one bay, and base plates
  const brace = (a: THREE.Vector3, b: THREE.Vector3) => {
    const d = b.clone().sub(a), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return new THREE.CylinderGeometry(0.004, 0.004, d.length(), 6).applyQuaternion(q).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  };
  parts.push(brace(new THREE.Vector3(0, 0.01, -D / 2), new THREE.Vector3(W, H - 0.02, -D / 2)), brace(new THREE.Vector3(W, 0.01, -D / 2), new THREE.Vector3(0, H - 0.02, -D / 2)));
  const geo = merge(bag, parts);
  const mesh = new THREE.Mesh(geo, kit.palette.clay);
  const plates = new THREE.Mesh(merge(bag, [-W, 0, W].flatMap((x) => [-D / 2, D / 2].map((z) => placed(new THREE.BoxGeometry(0.045, 0.006, 0.045), x, 0.003, z)))), kit.palette.gold);
  const g = new THREE.Group();
  g.add(mesh, plates);
  return g;
}

// Reinforced-concrete column + beam + slab; semi-transparent concrete over an instanced rebar cage.
function rcc(bag: Bag, kit: Kit, low: boolean) {
  const P = kit.palette, g = new THREE.Group();
  const C = 0.085, Hs = 0.332, BW = 0.065, BD = 0.1, BL = 0.28, ST = 0.028, SW = 0.26;
  const boxes = [
    placed(new THREE.BoxGeometry(C, Hs, C), 0, Hs / 2, 0),
    placed(new THREE.BoxGeometry(BL, BD, BW), C / 2 + BL / 2, Hs - BD / 2, 0),
    placed(new THREE.BoxGeometry(BL + C, ST, SW), BL / 2, Hs + ST / 2, -0.07),
  ];
  const edges = boxes.map((b) => new THREE.EdgesGeometry(b));
  const concreteMat = bag.add(new THREE.MeshStandardMaterial({ color: COLOURS.clay, roughness: 0.9, transparent: true, opacity: 0.6, depthWrite: false }));
  const concrete = new THREE.Mesh(merge(bag, boxes), concreteMat);
  concrete.renderOrder = 2;
  const lines = new THREE.LineSegments(merge(bag, edges.map((e) => { const n = new THREE.BufferGeometry(); n.setAttribute('position', e.attributes.position); return n; })), P.goldLine);
  edges.forEach((e) => e.dispose());
  // bars: unit cylinders scaled per instance
  const bars: THREE.Matrix4[] = [], q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  const bar = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const d = b.clone().sub(a);
    q.setFromUnitVectors(up, d.clone().normalize());
    bars.push(m.clone().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(r, d.length(), r)));
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const ci = C / 2 - 0.013;
  const colBars = low ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [a, b] of colBars) bar(V(a * ci, 0.0, b * ci), V(a * ci, Hs + 0.015, b * ci), 0.0036);
  const bi = BW / 2 - 0.012;
  for (const [y, z] of [[Hs - 0.015, -bi], [Hs - 0.015, bi], [Hs - BD + 0.014, -bi], [Hs - BD + 0.014, bi]]) bar(V(-ci, y, z), V(C / 2 + BL - 0.01, y, z), 0.0038);
  const sp = low ? 0.08 : 0.04;
  for (let x = -C / 2 + 0.03; x < C / 2 + BL - 0.01; x += sp) bar(V(x, Hs + ST / 2, -0.07 - SW / 2 + 0.01), V(x, Hs + ST / 2, -0.07 + SW / 2 - 0.01), 0.0026);
  for (let z = -0.07 - SW / 2 + 0.03; z < -0.07 + SW / 2 - 0.01; z += sp) bar(V(-C / 2 + 0.01, Hs + ST / 2 + 0.005, z), V(C / 2 + BL - 0.01, Hs + ST / 2 + 0.005, z), 0.0026);
  const barMesh = new THREE.InstancedMesh(bag.add(new THREE.CylinderGeometry(1, 1, 1, 6)), P.rebar, bars.length);
  bars.forEach((b, i) => barMesh.setMatrixAt(i, b));
  // stirrups: a unit rounded-square ring, scaled per instance
  const path = new THREE.CurvePath<THREE.Vector3>(), h = 0.5, r = 0.12;
  const pts: [number, number][] = [[-h + r, -h], [h - r, -h], [h, -h + r], [h, h - r], [h - r, h], [-h + r, h], [-h, h - r], [-h, -h + r]];
  for (let i = 0; i < 8; i += 2) {
    const [a, b] = [pts[i], pts[i + 1]], c = pts[(i + 2) % 8], corner = [[h, -h], [h, h], [-h, h], [-h, -h]][i / 2];
    path.add(new THREE.LineCurve3(V(a[0], a[1], 0), V(b[0], b[1], 0)));
    path.add(new THREE.QuadraticBezierCurve3(V(b[0], b[1], 0), V(corner[0], corner[1], 0), V(c[0], c[1], 0)));
  }
  const ringG = bag.add(new THREE.TubeGeometry(path, 48, 0.045, 5, true));
  const rings: THREE.Matrix4[] = [], e = new THREE.Euler();
  const ss = low ? 0.1 : 0.05;
  for (let y = 0.02; y < Hs - BD; y += ss) rings.push(new THREE.Matrix4().compose(V(0, y, 0), q.setFromEuler(e.set(Math.PI / 2, 0, 0)), V(C - 0.02, C - 0.02, C - 0.02)));
  const bs = low ? 0.09 : 0.045;
  for (let x = C / 2 + 0.015; x < C / 2 + BL - 0.01; x += bs) rings.push(new THREE.Matrix4().compose(V(x, Hs - BD / 2, 0), q.setFromEuler(e.set(0, Math.PI / 2, 0)), V(BW - 0.018, BD - 0.02, BW - 0.018)));
  const ringMesh = new THREE.InstancedMesh(ringG, P.rebar, rings.length);
  rings.forEach((t, i) => ringMesh.setMatrixAt(i, t));
  g.add(barMesh, ringMesh, concrete, lines);
  return { g, concreteMat };
}

// The beam-to-column joint: column, end plate, 6 bolts, 4 web stiffeners, beam. explode(0..1) separates it.
function joint(bag: Bag, kit: Kit) {
  const P = kit.palette, g = new THREE.Group();
  const cd = 0.08, cbf = 0.075, ctf = 0.008, ctw = 0.005, y0 = 0.3, pt = 0.01;
  const colG = column(0.44, cd, cbf, ctf, ctw);
  const col = new THREE.Mesh(bag.add(colG), P.slate);
  col.add(goldEdges(bag, kit, colG, 35));
  const capG = placed(new THREE.BoxGeometry(cd + 0.03, 0.008, cbf + 0.03), 0, 0.004, 0);
  const base = new THREE.Mesh(merge(bag, [capG]), P.gold);
  const beamG = beamX(0.28, 0.07, 0.05, 0.007, 0.004).translate(0, y0, 0);
  const beam = new THREE.Mesh(bag.add(beamG), P.slate);
  beam.add(goldEdges(bag, kit, beamG, 35));
  const plateG = placed(new THREE.BoxGeometry(pt, 0.12, 0.07), pt / 2, y0, 0);
  const plate = new THREE.Mesh(bag.add(plateG), P.clay);
  plate.add(goldEdges(bag, kit, plateG, 35));
  // bolt along +x: hex head on the plate side, nut inside the column flange
  const boltG = merge(bag, [
    placed(new THREE.CylinderGeometry(0.0045, 0.0045, 0.04, 10), 0, 0, 0, 0, 0, Math.PI / 2),
    placed(new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 6), 0.017, 0, 0, 0, 0, Math.PI / 2),
    placed(new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 6), -0.014, 0, 0, 0, 0, Math.PI / 2),
  ]);
  const bolts = new THREE.InstancedMesh(boltG, P.gold, 6);
  const bm = new THREE.Matrix4();
  let i = 0;
  for (const dy of [-0.04, 0, 0.04]) for (const dz of [-0.022, 0.022]) bolts.setMatrixAt(i++, bm.makeTranslation(0, y0 + dy, dz));
  // stiffeners: plates inside the column between its flanges, level with the beam flanges, either side of the web
  const sw = (cbf - ctw) / 2 - 0.002;
  const stiff = (sz: number) => new THREE.Mesh(merge(bag, [-1, 1].map((sy) => placed(new THREE.BoxGeometry(cd - 2 * ctf, 0.006, sw), 0, y0 + sy * 0.0315, sz * (ctw / 2 + sw / 2)))), P.clay);
  const stA = stiff(1), stB = stiff(-1);
  // gold guide lines along the bolt axes, shown while the joint is open
  const guideG = bag.add(new THREE.BufferGeometry());
  const gp: number[] = [];
  for (const dy of [-0.04, 0, 0.04]) for (const dz of [-0.022, 0.022]) gp.push(0, y0 + dy, dz, 1, y0 + dy, dz);
  guideG.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  const guideMat = bag.add(new THREE.LineDashedMaterial({ color: new THREE.Color(COLOURS.gold).multiplyScalar(1.6), dashSize: 0.01, gapSize: 0.008, transparent: true, opacity: 0, toneMapped: false }));
  const guides = new THREE.LineSegments(guideG, guideMat);
  guides.computeLineDistances();
  guides.position.x = cd / 2;
  g.add(col, base, beam, plate, bolts, stA, stB, guides);
  const fx = cd / 2; // column flange face
  const explode = (e: number) => {
    bolts.position.x = fx - 0.006 + 0.06 * e;
    plate.position.x = fx + 0.115 * e;
    beam.position.x = fx + pt + 0.17 * e;
    stA.position.z = 0.09 * e;
    stB.position.z = -0.09 * e;
    guides.scale.x = Math.max(0.0001, 0.17 * e);
    guideMat.opacity = Math.min(1, e * 1.4) * 0.9;
    guides.visible = e > 0.01;
  };
  explode(0);
  return { g, explode };
}

// The analysis model on the monitor: a 3-bay, 3-storey frame elevation, its deflected shape in gold.
function analysisTex(bag: Bag) {
  const W = 768, H = 480, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  const tex = bag.add(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const ox = 170, oy = 420, bw = 150, sh = 105, gold = '#d6b160';
  const draw = (a: number) => {
    x.fillStyle = '#0c1730'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(127,178,255,.12)'; x.lineWidth = 1;
    for (let i = 0; i < W; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (let i = 0; i < H; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    x.fillStyle = gold; x.font = `700 34px ${FONT}`; x.textAlign = 'left'; x.fillText('Frame analysis', 28, 50);
    x.fillStyle = 'rgba(233,226,212,.6)'; x.font = `500 22px ${FONT}`; x.fillText('Lateral load', 28, 82);
    // undeformed frame
    x.strokeStyle = 'rgba(233,226,212,.55)'; x.lineWidth = 3;
    for (let f = 1; f <= 3; f++) { x.beginPath(); x.moveTo(ox, oy - f * sh); x.lineTo(ox + 3 * bw, oy - f * sh); x.stroke(); }
    for (let c2 = 0; c2 <= 3; c2++) { x.beginPath(); x.moveTo(ox + c2 * bw, oy); x.lineTo(ox + c2 * bw, oy - 3 * sh); x.stroke(); }
    // fixed supports
    x.fillStyle = 'rgba(233,226,212,.55)';
    for (let c2 = 0; c2 <= 3; c2++) x.fillRect(ox + c2 * bw - 16, oy, 32, 8);
    // load arrows
    x.strokeStyle = gold; x.fillStyle = gold; x.lineWidth = 3;
    for (let f = 1; f <= 3; f++) {
      const y = oy - f * sh;
      x.beginPath(); x.moveTo(ox - 90, y); x.lineTo(ox - 20, y); x.stroke();
      x.beginPath(); x.moveTo(ox - 14, y); x.lineTo(ox - 30, y - 9); x.lineTo(ox - 30, y + 9); x.fill();
    }
    // deflected shape: sway grows with height, beams curve in double bending
    const sway = (f: number) => a * 46 * Math.sin((f / 3) * Math.PI / 2);
    x.strokeStyle = gold; x.lineWidth = 5; x.shadowColor = gold; x.shadowBlur = 12;
    for (let c2 = 0; c2 <= 3; c2++) {
      x.beginPath(); x.moveTo(ox + c2 * bw, oy);
      for (let t = 1; t <= 30; t++) { const f = (t / 30) * 3; x.lineTo(ox + c2 * bw + sway(f), oy - f * sh); }
      x.stroke();
    }
    for (let f = 1; f <= 3; f++) {
      x.beginPath();
      for (let t = 0; t <= 60; t++) {
        const u = t / 60, px = ox + u * 3 * bw + sway(f), py = oy - f * sh + a * 5 * Math.sin(u * 3 * Math.PI * 2);
        if (t === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
    x.shadowBlur = 0;
    x.fillStyle = gold; x.font = `600 22px ${FONT}`; x.textAlign = 'right'; x.fillText('Deflected shape', W - 28, 50);
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

const structural: SceneFactory = async (kit) => {
  const P = kit.palette, bag = new Bag(), low = kit.quality === 'low';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  lights(scene, 0.5);
  const drift = new Drift();
  const monitor = (await kit.loadGLB('monitor')).scene;

  const world = new THREE.Group();
  scene.add(world);
  const baseG = bag.add(roundedSlab(1.5, 0.95, 0.05, 0.08));
  baseG.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(baseG, P.navy);
  base.position.y = -0.025;
  base.add(goldEdges(bag, kit, baseG, 30));
  world.add(base);
  drift.add(base, [0, -0.25, 0], 0);
  const item = (o: THREE.Object3D, x: number, z: number, ry: number, sw: number, sd: number, from: [number, number, number], lag: number, spin: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const b = blob(bag, sw, sd, 0.6);
    b.position.y = 0.001;
    g.add(b, o);
    world.add(g);
    drift.add(g, from, lag, spin);
    return g;
  };

  // monitor (GLB) at the back, showing the analysis model
  const an = analysisTex(bag);
  an.draw(0);
  fitScreen(bag, kit, monitor, screenMat(bag, an.tex));
  monitor.scale.setScalar(1.25);
  item(monitor, 0.02, -0.3, 0, 0.7, 0.3, [0, 0.4, -0.2], 0.2, 0);

  item(steelFrame(bag, kit), -0.46, -0.12, 0.45, 0.7, 0.5, [-0.4, 0.45, -0.1], 0.35, 0.6);
  const rc = rcc(bag, kit, low);
  item(rc.g, 0.44, -0.16, -0.9, 0.55, 0.5, [0.4, 0.45, -0.1], 0.5, -0.6);
  const jt = joint(bag, kit);
  item(jt.g, -0.2, 0.22, -0.3, 0.55, 0.3, [0, 0.4, 0.3], 0.7, 0.5);

  const framer = new Framer(camera, new THREE.Vector3(0, 0.15, -0.02), [0, 0.5, 1], 0.98, 0.52);
  let amp = -1, drawnAt = -1;

  return {
    scene,
    camera,
    update(p, _dt, t) {
      drift.apply(p);
      // the concrete clears to show its cage 0.18..0.3 (and clouds over again as it leaves)
      rc.concreteMat.opacity = 0.62 - 0.44 * ease(0.18, 0.3, p) * (1 - ease(0.8, 0.9, p));
      // the joint opens 0.26..0.42, holds, closes 0.6..0.76
      jt.explode(ease(0.26, 0.42, p) * (1 - ease(0.6, 0.76, p)));
      // the deflected shape grows on the monitor while the joint is open (redrawn in 30 steps only)
      const a = Math.round(30 * ease(0.24, 0.46, p) * (1 - ease(0.78, 0.86, p))) / 30;
      if (a !== amp && (t - drawnAt >= 0.1 || t < drawnAt)) { amp = a; drawnAt = t; an.draw(a); } // at most 10 redraws a second
      framer.update(t);
    },
    dispose() { bag.dispose(); monitor.traverse((m) => (m as THREE.Mesh).geometry?.dispose()); },
  };
};
export default structural;
