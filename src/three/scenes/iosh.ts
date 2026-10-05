// IOSH Level 3 (occupational safety): a safety kit (hard hat, hi-vis vest on a display form, gloves, boots,
// goggles) drifts in and settles on a low plinth; then a small site vignette (scaffold corner, barrier,
// warning sign) rises behind it and its hazard zones glow amber one at a time while a tablet's risk
// assessment ticks each one off. Progress: 0-0.18 arrive, 0.18-0.82 the assessment, 0.82-1 drift out.
import * as THREE from 'three';
import type { SceneFactory, Kit } from '../types';
import { COLOURS } from '../palette';
import { Bag, Drift, Framer, blob, ease, FONT, goldEdges, hump, lights, merge, placed, roundedSlab, rr, screenMat } from './lib/course-a-kit';

const RISKS = ['Work at height', 'Open excavation', 'Signs and barriers'];
const PEAK = [0.36, 0.5, 0.64]; // when each hazard zone glows brightest

// ---- props: the hard hat is code-built; vest, gloves, boots and goggles are GLBs (public/three/CATALOG.md) ----
function hardHat(bag: Bag, kit: Kit) {
  const P = kit.palette, g = new THREE.Group(), R = 0.33, H = 0.3;
  const shellPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; shellPts.push(new THREE.Vector2(R * Math.cos(a) + 0.0001, H * Math.pow(Math.sin(a), 0.85))); }
  const shell = new THREE.LatheGeometry(shellPts, 48);
  // brim: a thin annulus, stretched into a peak at the front (+z)
  const brim = new THREE.LatheGeometry([new THREE.Vector2(R + 0.055, 0.012), new THREE.Vector2(R + 0.05, 0.03), new THREE.Vector2(R - 0.01, 0.045), new THREE.Vector2(R - 0.01, 0.005), new THREE.Vector2(R + 0.055, 0.012)].reverse(), 64);
  const pos = brim.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z), extra = r - (R - 0.01);
    if (extra <= 0) continue;
    const f = Math.pow(Math.max(0, z / r), 2);
    const k = (R - 0.01 + extra * (1 + 1.6 * f)) / r;
    pos.setXYZ(i, x * k, pos.getY(i) - f * extra * 0.35, z * k);
  }
  brim.computeVertexNormals();
  const ridge = (x: number, s: number) => placed(new THREE.TorusGeometry(R * s, 0.022, 8, 40, Math.PI), x, 0.02, 0, 0, Math.PI / 2, 0, [1, (H / R) * 1.02, 1]);
  const body = new THREE.Mesh(merge(bag, [shell, brim, ridge(0, 1.0), ridge(0.1, 0.94), ridge(-0.1, 0.94)]), P.orange);
  const trim = new THREE.Mesh(merge(bag, [
    placed(new THREE.TorusGeometry(R + 0.004, 0.012, 8, 64), 0, 0.05, 0, Math.PI / 2),
    placed(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), 0, 0.16, R * 0.86, Math.PI / 2 - 0.55),
  ]), P.gold);
  const harness = new THREE.Mesh(merge(bag, [
    placed(new THREE.TorusGeometry(0.26, 0.016, 6, 40), 0, 0.07, 0, Math.PI / 2, 0, 0, [1, 1.15, 1]),
    placed(new THREE.TorusGeometry(0.24, 0.014, 6, 24, Math.PI), 0, 0.07, 0, 0, Math.PI / 4, 0, [1, 0.75, 1]),
    placed(new THREE.TorusGeometry(0.24, 0.014, 6, 24, Math.PI), 0, 0.07, 0, 0, -Math.PI / 4, 0, [1, 0.75, 1]),
  ]), P.navy);
  g.add(body, trim, harness);
  return g;
}

