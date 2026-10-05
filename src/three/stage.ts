// The one WebGL canvas every 3D section shares (phones drop contexts when a page holds several). A section
// moves the canvas into its own host element and asks the stage to play its scene; the stage owns the
// renderer, the frame loop, the gold glow (bloom), resizing, pausing and context loss.
//
// Smoothness: sections hand the stage a raw scroll progress (0..1); the stage eases toward it with a
// frame-rate independent damp (time constant ~0.3 s), so a fast flick or a skipped frame never makes a scene
// jump. Rendering stops when the canvas is off screen, the tab is hidden, or nothing is moving.
import * as THREE from 'three';
import { BloomEffect, EffectComposer, EffectPass, RenderPass, VignetteEffect } from 'postprocessing';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { applyPalette, makePalette } from './palette';
import type { Kit, Quality, StageScene } from './types';

const LAMBDA = 3.2; // damping rate (1/s): higher follows the scroll faster

// Picks a starting quality tier from what the browser will tell us. Never steps up during a visit.
export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (nav.connection?.saveData || (nav.deviceMemory ?? 8) <= 3 || (nav.hardwareConcurrency ?? 8) <= 4) return 'low';
  return coarse ? 'mid' : 'high';
}

// Can this browser run the 3D at all? (WebGL2; the sections fall back to their still content otherwise.)
export function canRun3D(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export interface Stage {
  kit: Kit;
  canvas: HTMLCanvasElement;
  mount(host: HTMLElement): void;
  play(scene: StageScene, target: () => number): void;
  stop(): void;
  prepare(scene: StageScene): Promise<void>;
  dispose(): void;
}

export function createStage(quality: Quality = detectQuality(), base = ''): Stage {
  const canvas = document.createElement('canvas');
  canvas.className = 'cbg-stage';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'high', alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.5 : quality === 'mid' ? 1.25 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  // Gold glow: only colours brighter than white (palette.goldLine/goldGlow, site lights) cross the
  // threshold, so the navy stays crisp. Phones on the low tier skip it.
  let composer: EffectComposer | undefined;
  let renderPass: RenderPass | undefined;
  if (quality !== 'low') {
    composer = new EffectComposer(renderer, { multisampling: quality === 'high' ? 4 : 0, frameBufferType: THREE.HalfFloatType });
    renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    composer.addPass(renderPass);
    composer.addPass(new EffectPass(new THREE.PerspectiveCamera(),
      new BloomEffect({ luminanceThreshold: 0.92, luminanceSmoothing: 0.08, intensity: 0.85, mipmapBlur: true, radius: 0.7 }),
      new VignetteEffect({ darkness: 0.42, offset: 0.32 })));
  }

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const palette = makePalette();
  const kit: Kit = {
    quality,
    palette,
    snapshot: (scene, camera, w, h) => {
      const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, colorSpace: THREE.SRGBColorSpace });
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(prev);
      return rt.texture;
    },
    loadGLB: (name) => new Promise<GLTF>((done, fail) => loader.load(`${base}three/${name}.glb`, (g) => { applyPalette(g.scene, palette); done(g); }, undefined, fail)),
  };

  let active: StageScene | undefined;
  let target: () => number = () => 0;
  let p = 0, time = 0, last = 0, raf = 0;
  let onScreen = true, visible = !document.hidden, lost = false;
  let width = 0, height = 0;

  const size = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h, false);
    if (active) { active.camera.aspect = w / h; active.camera.updateProjectionMatrix(); }
  };
  const ro = new ResizeObserver(() => { size(); kick(); });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; kick(); });
  io.observe(canvas);
  const onVis = () => { visible = !document.hidden; kick(); };
  document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; canvas.classList.add('is-lost'); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; canvas.classList.remove('is-lost'); kick(); });

  const draw = () => {
    if (!active) return;
    if (composer && renderPass) {
      renderPass.mainScene = active.scene;
      renderPass.mainCamera = active.camera;
      composer.render();
    } else renderer.render(active.scene, active.camera);
  };

  function frame(now: number) {
    raf = 0;
    if (!active || !onScreen || !visible || lost) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    const t = target();
    p += (t - p) * (1 - Math.exp(-LAMBDA * dt));
    if (Math.abs(t - p) < 1e-4) p = t;
    active.update(p, dt, time);
    draw();
    const settled = p === t && active.idle?.();
    if (!settled) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && active && onScreen && visible && !lost) { last = 0; raf = requestAnimationFrame(frame); }
  }
  addEventListener('scroll', kick, { passive: true });

  return {
    kit,
    canvas,
    mount(host) {
      if (canvas.parentElement !== host) host.appendChild(canvas);
      width = height = 0;
      size();
    },
    play(scene, t) {
      if (active !== scene) { active = scene; time = 0; p = t(); size(); scene.camera.aspect = (width || 1) / (height || 1); scene.camera.updateProjectionMatrix(); }
      target = t;
      kick();
    },
    stop() { active = undefined; cancelAnimationFrame(raf); raf = 0; },
    async prepare(scene) {
      // Compile shaders and upload textures ahead of time, so a scene's first frame never stalls the scroll.
      await renderer.compileAsync(scene.scene, scene.camera);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('scroll', kick);
      composer?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
