// The page background on home and course pages: flowing navy and blue waves drawn by a small WebGL
// shader. They move only while the page scrolls (scroll position is the clock), so nothing moves while
// the reader is still, and they stay still under reduced motion. Chosen 3 Oct 2026 ("Flow on scroll").
// The still gradient on body::before (critical.css) is the first paint and the fallback: this canvas
// fades in over it after its first frame, and is removed if WebGL is missing or the context is lost.
// Cost: one canvas at about a third of the screen's CSS size (a smooth gradient needs no more), one
// draw per frame while scrolling, none at rest or while the home band's film fills the screen.
import { pinned } from './tokens';

export const SCALE = 0.34; // canvas pixels per CSS pixel
export const SPEED = 0.0016; // wave time per scrolled pixel
const EASE = 0.12; // share of the remaining distance covered per frame (the waves glide to a stop)

// Colours are the brand navy family; COBALT and the gold glint are capped so the muted text colour
// (#8F96A5) keeps at least 4.5:1 against the brightest pixel (measured 4.8:1, 3 Oct 2026).
export const FRAG = `precision mediump float;
uniform vec2 r;
uniform float t;
const vec3 DEEP = vec3(.016, .039, .090);
const vec3 NAVY = vec3(.031, .071, .149);
const vec3 BRAND = vec3(.125, .216, .412);
const vec3 COBALT = vec3(.052, .118, .265);
const vec3 GOLD = vec3(.839, .694, .376);
void main() {
  vec2 uv = gl_FragCoord.xy / r;
  vec2 p = (gl_FragCoord.xy - .5 * r) / r.y;
  vec2 q = p + .35 * vec2(sin(1.7 * p.y + t * .6), sin(1.3 * p.x - t * .5));
  q += .20 * vec2(sin(2.9 * q.y - t * .4 + 1.3), sin(2.3 * q.x + t * .7));
  float w = .5 + .5 * sin(2.2 * q.x + 1.6 * q.y + t * .3);
  float w2 = .5 + .5 * sin(-1.4 * q.x + 2.6 * q.y - t * .25 + 2.);
  vec3 c = mix(DEEP, NAVY, w);
  c = mix(c, COBALT, smoothstep(.55, 1., w * w2) * .8);
  c = mix(c, BRAND, smoothstep(.6, 1., w2) * .28);
  c += GOLD * pow(smoothstep(.75, 1., w * w2), 3.) * .035;
  float v = smoothstep(.95, .2, length((uv - vec2(.5, .58)) * vec2(1.1, 1.)));
  c *= mix(.45, 1., v);
  gl_FragColor = vec4(c, 1.);
}`;

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

// The canvas size for a viewport: about a third of its CSS size, never below 64px a side.
export const canvasSize = (w: number, h: number): [number, number] => [
  Math.max(64, Math.round(w * SCALE)),
  Math.max(64, Math.round(h * SCALE)),
];

// One step of the glide toward the scroll position; lands exactly once close enough.
export const glide = (shown: number, target: number) => {
  const next = shown + (target - shown) * EASE;
  return Math.abs(target - next) < 0.0005 ? target : next;
};

type Gl = { draw: (t: number) => void };

function program(canvas: HTMLCanvasElement): Gl | undefined {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return undefined;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) throw new Error('shader');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const prog = gl.createProgram();
  if (!prog) return undefined;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle covers the screen
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, 'r');
  const uT = gl.getUniformLocation(prog, 't');
  return {
    draw(t) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

const OUR_ROUTE = /\bcbg-route-(home|course)\b/;

// Starts the background once per visit (it outlives client-side page changes; CSS hides it on other
// routes). Returns a stop for tests. Never throws: without it the still gradient stays.
export function flowBackground(doc: Document = document): () => void {
  const win = doc.defaultView;
  if (!win || doc.querySelector('canvas.cbg-flow')) return () => {};
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = doc.createElement('canvas');
  canvas.className = 'cbg-flow';
  canvas.setAttribute('aria-hidden', 'true');
  // Out of the page flow from the start: the bundle can run before the main CSS has landed, and an
  // unstyled canvas would sit in course.link's flex body and squeeze the navbar. The fade is CSS.
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100vh;height:100lvh;z-index:-1;pointer-events:none';
  let gl: Gl | undefined;
  try {
    gl = program(canvas);
  } catch {
    gl = undefined;
  }
  if (!gl) return () => {};
  doc.body.append(canvas); // after course.link's #react-root, so hydration never meets it; above body::before

  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  let raf = 0;
  let shown = 0;
  let target = 0;
  const ours = () => OUR_ROUTE.test(doc.documentElement.className);
  const goal = () => (reduce.matches ? 0 : win.scrollY * SPEED);
  const fit = () => {
    // The tallest viewport the canvas covers (CSS: 100lvh), so the phone address bar never uncovers it.
    const [w, h] = canvasSize(win.innerWidth, Math.max(win.innerHeight, canvas.clientHeight));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };
  const frame = () => {
    raf = 0;
    if (!gl || !ours()) return;
    shown = glide(shown, target);
    if (!pinned.band) { // else parked behind the band's film: the waves still glide, unseen
      fit();
      gl.draw(shown);
    }
    if (!canvas.classList.contains('is-on')) canvas.classList.add('is-on'); // fades in over the still gradient
    if (shown !== target) raf = win.requestAnimationFrame(frame);
  };
  const kick = () => {
    target = goal();
    if (!raf) raf = win.requestAnimationFrame(frame);
  };
  shown = target = goal();
  kick();
  win.addEventListener('scroll', kick, opts);
  win.addEventListener('resize', () => { fit(); kick(); }, opts);
  reduce.addEventListener?.('change', () => { shown = goal(); kick(); }, { signal: off.signal });
  // A lost context (GPU reset, memory pressure): drop the canvas and keep the still gradient.
  canvas.addEventListener('webglcontextlost', () => stop(), { signal: off.signal });
  // Client-side page changes swap the route class: draw once for the page we land on.
  const routes = new win.MutationObserver(kick);
  routes.observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });

  function stop() {
    off.abort();
    routes.disconnect();
    if (raf) win!.cancelAnimationFrame(raf);
    gl = undefined;
    canvas.remove();
  }
  return stop;
}