function tabletTex(bag: Bag) {
  const W = 640, H = 440;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  const tex = bag.add(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // ticks: 0..3 rows ticked; `active` row highlighted
  const draw = (ticks: number, active: number) => {
    x.fillStyle = '#0c1730'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#d6b160'; x.font = `700 50px ${FONT}`; x.fillText('Risk assessment', 40, 84);
    for (let i = 0; i < 3; i++) {
      const y = 120 + i * 104;
      x.fillStyle = i === active ? 'rgba(214,177,96,.2)' : 'rgba(233,226,212,.06)';
      rr(x, 30, y, W - 60, 88, 18); x.fill();
      x.strokeStyle = i < ticks ? '#d6b160' : 'rgba(233,226,212,.4)'; x.lineWidth = 4;
      x.lineWidth = 5; rr(x, 52, y + 22, 44, 44, 10); x.stroke();
      if (i < ticks) { x.beginPath(); x.moveTo(62, y + 44); x.lineTo(72, y + 55); x.lineTo(88, y + 32); x.stroke(); }
      x.fillStyle = '#e9e2d4'; x.font = `600 38px ${FONT}`; x.fillText(RISKS[i], 120, y + 57);
    }
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

// ---- site vignette ----
function scaffold(bag: Bag, kit: Kit, low: boolean) {
  const P = kit.palette, g = new THREE.Group();
  const tubes: THREE.Matrix4[] = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const tube = (a: THREE.Vector3, b: THREE.Vector3) => {
    const d = b.clone().sub(a), len = d.length();
    q.setFromUnitVectors(up, d.normalize());
    tubes.push(m.clone().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1)));
  };
  const W = 0.9, D = 0.5, H = 1.8, lifts = low ? [0.9, 1.8] : [0.6, 1.2, 1.8];
  const xs = [-W / 2, W / 2], zs = [-D / 2, D / 2];
  for (const x of xs) for (const z of zs) tube(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, H + 0.25, z));
  for (const y of lifts) {
    for (const z of zs) tube(new THREE.Vector3(-W / 2 - 0.08, y, z), new THREE.Vector3(W / 2 + 0.08, y, z));
    for (const x of xs) tube(new THREE.Vector3(x, y, -D / 2 - 0.06), new THREE.Vector3(x, y, D / 2 + 0.06));
  }
  tube(new THREE.Vector3(-W / 2, 0.05, -D / 2), new THREE.Vector3(W / 2, lifts[1] - 0.02, -D / 2)); // face brace
  tube(new THREE.Vector3(-W / 2, H + 0.12, D / 2), new THREE.Vector3(W / 2, H + 0.12, D / 2)); // guard rail
  const inst = new THREE.InstancedMesh(bag.add(new THREE.CylinderGeometry(0.018, 0.018, 1, 8)), P.slate, tubes.length);
  tubes.forEach((t, i) => inst.setMatrixAt(i, t));
  const boardsG = merge(bag, lifts.map((y) => placed(new THREE.BoxGeometry(W + 0.05, 0.03, D - 0.04), 0, y + 0.03, 0)));
  const boards = new THREE.Mesh(boardsG, P.clay);
  const toe = new THREE.Mesh(merge(bag, [placed(new THREE.BoxGeometry(W + 0.05, 0.08, 0.015), 0, H + 0.08, D / 2 - 0.02)]), P.orange);
  const plates = new THREE.Mesh(merge(bag, [-1, 1].flatMap((sx) => [-1, 1].map((sz) => placed(new THREE.BoxGeometry(0.1, 0.012, 0.1), sx * W / 2, 0.006, sz * D / 2)))), P.gold);
  g.add(inst, boards, toe, plates);
  return g;
}

function barrier(bag: Bag, kit: Kit) {
  const P = kit.palette, g = new THREE.Group(), W = 0.95, H = 0.5;
  // a pedestrian barrier: orange frame, clay infill, two feet
  const frame = merge(bag, [
    placed(new THREE.BoxGeometry(W, 0.05, 0.03), 0, H, 0), placed(new THREE.BoxGeometry(W, 0.05, 0.03), 0, 0.12, 0),
    placed(new THREE.BoxGeometry(0.04, H, 0.03), -W / 2, H / 2 + 0.03, 0), placed(new THREE.BoxGeometry(0.04, H, 0.03), W / 2, H / 2 + 0.03, 0),
    ...[-0.3, -0.1, 0.1, 0.3].map((x) => placed(new THREE.BoxGeometry(0.035, H - 0.4 + 0.33, 0.02), x, 0.31, 0)),
  ]);
  const feet = merge(bag, [placed(new THREE.BoxGeometry(0.08, 0.04, 0.3), -W / 2 + 0.05, 0.02, 0), placed(new THREE.BoxGeometry(0.08, 0.04, 0.3), W / 2 - 0.05, 0.02, 0)]);
  g.add(new THREE.Mesh(frame, P.orange), new THREE.Mesh(feet, P.navy));
  return g;
}

