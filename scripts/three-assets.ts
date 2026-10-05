// Builds the 3D props in public/three/*.glb from the sources in brand/assets/three/props (licences:
// brand/assets/three/CREDITS.md). Every prop leaves here in the house format the stage expects:
//   - materials renamed to palette swatches (src/three/palette.ts: applyPalette matches by name prefix),
//     no textures, no UVs, so forty objects from three sources read as one "clay + gold" world;
//   - metres, +Y up, facing +Z, origin at the base centre;
//   - monitors/laptops keep their display as a separate node + mesh named "screen" (scenes texture it);
//   - welded, deduplicated, pruned, one primitive per swatch, meshopt-compressed (<= 8k tris, ~<= 60 KB).
// Kenney kits ship flat colours per material, so a lookup table renames them. AI meshes (Tripo) ship one
// baked texture, so each triangle is classified to the nearest of a few prop-specific anchor colours,
// smoothed, simplified and split into one primitive per swatch. Rewrites the props block of
// public/three/CATALOG.md. Run when a source or the table below changes; output is committed.
//
//   npm run three-assets            (all)       npm run three-assets -- monitor vest   (some)
import { readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { Document, Logger, NodeIO, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, getBounds, joinPrimitives, meshopt, prune, transformMesh, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { COLOURS, type Swatch } from '../src/three/palette';

const SRC = 'brand/assets/three/props';
const OUT = 'public/three';
const KENNEY = `${SRC}/kenney-furniture-kit`;
const TRIPO = `${SRC}/tripo`;

type RGB = [number, number, number];
interface Prop {
  what: string;
  src: string;
  // Kenney: source material name -> swatch. Tripo: swatch -> anchor colour sampled from its texture.
  mats?: Record<string, Swatch>;
  anchors?: Partial<Record<Swatch, RGB>>;
  scale?: number; // uniform factor (Kenney's kit is ~half real size)
  fit?: ['x' | 'y' | 'z', number]; // or: scale so this extent is n metres (AI meshes come unit-sized)
  rotY?: number; // degrees, to face +Z (Tripo's fronts come out facing +X)
  maxTris?: number; // AI meshes are simplified to this
  credit: string;
}

const K = (f: string) => `${KENNEY}/${f}.glb`;
const KC = 'Kenney Furniture Kit 2.0, CC0';
const TC = 'Higgsfield Tripo text-to-3D (generated for CBG)';
// Kenney's kit is drawn at ~half real size: desk 0.38 high -> 0.76 m, sofa seat 0.46 -> 0.92 m.
const S = 2;
// Kenney models already face +Z (checked in the _props scene: monitor display towards the camera).
const R = 0;

export const PROPS: Record<string, Prop> = {
  // Desk
  monitor: { what: 'Desktop monitor on a stand; display = node/mesh "screen"', src: K('computerScreen'), scale: 1.5, rotY: R, mats: { metalDark: 'navy', metal: 'screen' }, credit: KC },
  laptop: { what: 'Open laptop; display = node/mesh "screen"', src: K('laptop'), scale: 1.3, rotY: R, mats: { metalDark: 'navy', metalMedium: 'slate', metal: 'screen' }, credit: KC },
  keyboard: { what: 'Desktop keyboard', src: K('computerKeyboard'), scale: 1.5, rotY: R, mats: { metalDark: 'navy', metalMedium: 'slate' }, credit: KC },
  desk: { what: 'Office desk with drawer', src: K('desk'), scale: S, rotY: R, mats: { wood: 'clay', metal: 'gold' }, credit: KC },
  'office-chair': { what: 'Swivel office chair', src: K('chairDesk'), scale: S, rotY: R, mats: { metalMedium: 'navy', carpet: 'clay' }, credit: KC },
  // Interior
  sofa: { what: 'Modern sofa, slim metal frame', src: K('loungeDesignSofa'), scale: S, rotY: R, mats: { carpetBlue: 'clay', metal: 'gold' }, credit: KC },
  'sofa-classic': { what: 'Boxy sofa, wooden base', src: K('loungeSofa'), scale: S, rotY: R, mats: { carpet: 'clay', wood: 'slate' }, credit: KC },
  armchair: { what: 'Modern armchair, slim metal frame', src: K('loungeDesignChair'), scale: S, rotY: R, mats: { carpetBlue: 'clay', metal: 'gold' }, credit: KC },
  'armchair-classic': { what: 'Boxy armchair, wooden base', src: K('loungeChair'), scale: S, rotY: R, mats: { carpet: 'clay', wood: 'slate' }, credit: KC },
  'coffee-table': { what: 'Low coffee table', src: K('tableCoffee'), scale: S, rotY: R, mats: { wood: 'clay' }, credit: KC },
  'coffee-table-glass': { what: 'Coffee table, glass top on a metal frame', src: K('tableCoffeeGlass'), scale: S, rotY: R, mats: { metal: 'gold', glass: 'glass' }, credit: KC },
  'floor-lamp': { what: 'Floor lamp, round shade', src: K('lampRoundFloor'), scale: S, rotY: R, mats: { metal: 'gold', lamp: 'clay' }, credit: KC },
  'floor-lamp-square': { what: 'Floor lamp, square shade', src: K('lampSquareFloor'), scale: S, rotY: R, mats: { metal: 'gold', lamp: 'clay' }, credit: KC },
  'side-table': { what: 'Small side table', src: K('sideTable'), scale: 1.4, rotY: R, mats: { wood: 'clay', _defaultMat: 'gold' }, credit: KC },
  plant: { what: 'Tall potted plant (leaves in slate: the palette has no green)', src: K('pottedPlant'), scale: S, rotY: R, mats: { wood: 'clay', woodDark: 'navy', plant: 'slate' }, credit: KC },
  'plant-small': { what: 'Small desk plant in a pot', src: K('plantSmall2'), scale: S, rotY: R, mats: { wood: 'clay', plant: 'slate' }, credit: KC },
  'rug-rect': { what: 'Rectangular rug, gold border', src: K('rugRectangle'), scale: S, rotY: R, mats: { carpet: 'clay', carpetDarker: 'gold' }, credit: KC },
  'rug-round': { what: 'Round rug, two tones', src: K('rugRound'), scale: S, rotY: R, mats: { carpet: 'slate', carpetDarker: 'navy' }, credit: KC },
  'rug-rounded': { what: 'Rounded-corner rug, two tones', src: K('rugRounded'), scale: S, rotY: R, mats: { carpet: 'clay', carpetDarker: 'slate' }, credit: KC },
  // PPE (IOSH)
  'hi-vis-vest': { what: 'Hi-vis safety vest, gold reflective bands', src: `${TRIPO}/hi-vis-vest.glb`, fit: ['y', 0.7], anchors: { orange: [235, 115, 35], gold: [70, 160, 240] }, rotY: -90, maxTris: 6000, credit: TC },
  'safety-gloves': { what: 'Pair of safety gloves', src: `${TRIPO}/safety-gloves.glb`, fit: ['z', 0.3], anchors: { orange: [235, 150, 40], slate: [70, 70, 75] }, rotY: -90, maxTris: 6000, credit: TC },
  'safety-boots': { what: 'Pair of safety boots, brown leather toes', src: `${TRIPO}/safety-boots.glb`, fit: ['y', 0.3], anchors: { rebar: [205, 145, 85], navy: [45, 42, 45], slate: [115, 112, 112] }, rotY: -90, maxTris: 6000, credit: TC },
  'safety-goggles': { what: 'Safety goggles with strap', src: `${TRIPO}/safety-goggles.glb`, fit: ['x', 0.19], anchors: { glass: [140, 200, 220], slate: [55, 55, 62] }, rotY: -90, maxTris: 6000, credit: TC },
};

// Column-major 4x4: rotate about Y by deg, then uniform scale s, then translate.
const mat = (deg = 0, s = 1, t: RGB = [0, 0, 0]) => {
  const c = Math.cos((deg * Math.PI) / 180) * s, n = Math.sin((deg * Math.PI) / 180) * s;
  return [c, 0, -n, 0, 0, s, 0, 0, n, 0, c, 0, t[0], t[1], t[2], 1] as const;
};
// Base colours too, so the files also look right in any glTF viewer (palette.ts overrides them at runtime).
const srgb = (hex: number): [number, number, number, number] => {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return [lin((hex >> 16) & 255), lin((hex >> 8) & 255), lin(hex & 255), 1];
};
const quiet = new Logger(Logger.Verbosity.WARN);
const tris = (p: Primitive) => (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3;

// All meshes of the source scene, with node transforms baked in.
function bakedPrimitives(doc: Document): Primitive[] {
  const out: Primitive[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    transformMesh(mesh, node.getWorldMatrix() as unknown as Parameters<typeof transformMesh>[1]);
    out.push(...mesh.listPrimitives());
  }
  return out;
}

// Kenney: rename by table. Unknown materials fail loudly so a kit update can't slip through as clay.
function fromKenney(doc: Document, prop: Prop, name: string) {
  return bakedPrimitives(doc).map((p) => {
    const src = p.getMaterial()?.getName() ?? '';
    const swatch = prop.mats![src];
    if (!swatch) throw new Error(`${name}: no swatch for material "${src}"`);
    return { prim: p, swatch };
  });
}

// Tripo: one textured mesh -> per-triangle swatch (nearest anchor, smoothed) -> simplified -> split.
async function fromTexture(doc: Document, prop: Prop, name: string) {
  const prims = bakedPrimitives(doc);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let tex: { data: Buffer; w: number; h: number } | undefined;
  for (const p of prims) {
    const base = pos.length / 3;
    const P = p.getAttribute('POSITION')!, T = p.getAttribute('TEXCOORD_0')!;
    for (let i = 0; i < P.getCount(); i++) { pos.push(...P.getElement(i, [0, 0, 0])); uv.push(...T.getElement(i, [0, 0])); }
    const I = p.getIndices();
    for (let i = 0; i < (I ? I.getCount() : P.getCount()); i++) idx.push(base + (I ? I.getScalar(i) : i));
    const img = p.getMaterial()?.getBaseColorTexture()?.getImage();
    if (img && !tex) {
      const { data, info } = await sharp(Buffer.from(img)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      tex = { data, w: info.width, h: info.height };
    }
  }
  if (!tex) throw new Error(`${name}: no base colour texture to classify`);
  const sample = (v: number) => {
    const x = Math.min(tex!.w - 1, Math.max(0, Math.floor((uv[v * 2] % 1) * tex!.w)));
    const y = Math.min(tex!.h - 1, Math.max(0, Math.floor((uv[v * 2 + 1] % 1) * tex!.h)));
    const o = (y * tex!.w + x) * 3;
    return [tex!.data[o], tex!.data[o + 1], tex!.data[o + 2]];
  };
  const names = Object.keys(prop.anchors!) as Swatch[];
  const cols = names.map((n) => prop.anchors![n]!);
  const nearest = (c: number[]) => {
    let best = 0, bd = Infinity;
    cols.forEach((a, i) => { const d = (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2 + (a[2] - c[2]) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  };
  // Weld by position (UV seams split vertices in the source).
  const key = new Map<string, number>(), remap: number[] = [], wpos: number[] = [];
  for (let v = 0; v < pos.length / 3; v++) {
    const k = `${pos[v * 3].toFixed(5)},${pos[v * 3 + 1].toFixed(5)},${pos[v * 3 + 2].toFixed(5)}`;
    let w = key.get(k);
    if (w === undefined) { w = wpos.length / 3; key.set(k, w); wpos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
    remap[v] = w;
  }
  const nT = idx.length / 3;
  let label = new Int32Array(nT);
  for (let t = 0; t < nT; t++) {
    const s = [0, 1, 2].map((k) => sample(idx[t * 3 + k]));
    label[t] = nearest([0, 1, 2].map((ch) => (s[0][ch] + s[1][ch] + s[2][ch]) / 3));
  }
  // Majority filter over vertex-adjacent triangles, twice: removes texture speckle.
  const vt: number[][] = Array.from({ length: wpos.length / 3 }, () => []);
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) vt[remap[idx[t * 3 + k]]].push(t);
  const vote = (ts: Iterable<number>, from: Int32Array) => {
    const c = new Array(names.length).fill(0);
    for (const t of ts) c[from[t]]++;
    return c.indexOf(Math.max(...c));
  };
  for (let it = 0; it < 2; it++) {
    const next = new Int32Array(nT);
    for (let t = 0; t < nT; t++) next[t] = vote(new Set([0, 1, 2].flatMap((k) => vt[remap[idx[t * 3 + k]]])), label);
    label = next;
  }
  const vlabel = vt.map((ts) => (ts.length ? vote(ts, label) : 0));
  // Simplify the welded mesh, then give each new triangle its vertices' majority label.
  await MeshoptSimplifier.ready;
  const widx = new Uint32Array(idx.map((v) => remap[v]));
  const target = Math.min(widx.length, prop.maxTris! * 3);
  const [simp] = MeshoptSimplifier.simplify(widx, new Float32Array(wpos), 3, target, 0.01, []);
  const groups = names.map(() => [] as number[]);
  for (let t = 0; t < simp.length / 3; t++) {
    const l = [simp[t * 3], simp[t * 3 + 1], simp[t * 3 + 2]].map((v) => vlabel[v]);
    groups[l[1] === l[2] ? l[1] : l[0]].push(simp[t * 3], simp[t * 3 + 1], simp[t * 3 + 2]);
  }
  // Smooth normals on the welded mesh (area-weighted), so material boundaries don't show a crease.
  const nrm = new Float32Array(wpos.length);
  for (let t = 0; t < simp.length; t += 3) {
    const [a, b, c] = [simp[t], simp[t + 1], simp[t + 2]];
    const u = [0, 1, 2].map((k) => wpos[b * 3 + k] - wpos[a * 3 + k]), w = [0, 1, 2].map((k) => wpos[c * 3 + k] - wpos[a * 3 + k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) nrm[v * 3 + k] += n[k];
  }
  for (let v = 0; v < nrm.length; v += 3) {
    const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]) || 1;
    nrm[v] /= l; nrm[v + 1] /= l; nrm[v + 2] /= l;
  }
  const buf = doc.getRoot().listBuffers()[0];
  const out = groups.flatMap((g, i) => {
    if (!g.length) return [];
    const used = [...new Set(g)], local = new Map(used.map((v, j) => [v, j]));
    const P = doc.createAccessor().setType('VEC3').setBuffer(buf).setArray(new Float32Array(used.flatMap((v) => [wpos[v * 3], wpos[v * 3 + 1], wpos[v * 3 + 2]])));
    const N = doc.createAccessor().setType('VEC3').setBuffer(buf).setArray(new Float32Array(used.flatMap((v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]])));
    const I = doc.createAccessor().setBuffer(buf).setArray(new Uint32Array(g.map((v) => local.get(v)!)));
    return [{ prim: doc.createPrimitive().setAttribute('POSITION', P).setAttribute('NORMAL', N).setIndices(I), swatch: names[i] }];
  });
  for (const p of prims) p.dispose();
  return out;
}

async function build(name: string, prop: Prop) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = (await io.read(prop.src)).setLogger(quiet);
  const parts = prop.anchors ? await fromTexture(doc, prop, name) : fromKenney(doc, prop, name);

  // Fresh, flat structure: node <name> (all swatches) and, for displays, child node "screen".
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  for (const n of scene.listChildren()) scene.removeChild(n);
  const material = new Map<Swatch, ReturnType<Document['createMaterial']>>();
  const body = doc.createMesh(name), screen = doc.createMesh('screen');
  for (const { prim, swatch } of parts) {
    for (const s of prim.listSemantics()) if (s !== 'POSITION' && s !== 'NORMAL') prim.setAttribute(s, null);
    if (!material.has(swatch)) material.set(swatch, doc.createMaterial(swatch).setBaseColorFactor(srgb(COLOURS[swatch])).setRoughnessFactor(0.8).setMetallicFactor(0));
    prim.setMaterial(material.get(swatch)!);
    (swatch === 'screen' ? screen : body).addPrimitive(prim);
  }
  // One primitive per swatch (= one draw call each).
  for (const m of [body, screen]) {
    const by = new Map<Swatch, Primitive[]>();
    for (const p of m.listPrimitives()) {
      const s = p.getMaterial()!.getName() as Swatch;
      by.set(s, [...(by.get(s) ?? []), p]);
      m.removePrimitive(p);
    }
    for (const ps of by.values()) {
      m.addPrimitive(ps.length > 1 ? joinPrimitives(ps) : ps[0]);
    }
  }
  const meshes = [body, ...(screen.listPrimitives().length ? [screen] : [])];

  // Real-world size, facing +Z, origin at the base centre.
  const node = doc.createNode(name).setMesh(body);
  scene.addChild(node);
  if (meshes.length > 1) node.addChild(doc.createNode('screen').setMesh(screen));
  let s = prop.scale ?? 1;
  if (prop.fit) {
    const b = getBounds(scene), ax = { x: 0, y: 1, z: 2 }[prop.fit[0]];
    s = prop.fit[1] / (b.max[ax] - b.min[ax]);
  }
  for (const m of meshes) transformMesh(m, mat(prop.rotY ?? 0, s) as unknown as Parameters<typeof transformMesh>[1]);
  const b = getBounds(scene);
  const t: RGB = [-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2];
  for (const m of meshes) transformMesh(m, mat(0, 1, t) as unknown as Parameters<typeof transformMesh>[1]);

  await doc.transform(
    weld(),
    dedup({ keepUniqueNames: true }), // swatches differ only by name
    prune({ keepLeaves: false }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const file = `${OUT}/${name}.glb`;
  await io.write(file, doc);
  const fb = getBounds(doc.getRoot().listScenes()[0]);
  return {
    name,
    what: prop.what,
    tris: root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((a, p) => a + tris(p), 0), 0),
    kb: statSync(file).size / 1024,
    mats: [...material.keys()].join(', '),
    size: [0, 1, 2].map((i) => (fb.max[i] - fb.min[i]).toFixed(2)).join(' x '),
    credit: prop.credit,
  };
}

const START = '<!-- props:start (written by scripts/three-assets.ts) -->', END = '<!-- props:end -->';
async function main() {
  await MeshoptEncoder.ready;
  const want = process.argv.slice(2);
  const rows = [];
  for (const [name, prop] of Object.entries(PROPS)) {
    if (want.length && !want.includes(name)) continue;
    if (!existsSync(prop.src)) { console.warn(`skip ${name}: missing ${prop.src}`); continue; }
    const r = await build(name, prop);
    rows.push(r);
    console.log(`${name.padEnd(20)} ${String(r.tris).padStart(5)} tris ${r.kb.toFixed(1).padStart(5)} KB  ${r.mats}`);
    if (r.tris > 8000 || r.kb > 60) console.warn(`  over budget: ${name}`);
  }
  // Rewrite this script's block of the catalogue from what is on disk (so partial runs keep other rows).
  const cat = `${OUT}/CATALOG.md`;
  const fresh = new Map(rows.map((r) => [r.name, r]));
  const old = existsSync(cat) ? readFileSync(cat, 'utf8') : '';
  const oldRows = new Map([...old.matchAll(/^\| `([^`]+)` .*$/gm)].map((m) => [m[1], m[0]]));
  const lines = Object.keys(PROPS).filter((n) => existsSync(`${OUT}/${n}.glb`)).map((n) => {
    const r = fresh.get(n);
    return r ? `| \`${n}\` | ${r.what} | ${r.tris} | ${r.kb.toFixed(1)} | ${r.mats} | ${r.size} | ${r.credit} |` : oldRows.get(n) ?? `| \`${n}\` | (rerun) | | | | | |`;
  });
  const block = [START,
    '| name | what | tris | KB | materials | size W x H x D (m) | source |',
    '|---|---|---|---|---|---|---|', ...lines, END].join('\n');
  const head = `# 3D models (public/three)

Load with \`kit.loadGLB('<name>')\`; materials are already named after palette swatches, so \`applyPalette\`
recolours them. All props: metres, +Y up, facing +Z, origin at the base centre (sit them on y = 0).
Displays (\`monitor\`, \`laptop\`) have a child node/mesh named \`screen\` (material \`screen\`): find it with
\`gltf.scene.getObjectByName('screen')\` and give it your own material/texture. Built by \`npm run three-assets\`
from \`brand/assets/three/props\`; licences in \`brand/assets/three/CREDITS.md\`.
`;
  const next = old.includes(START) ? old.replace(new RegExp(`${START.replace(/[()]/g, '\\$&')}[\\s\\S]*?${END}`), block) : `${old || head}\n${block}\n`;
  writeFileSync(cat, next);
}

main().catch((e) => { console.error(e); process.exit(1); });
