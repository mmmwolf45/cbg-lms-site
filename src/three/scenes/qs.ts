// Quantity Surveying: a rolled drawing drifts onto a desk with a calculator, a tape measure and a laptop.
// The drawing unrolls into a floor plan, the tape runs out along it, a small wireframe frame rises from the
// plan and its members light gold one by one as they are "measured" while the calculator counts the
// concrete up to the take-off total and the laptop's BOQ row fills in. 0-0.18 arrive, 0.18-0.82 the
// take-off, 0.82-1 the drawing rolls back up and everything drifts away.
// Quantities are the illustrative example take-off in content/courses/quantity-surveying.yaml (concrete 95 m³).
import * as THREE from 'three';
import type { Kit, SceneFactory } from '../types';
import { COLOURS } from '../palette';
import { Bag, Drift, Framer, blob, canvasTex, ease, FONT, fitScreen, goldEdges, hump, lights, merge, placed, roundedSlab, rr, screenMat } from './lib/course-a-kit';

const CONCRETE = 95; // m³, the example take-off's concrete line
const BOQ: [string, string][] = [['Excavation', '180 m³'], ['Concrete', '95 m³'], ['Reinforcement', '9,500 kg'], ['Blockwork', '620 m²'], ['Plaster', '1,300 m²']];
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const NAVY = '#0f1b33', CLAY = '#e9e2d4', GOLD = '#d6b160', INK_GOLD = '#a8823a';

