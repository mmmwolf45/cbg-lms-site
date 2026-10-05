// 3D playground (dev only, never shipped): renders one scene from src/three/scenes on the real stage.
//   npx vite lab3d --port 5180      then open /?scene=site&p=0.5&q=high
// URL params: scene (file name in src/three/scenes), p (progress 0..1), q (high|mid|low), play=1 (auto sweep).
// window.__lab3d.set(p) sets progress from tests; window.__lab3d.ready resolves once the scene is shown.
import { createStage } from '../src/three/stage';
import type { Quality, SceneFactory } from '../src/three/types';

const scenes = import.meta.glob<{ default: SceneFactory }>('../src/three/scenes/*.ts');
const names = Object.keys(scenes).map((k) => k.split('/').pop()!.replace('.ts', '')).filter((n) => !n.startsWith('_') || n === '_demo');
const q = new URLSearchParams(location.search);
const pick = q.get('scene') ?? names[0];
const quality = (q.get('q') ?? 'high') as Quality;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const sel = $<HTMLSelectElement>('scene'), qs = $<HTMLSelectElement>('quality'), range = $<HTMLInputElement>('p'), info = $('info');
sel.innerHTML = names.map((n) => `<option ${n === pick ? 'selected' : ''}>${n}</option>`).join('');
qs.value = quality;
const nav = () => { q.set('scene', sel.value); q.set('q', qs.value); q.set('p', range.value); location.search = q.toString(); };
sel.onchange = nav; qs.onchange = nav;

let progress = Number(q.get('p') ?? 0);
const show = () => { info.textContent = progress.toFixed(2); range.value = String(progress); };
show();
range.oninput = () => { progress = Number(range.value); show(); window.dispatchEvent(new Event('scroll')); };
let playing = q.get('play') === '1';
$('play').onclick = () => { playing = !playing; };
setInterval(() => { if (playing) { progress = (progress + 0.002) % 1; show(); window.dispatchEvent(new Event('scroll')); } }, 16);

const stage = createStage(quality, '/');
stage.mount($('host'));
const ready = (async () => {
  const file = Object.keys(scenes).find((k) => k.endsWith(`/${pick}.ts`));
  if (!file) throw new Error(`no scene ${pick}`);
  const s = await (await scenes[file]()).default(stage.kit);
  await stage.prepare(s);
  stage.play(s, () => progress);
  return s;
})();
(window as unknown as { __lab3d: unknown }).__lab3d = { ready, set: (v: number) => { progress = v; show(); window.dispatchEvent(new Event('scroll')); } };