function sign(bag: Bag, kit: Kit) {
  const P = kit.palette, g = new THREE.Group();
  const tri = new THREE.Shape(), s = 0.36;
  tri.moveTo(0, s); tri.lineTo(s * 0.92, -s * 0.55); tri.lineTo(-s * 0.92, -s * 0.55); tri.lineTo(0, s);
  const plateG = new THREE.ExtrudeGeometry(tri, { depth: 0.025, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.01, bevelSegments: 2 });
  const plate = new THREE.Mesh(bag.add(plateG), P.clay);
  plate.position.y = 0.95;
  plate.add(goldEdges(bag, kit, plateG, 40));
  const mark = new THREE.Mesh(merge(bag, [placed(new THREE.BoxGeometry(0.045, 0.2, 0.02), 0, 0.05, 0.04), placed(new THREE.BoxGeometry(0.05, 0.05, 0.02), 0, -0.12, 0.04)]), P.navy);
  plate.add(mark);
  const post = new THREE.Mesh(merge(bag, [placed(new THREE.CylinderGeometry(0.022, 0.022, 0.8, 10), 0, 0.4, -0.02), placed(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 24), 0, 0.02, -0.02)]), P.slate);
  g.add(plate, post);
  return g;
}

function hazardRing(bag: Bag, r: number, sx = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,190,90,0.0)');
  gr.addColorStop(0.55, 'rgba(255,190,90,0.35)');
  gr.addColorStop(0.82, 'rgba(255,200,110,1)');
  gr.addColorStop(0.9, 'rgba(255,190,90,0.5)');
  gr.addColorStop(1, 'rgba(255,190,90,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const map = bag.add(new THREE.CanvasTexture(c));
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = bag.add(new THREE.MeshBasicMaterial({ map, color: new THREE.Color(COLOURS.gold).multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const m = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(r * 2 * sx, r * 2)), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return { m, mat };
}


// Loads a GLB prop and returns its root (already recoloured to the palette).
async function prop(kit: Kit, name: string) {
  return (await kit.loadGLB(name)).scene;
}

const iosh: SceneFactory = async (kit) => {
  const P = kit.palette, bag = new Bag(), low = kit.quality === 'low';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
  lights(scene, 0.6);
  const drift = new Drift();
  const [vest, gloves, boots, goggles] = await Promise.all(['hi-vis-vest', 'safety-gloves', 'safety-boots', 'safety-goggles'].map((n) => prop(kit, n)));

  // Everything in metres. A wide navy base; the kit stands on a raised slate plinth at the front.
  const world = new THREE.Group();
  scene.add(world);
  const baseG = bag.add(roundedSlab(2.3, 1.55, 0.07, 0.12));
  baseG.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(baseG, P.navy);
  base.position.set(0, -0.115, -0.3);
  base.add(goldEdges(bag, kit, baseG, 30));
  world.add(base);
  drift.add(base, [0, -0.3, 0], 0);

  const plinthG = bag.add(roundedSlab(1.5, 0.66, 0.08, 0.07));
  plinthG.rotateX(-Math.PI / 2);
  const plinth = new THREE.Mesh(plinthG, P.slate);
  plinth.position.set(0, -0.04, 0.12);
  plinth.add(goldEdges(bag, kit, plinthG, 30));
  world.add(plinth);
  drift.add(plinth, [0, -0.25, 0.1], 0.1);

  // each kit item sits on the plinth top (y = 0) with its own soft contact shadow
  const place = (o: THREE.Object3D, x: number, z: number, ry: number, sw: number, sd: number, from: [number, number, number], lag: number, spin: number, s = 0.55) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const b = blob(bag, sw, sd, s);
    b.position.y = 0.002;
    g.add(b, o);
    world.add(g);
    drift.add(g, from, lag, spin);
    return g;
  };
  place(vest, -0.12, -0.06, 0.1, 0.85, 0.6, [0, 0.7, -0.2], 0.25, 0.5);
  const hat = hardHat(bag, kit);
  hat.scale.setScalar(0.47);
  place(hat, 0.36, 0.24, -0.55, 0.5, 0.5, [0.3, 0.6, 0.3], 0.45, -1.0);
  place(boots, -0.52, 0.16, 0.5, 0.55, 0.5, [-0.5, 0.5, 0.2], 0.35, 0.8);
  place(gloves, 0.56, -0.08, -0.4, 0.42, 0.32, [0.5, 0.45, 0], 0.55, -0.7);
  goggles.scale.setScalar(1.35);
  place(goggles, -0.1, 0.3, 0.15, 0.36, 0.26, [-0.15, 0.5, 0.3], 0.65, 0.7);

  // tablet on a small easel on the base, front right: the risk assessment that ticks off each hazard
  const tab = tabletTex(bag);
  tab.draw(0, -1);
  const tabG = bag.add(roundedSlab(0.44, 0.31, 0.018, 0.025));
  const tabBody = new THREE.Mesh(tabG, P.navy);
  tabBody.add(goldEdges(bag, kit, tabG, 40));
  const tabScreen = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(0.41, 0.282)), screenMat(bag, tab.tex));
  tabScreen.name = 'screen';
  tabScreen.position.z = 0.0095;
  tabBody.add(tabScreen);
  tabBody.position.set(0, 0.165, 0);
  tabBody.rotation.x = -0.3;
  const easel = new THREE.Mesh(merge(bag, [placed(new THREE.BoxGeometry(0.3, 0.014, 0.07), 0, 0.007, 0.03), placed(new THREE.BoxGeometry(0.025, 0.17, 0.015), 0, 0.08, -0.05, -0.35)]), P.slate);
  const tablet = new THREE.Group();
  tablet.add(tabBody, easel);
  tablet.position.set(0.93, -0.08, 0.33);
  tablet.rotation.y = -0.5;
  world.add(tablet);
  drift.add(tablet, [0.4, 0.35, 0.2], 0.8, -0.5);

  // site vignette (a miniature, half scale), behind the plinth; rises in as the action starts
  const site = new THREE.Group();
  site.position.set(0, -0.08, -0.62);
  site.scale.setScalar(0.5);
  world.add(site);
  const scaf = scaffold(bag, kit, low);
  scaf.position.set(-1.25, 0, -0.1);
  scaf.rotation.y = 0.25;
  const bar = barrier(bag, kit);
  bar.position.set(0.95, 0, 0.1);
  bar.rotation.y = -0.1;
  const pit = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(0.85, 0.42)), P.navy);
  pit.rotation.x = -Math.PI / 2;
  pit.position.set(0.95, 0.004, -0.3);
  pit.add(new THREE.LineSegments(bag.add(new THREE.EdgesGeometry(pit.geometry)), P.goldLine));
  const pitBlob = blob(bag, 1.0, 0.55, 0.95);
  pitBlob.position.set(0.95, 0.003, -0.3);
  const sg = sign(bag, kit);
  sg.position.set(1.85, 0, 0.05);
  sg.rotation.y = -0.35;
  site.add(scaf, bar, pit, pitBlob, sg);
  const siteParts: THREE.Object3D[] = [scaf, bar, sg, pit, pitBlob];
  const siteHome = siteParts.map((o) => o.position.y);
  const rings = [hazardRing(bag, 0.85, 1.3), hazardRing(bag, 0.62, 1.6), hazardRing(bag, 0.5)];
  rings[0].m.position.set(-1.25, 0.01, -0.1);
  rings[1].m.position.set(0.95, 0.012, -0.15);
  rings[2].m.position.set(1.85, 0.014, 0.05);
  for (const r of rings) site.add(r.m);

  const framer = new Framer(camera, new THREE.Vector3(0, 0.22, -0.2), [0, 0.62, 1], 1.44, 0.66);
  let ticks = -1, active = -2;

  return {
    scene,
    camera,
    update(p, _dt, t) {
      drift.apply(p);
      // the vignette rises during 0.16..0.3 and sinks away 0.8..0.94
      const rise = ease(0.16, 0.3, p) * (1 - ease(0.8, 0.94, p));
      site.visible = rise > 0.002;
      for (let i = 0; i < siteParts.length; i++) {
        siteParts[i].position.y = siteHome[i] - (1 - rise) * 0.6;
        siteParts[i].scale.y = Math.max(0.001, rise);
      }
      // hazard zones glow one at a time; once assessed they keep a soft low glow
      let tk = 0, ac = -1, best = 0;
      for (let i = 0; i < 3; i++) {
        const h = hump(PEAK[i] - 0.09, PEAK[i] - 0.02, PEAK[i] + 0.02, PEAK[i] + 0.09, p);
        const done = ease(PEAK[i], PEAK[i] + 0.05, p);
        rings[i].mat.opacity = rise * Math.max(h * 0.95, done * 0.22) * (0.9 + 0.1 * Math.sin(t * 0.9 + i));
        if (p > PEAK[i] + 0.02) tk = i + 1;
        if (h > 0.5 && h > best) { best = h; ac = i; }
      }
      if (tk !== ticks || ac !== active) { ticks = tk; active = ac; tab.draw(tk, ac); }
      framer.update(t);
    },
    dispose() { bag.dispose(); [vest, gloves, boots, goggles].forEach((o) => o.traverse((m) => (m as THREE.Mesh).geometry?.dispose())); },
  };
};
export default iosh;