// ---- the drawing: a floor plan in navy on clay paper, gold dimensions ----
function drawPlan(x: CanvasRenderingContext2D, W: number, H: number) {
  x.fillStyle = CLAY; x.fillRect(0, 0, W, H);
  x.strokeStyle = NAVY; x.lineWidth = 4; x.strokeRect(28, 28, W - 56, H - 56);
  const ox = 230, oy = 190, s = 64; // plan origin and px per metre (house 12.4 x 8.6 m)
  const X = (m: number) => ox + m * s, Y = (m: number) => oy + m * s;
  // grid lines + bubbles
  x.setLineDash([14, 10]); x.strokeStyle = 'rgba(15,27,51,.28)'; x.lineWidth = 2;
  const gx = [0, 4.2, 8.2, 12.4], gy = [0, 4.6, 8.6];
  for (const g of gx) { x.beginPath(); x.moveTo(X(g), oy - 90); x.lineTo(X(g), Y(8.6) + 40); x.stroke(); }
  for (const g of gy) { x.beginPath(); x.moveTo(ox - 90, Y(g)); x.lineTo(X(12.4) + 40, Y(g)); x.stroke(); }
  x.setLineDash([]);
  x.font = `700 30px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  gx.forEach((g, i) => { x.strokeStyle = NAVY; x.lineWidth = 3; x.beginPath(); x.arc(X(g), oy - 112, 24, 0, 7); x.stroke(); x.fillStyle = NAVY; x.fillText('ABCD'[i], X(g), oy - 111); });
  gy.forEach((g, i) => { x.beginPath(); x.arc(ox - 112, Y(g), 24, 0, 7); x.stroke(); x.fillText(String(i + 1), ox - 112, Y(g) + 1); });
  // rooms (light fills), then walls
  x.fillStyle = 'rgba(58,74,102,.08)'; x.fillRect(X(0), Y(0), 12.4 * s, 8.6 * s);
  x.fillStyle = 'rgba(214,177,96,.16)'; x.fillRect(X(4.2), Y(0), 4 * s, 4.6 * s);
  x.strokeStyle = NAVY; x.lineWidth = 16; x.lineJoin = 'miter';
  x.strokeRect(X(0), Y(0), 12.4 * s, 8.6 * s);
  x.lineWidth = 9;
  const wall = (a: number, b: number, c: number, d: number) => { x.beginPath(); x.moveTo(X(a), Y(b)); x.lineTo(X(c), Y(d)); x.stroke(); };
  wall(4.2, 0, 4.2, 3.4); wall(4.2, 4.4, 4.2, 8.6); wall(8.2, 0, 8.2, 2.6); wall(8.2, 3.6, 8.2, 8.6); wall(0, 4.6, 3.0, 4.6); wall(8.2, 4.6, 12.4, 4.6); wall(4.2, 6.4, 6.2, 6.4);
  // door swings
  x.lineWidth = 3;
  const door = (cx: number, cy: number, r: number, a0: number, a1: number) => { x.beginPath(); x.moveTo(X(cx), Y(cy)); x.arc(X(cx), Y(cy), r * s, a0, a1); x.closePath(); x.stroke(); };
  door(4.2, 3.4, 0.9, Math.PI * 0.5, Math.PI); door(8.2, 2.6, 0.9, 0, Math.PI * 0.5); door(3.0, 4.6, 0.9, 0, Math.PI * 0.5); door(6.0, 8.6, 1.0, Math.PI, Math.PI * 1.5);
  // windows: gaps with double lines in the outer wall
  x.fillStyle = CLAY;
  for (const [a, b, w, h] of [[1.2, -0.12, 1.8, 0.24], [9.6, -0.12, 1.8, 0.24], [1.4, 8.48, 1.6, 0.24], [9.4, 8.48, 1.8, 0.24], [12.28, 1.6, 0.24, 1.6], [-0.12, 5.8, 0.24, 1.6]]) {
    x.fillRect(X(a), Y(b), w * s, h * s);
    x.strokeStyle = NAVY; x.lineWidth = 3; x.strokeRect(X(a), Y(b), w * s, h * s);
  }
  // stairs
  x.lineWidth = 2;
  for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(X(4.4 + i * 0.22), Y(6.6)); x.lineTo(X(4.4 + i * 0.22), Y(8.4)); x.stroke(); }
  // room labels
  x.fillStyle = NAVY; x.font = `600 26px ${FONT}`;
  for (const [t, a, b] of [['LIVING', 2.1, 2.3], ['KITCHEN', 6.2, 2.3], ['BED 1', 10.3, 2.3], ['BED 2', 10.3, 6.6], ['DINING', 2.1, 6.6]] as [string, number, number][]) x.fillText(t, X(a), Y(b));
  // gold dimension strings
  x.strokeStyle = INK_GOLD; x.fillStyle = INK_GOLD; x.lineWidth = 3; x.font = `700 26px ${FONT}`;
  const tick = (px: number, py: number) => { x.beginPath(); x.moveTo(px - 9, py + 9); x.lineTo(px + 9, py - 9); x.stroke(); };
  const dimH = (a: number, b: number, yy: number, label: string) => {
    x.beginPath(); x.moveTo(X(a), yy); x.lineTo(X(b), yy); x.stroke(); tick(X(a), yy); tick(X(b), yy);
    x.fillText(label, (X(a) + X(b)) / 2, yy - 20);
  };
  const dimV = (a: number, b: number, xx: number, label: string) => {
    x.beginPath(); x.moveTo(xx, Y(a)); x.lineTo(xx, Y(b)); x.stroke(); tick(xx, Y(a)); tick(xx, Y(b));
    x.save(); x.translate(xx + 22, (Y(a) + Y(b)) / 2); x.rotate(-Math.PI / 2); x.fillText(label, 0, 0); x.restore();
  };
  const by = Y(8.6) + 70;
  dimH(0, 4.2, by, '4.20'); dimH(4.2, 8.2, by, '4.00'); dimH(8.2, 12.4, by, '4.20'); dimH(0, 12.4, by + 56, '12.40');
  const rx = X(12.4) + 70;
  dimV(0, 4.6, rx, '4.60'); dimV(4.6, 8.6, rx, '4.00'); dimV(0, 8.6, rx + 56, '8.60');
  // title block
  x.textAlign = 'left'; x.strokeStyle = NAVY; x.lineWidth = 3;
  x.strokeRect(W - 400, H - 150, 370, 120);
  x.fillStyle = NAVY; x.font = `700 26px ${FONT}`; x.fillText('GROUND FLOOR PLAN', W - 380, H - 108);
  x.font = `500 22px ${FONT}`; x.fillText('Villa  ·  Scale 1:100', W - 380, H - 66);
}

// The sheet as a strip of columns: flat up to the unroll front, then wound into a spiral roll.
function paper(bag: Bag, L: number, W: number, seg: number) {
  const g = new THREE.BufferGeometry();
  const n = (seg + 1) * 2, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx: number[] = [];
  for (let j = 0; j <= seg; j++) {
    uv.set([j / seg, 1, j / seg, 0], j * 4);
    if (j < seg) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  bag.add(g);
  const T = 0.0032, RC = 0.011; // layer thickness, core radius
  let last = -1;
  // u: 0 = fully rolled at x = 0, 1 = flat out to x = L
  const set = (u: number) => {
    if (u === last) return;
    last = u;
    const flat = u * L, R = Math.sqrt(RC * RC + (T * L * (1 - u)) / Math.PI);
    const rAt = (th: number) => Math.max(RC * 0.8, R - (T * th) / (Math.PI * 2));
    let th = 0, prev = flat;
    for (let j = 0; j <= seg; j++) {
      const s = (j / seg) * L;
      let px: number, py: number, nx = 0, ny = 1;
      if (s <= flat) { px = s; py = 0; }
      else {
        th += (s - prev) / rAt(th);
        prev = s;
        const r = rAt(th);
        px = flat + r * Math.sin(th); py = R - r * Math.cos(th);
        nx = -Math.sin(th); ny = Math.cos(th);
      }
      for (let k = 0; k < 2; k++) {
        const i = j * 2 + k;
        pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = k === 0 ? -W / 2 : W / 2;
        nor[i * 3] = nx; nor[i * 3 + 1] = ny; nor[i * 3 + 2] = 0;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
  };
  return { g, set };
}

// ---- the take-off model: footings, columns, beams, slabs as one fill mesh + one edge mesh, coloured per vertex ----
interface Member { vol: number; f0: number; f1: number; e0: number; e1: number; at: number }
function takeoffModel(bag: Bag) {
  const boxes: [number, number, number, number, number, number][] = []; // cx, cy, cz, sx, sy, sz
  const xs = [-0.14, 0, 0.14], zs = [-0.09, 0.09], H = 0.12, c = 0.02;
  for (const x of xs) for (const z of zs) boxes.push([x, 0.008, z, 0.05, 0.016, 0.05]);
  for (let f = 0; f < 2; f++) {
    const y0 = 0.016 + f * H;
    for (const x of xs) for (const z of zs) boxes.push([x, y0 + H / 2, z, c, H, c]);
    const yb = y0 + H - 0.011;
    for (const z of zs) for (let i = 0; i < 2; i++) boxes.push([(xs[i] + xs[i + 1]) / 2, yb, z, 0.14, 0.022, 0.016]);
    for (const x of xs) boxes.push([x, yb, 0, 0.016, 0.022, 0.18]);
    boxes.push([0, y0 + H + 0.006, 0, 0.32, 0.012, 0.22]);
  }
  const fill: THREE.BufferGeometry[] = [], edge: THREE.BufferGeometry[] = [], members: Member[] = [];
  let fv = 0, ev = 0, total = 0;
  for (const [x, y, z, sx, sy, sz] of boxes) {
    const b = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed().translate(x, y, z);
    const e = new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz)).translate(x, y, z);
    const vol = sx * sy * sz;
    total += vol;
    members.push({ vol, f0: fv, f1: fv + b.attributes.position.count, e0: ev, e1: ev + e.attributes.position.count, at: 0 });
    fv += b.attributes.position.count; ev += e.attributes.position.count;
    fill.push(b); edge.push(e);
  }
  members.forEach((m, i) => { m.vol = (m.vol / total) * CONCRETE; m.at = 0.4 + (i / members.length) * 0.34; });
  const fillG = merge(bag, fill), edgeG = bag.add(new THREE.BufferGeometry());
  const ep = new Float32Array(ev * 3);
  let o = 0;
  for (const e of edge) { ep.set(e.attributes.position.array as Float32Array, o); o += e.attributes.position.count * 3; e.dispose(); }
  edgeG.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const fc = new Float32Array(fv * 4), ec = new Float32Array(ev * 3);
  fillG.setAttribute('color', new THREE.BufferAttribute(fc, 4));
  edgeG.setAttribute('color', new THREE.BufferAttribute(ec, 3));
  const fillM = bag.add(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
  const edgeM = bag.add(new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false }));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(fillG, fillM), new THREE.LineSegments(edgeG, edgeM));
  const gold = new THREE.Color(COLOURS.gold), dim = new THREE.Color(COLOURS.clay);
  let last = -1;
  // returns the measured quantity so far (m³)
  const measure = (p: number) => {
    let q = 0;
    for (const m of members) q += m.vol * ease(m.at, m.at + 0.03, p);
    if (p === last) return q;
    last = p;
    for (const m of members) {
      const k = ease(m.at, m.at + 0.03, p), flash = hump(m.at - 0.004, m.at + 0.015, m.at + 0.02, m.at + 0.06, p);
      const eb = 0.32 * (1 - k) + 1.5 * k + 1.6 * flash; // edge brightness (above 1 blooms)
      const fa = 0.07 * (1 - k) + 0.42 * k + 0.25 * flash;
      for (let i = m.e0; i < m.e1; i++) {
        ec[i * 3] = (dim.r * (1 - k) + gold.r * k) * eb; ec[i * 3 + 1] = (dim.g * (1 - k) + gold.g * k) * eb; ec[i * 3 + 2] = (dim.b * (1 - k) + gold.b * k) * eb;
      }
      for (let i = m.f0; i < m.f1; i++) {
        fc[i * 4] = (dim.r * (1 - k) + gold.r * k) * (1 + flash); fc[i * 4 + 1] = (dim.g * (1 - k) + gold.g * k) * (1 + flash); fc[i * 4 + 2] = (dim.b * (1 - k) + gold.b * k) * (1 + flash); fc[i * 4 + 3] = fa;
      }
    }
    fillG.attributes.color.needsUpdate = true;
    edgeG.attributes.color.needsUpdate = true;
    return q;
  };
  return { group, measure };
}

// ---- calculator: navy body, instanced clay keys, gold equals key, a display whose digits tick up ----
function calculator(bag: Bag, kit: Kit) {
  const P = kit.palette, g = new THREE.Group(), W = 0.15, D = 0.22;
  const bodyG = bag.add(roundedSlab(W, D, 0.022, 0.018));
  bodyG.rotateX(-Math.PI / 2);
  const body = new THREE.Mesh(bodyG, P.navy);
  body.position.y = 0.011;
  body.add(goldEdges(bag, kit, bodyG, 40));
  const keyG = bag.add(roundedSlab(0.022, 0.015, 0.008, 0.005));
  keyG.rotateX(-Math.PI / 2);
  const keys = new THREE.InstancedMesh(keyG, P.slate, 19);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
    if (r === 4 && c === 3) continue; // the equals key is gold, below
    keys.setMatrixAt(k++, m.makeTranslation(-0.045 + c * 0.03, 0.024, -0.012 + r * 0.024));
  }
  const eq = new THREE.Mesh(keyG, P.gold);
  eq.position.set(-0.045 + 3 * 0.03, 0.024, -0.012 + 4 * 0.024);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 176;
  const x = c.getContext('2d')!;
  const tex = bag.add(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(0.12, 0.041)), screenMat(bag, tex));
  disp.rotation.x = -Math.PI / 2;
  disp.position.set(0, 0.0225, -0.068);
  g.add(body, keys, eq, disp);
  let shown = -1;
  const show = (q: number) => {
    const n = Math.round(q * 10);
    if (n === shown) return;
    shown = n;
    x.fillStyle = '#0a1326'; x.fillRect(0, 0, 512, 176);
    x.fillStyle = 'rgba(233,226,212,.7)'; x.font = `700 34px ${FONT}`; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillText('CONCRETE', 26, 52);
    x.fillStyle = GOLD; x.font = `700 92px ${FONT}`; x.textAlign = 'center';
    // right-aligned fixed-width digits, drawn one by one (no string building per frame)
    const cell = 54, right = 400;
    x.fillText(DIGITS[n % 10], right - cell / 2, 150);
    x.fillText('.', right - cell - 10, 150);
    let v = Math.floor(n / 10), i = 0;
    do { x.fillText(DIGITS[v % 10], right - cell * 1.4 - cell * (i + 0.5), 150); v = Math.floor(v / 10); i++; } while (v > 0);
    x.font = `700 44px ${FONT}`; x.textAlign = 'left'; x.fillText('m³', right + 14, 150);
    tex.needsUpdate = true;
  };
  return { g, show };
}

// ---- tape measure: navy case, a gold blade with ticks that runs out along the drawing ----
function tape(bag: Bag, kit: Kit) {
  const P = kit.palette, g = new THREE.Group();
  const caseG = bag.add(roundedSlab(0.085, 0.085, 0.038, 0.03));
  const body = new THREE.Mesh(caseG, P.navy);
  body.position.y = 0.0425;
  body.add(goldEdges(bag, kit, caseG, 40));
  const hub = new THREE.Mesh(merge(bag, [placed(new THREE.CylinderGeometry(0.026, 0.026, 0.044, 28), 0, 0.0425, 0, Math.PI / 2)]), P.slate);
  const bladeTex = canvasTex(bag, 1024, 32, (x, w, h) => {
    x.fillStyle = GOLD; x.fillRect(0, 0, w, h);
    x.fillStyle = NAVY;
    for (let i = 0; i < w; i += 16) x.fillRect(i, 0, 2, i % 80 === 0 ? 18 : 9);
  });
  bladeTex.wrapS = THREE.RepeatWrapping;
  const bladeMat = bag.add(new THREE.MeshStandardMaterial({ map: bladeTex, roughness: 0.4, metalness: 0.5 }));
  const bladeG = bag.add(new THREE.BoxGeometry(1, 0.0015, 0.02));
  bladeG.translate(0.5, 0, 0);
  const blade = new THREE.Mesh(bladeG, bladeMat);
  blade.position.set(0.035, 0.002, 0);
  const hook = new THREE.Mesh(bag.add(new THREE.BoxGeometry(0.004, 0.014, 0.022)), P.gold);
  hook.position.set(0.035, 0.007, 0);
  g.add(body, hub, blade, hook);
  const set = (len: number) => {
    blade.scale.x = Math.max(0.0001, len);
    blade.visible = len > 0.001;
    bladeTex.repeat.x = len / 0.4;
    hook.position.x = 0.035 + len;
  };
  return { g, set };
}

function boqTex(bag: Bag) {
  const W = 640, H = 420, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const tex = bag.add(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = (filled: boolean) => {
    x.fillStyle = '#0c1730'; x.fillRect(0, 0, W, H);
    x.fillStyle = GOLD; x.font = `700 44px ${FONT}`; x.textAlign = 'left'; x.fillText('Bill of quantities', 36, 70);
    BOQ.forEach(([item, qty], i) => {
      const y = 104 + i * 60, cur = i === 1;
      x.fillStyle = cur ? 'rgba(214,177,96,.2)' : i % 2 ? 'rgba(233,226,212,.05)' : 'rgba(0,0,0,0)';
      rr(x, 24, y, W - 48, 52, 10); x.fill();
      x.fillStyle = cur ? GOLD : CLAY; x.font = `600 30px ${FONT}`; x.textAlign = 'left'; x.fillText(item, 44, y + 36);
      x.textAlign = 'right';
      if (!cur || filled) x.fillText(qty, W - 44, y + 36);
      else { x.fillStyle = 'rgba(214,177,96,.6)'; x.fillText('measuring', W - 44, y + 36); }
    });
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

const qs: SceneFactory = async (kit) => {
  const P = kit.palette, bag = new Bag();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  lights(scene, 0.5);
  const drift = new Drift();
  const laptop = (await kit.loadGLB('laptop')).scene;

  // desk: a navy slab with gold edges, top at y = 0 (metres throughout)
  const world = new THREE.Group();
  scene.add(world);
  const deskG = bag.add(roundedSlab(1.6, 0.98, 0.06, 0.08));
  deskG.rotateX(-Math.PI / 2);
  const desk = new THREE.Mesh(deskG, P.navy);
  desk.position.y = -0.03;
  desk.add(goldEdges(bag, kit, deskG, 30));
  world.add(desk);
  drift.add(desk, [0, -0.25, 0], 0);

  // the drawing: fixed left edge at x = -0.52, unrolls toward +x
  const L = 0.78, Wd = 0.544, sheet = new THREE.Group();
  const planTex = canvasTex(bag, 1434, 1000, drawPlan);
  const pp = paper(bag, L, Wd, kit.quality === 'low' ? 72 : 140);
  const front = new THREE.Mesh(pp.g, bag.add(new THREE.MeshStandardMaterial({ map: planTex, roughness: 0.85, emissiveMap: planTex, emissive: 0xffffff, emissiveIntensity: 0.22 })));
  const back = new THREE.Mesh(pp.g, bag.add(new THREE.MeshStandardMaterial({ color: COLOURS.clay, roughness: 0.85, side: THREE.BackSide })));
  front.position.y = back.position.y = 0.002;
  const sheetShadow = blob(bag, 1, Wd + 0.12, 0.55);
  sheetShadow.position.set(L / 2, 0.001, 0);
  sheet.add(sheetShadow, front, back);
  sheet.position.set(-0.44, 0, 0.13);
  world.add(sheet);
  drift.add(sheet, [-0.3, 0.45, 0.1], 0.15, 0.4);

  // take-off model of the drawn frame, back left (rises once the plan is open)
  const model = takeoffModel(bag);
  const modelBase = new THREE.Group();
  modelBase.position.set(-0.36, 0, -0.27);
  modelBase.rotation.y = 0.25;
  modelBase.add(model.group);
  model.group.scale.setScalar(1.45);
  const modelShadow = blob(bag, 0.62, 0.45, 0.5);
  modelShadow.position.set(-0.36, 0.001, -0.27);
  world.add(modelShadow);
  drift.add(modelShadow, [0, 0, 0], 0.2);
  world.add(modelBase);

  // tape measure on the drawing's front edge; its blade runs along the plan's bottom dimension
  const tp = tape(bag, kit);
  tp.g.position.set(-0.6, 0, 0.44);
  tp.g.scale.setScalar(1.4);
  const tpShadow = blob(bag, 0.16, 0.12, 0.6);
  tpShadow.position.y = 0.001;
  tp.g.add(tpShadow);
  world.add(tp.g);
  drift.add(tp.g, [-0.35, 0.35, 0.25], 0.5, 0.8);

  // calculator, right
  const calc = calculator(bag, kit);
  calc.g.position.set(0.56, 0, 0.27);
  calc.g.rotation.y = -0.22;
  calc.g.scale.setScalar(1.7);
  const calcShadow = blob(bag, 0.26, 0.34, 0.6);
  calcShadow.position.y = 0.001;
  calc.g.add(calcShadow);
  world.add(calc.g);
  drift.add(calc.g, [0.35, 0.4, 0.2], 0.4, -0.7);
  calc.show(0);

  // laptop (GLB) back right, showing the bill of quantities
  const boq = boqTex(bag);
  boq.draw(false);
  fitScreen(bag, kit, laptop, screenMat(bag, boq.tex));
  laptop.scale.setScalar(1.5);
  const lap = new THREE.Group();
  lap.add(laptop);
  const lapShadow = blob(bag, 0.62, 0.55, 0.6);
  lapShadow.position.y = 0.001;
  lap.add(lapShadow);
  lap.position.set(0.32, 0, -0.26);
  lap.rotation.y = -0.38;
  world.add(lap);
  drift.add(lap, [0.3, 0.5, -0.2], 0.3, -0.5);

  const framer = new Framer(camera, new THREE.Vector3(0, 0.08, 0.0), [0, 0.72, 1], 1.0, 0.52);
  let filled = false;

  return {
    scene,
    camera,
    update(p, _dt, t) {
      drift.apply(p);
      // unroll 0.18..0.34, roll back up 0.8..0.9
      pp.set(ease(0.18, 0.34, p) * (1 - ease(0.79, 0.9, p)));
      // tape runs out 0.32..0.44 and back in 0.76..0.84
      tp.set(0.5 * ease(0.32, 0.44, p) * (1 - ease(0.76, 0.84, p)));
      // the model rises from the plan 0.3..0.42 and sinks back 0.78..0.86
      const rise = ease(0.3, 0.42, p) * (1 - ease(0.78, 0.86, p));
      modelBase.visible = rise > 0.002;
      modelBase.scale.set(1, Math.max(0.001, rise), 1);
      const q = model.measure(p);
      calc.show(q * (1 - ease(0.84, 0.9, p)));
      const f = p > 0.76;
      if (f !== filled) { filled = f; boq.draw(f); }
      framer.update(t);
    },
    dispose() { bag.dispose(); laptop.traverse((m) => (m as THREE.Mesh).geometry?.dispose()); },
  };
};
export default qs;
