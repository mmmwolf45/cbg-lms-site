// The page background on home and course pages: the flow waves (flow.ts) under the night sky ("stars over waves",
// 5 Oct 2026), the real sky over Doha on a winter evening. About 3,900 stars from the Yale Bright Star Catalogue
// with their real colours (B-V) and brightness, gold constellation figures, a faint Milky Way, gentle twinkle
// (stronger near the horizon) and a rare slow shooting star. Scrolling moves the waves and turns the sky very
// slowly about the celestial pole, like the night passing. Data: public/sky/stars.bin (scripts/sky-data.ts),
// fetched after the page loads; until then (or if it never comes) the canvas draws the waves alone.
// Raw WebGL, not three.js: it shows from the first screen and must not wait for the 3D chunk.
// Contrast: a mask of every text line, read on each draw, dims the sky to 12% behind text (text keeps 4.5:1).
//
// Cost (6 Oct 2026, Intel UHD laptop, Chrome D3D11, 165 Hz panel, lab/scroll-perf.mjs in a real window): one
// opaque canvas at one pixel per CSS pixel, nothing blended over the page background. It used to be two stacked
// canvases (the waves, then the transparent sky at up to 1.5 px per CSS px computing 3D noise for the Milky Way
// on every pixel of every draw); at rest the sky alone held every frame at 50-100 ms. Now the Milky Way is baked
// once into a sky-coordinate texture (BAKE) and each draw looks it up. Draws: at most 30 a second while the page
// scrolls or a shooting star flies (none during a scroll on a device that proves sluggish), 10 for the twinkle at
// rest, none while hidden, off our routes or while the home band's film fills the screen (it parks: its last frame
// stays); the text mask is re-read on every scroll draw except while the course story's panel is pinned (its text
// doesn't move then). Reduced motion: a still sky and still waves, drawn only when the page scrolls (to keep the
// text mask in place).
// (A first merged canvas, also 6 Oct 2026, froze 2.7 to 7.8 s in headless Chrome with a 4x slower CPU; headless
// WebGL is software there. In a real window this one shows no long task.)
import { BACKDROP_MS, due, pinned } from './tokens';
import { SPEED, WAVES, glide } from './flow';

const DEG = Math.PI / 180;
export const LAT = 25.3 * DEG; // Doha
export const LST0 = 127.5 * DEG; // sidereal time 8h30, a winter evening: Orion and Sirius to the right of the headline, Leo rising left
export const RATE = 0.0025 * DEG; // sky turn per scrolled pixel: about 20 degrees (80 minutes) over a long page
export const TWINKLE_MS = 98; // 10 a second: at rest only the twinkle moves, and it is slow (periods of 4 to 10 s)
const REST_MS = 400; // a sluggish device draws once the page has rested this long (wheel notches come 0.1-0.3 s apart)
const TAU = 1.2; // s: the turn glides to a stop
const MAXV = 2 * DEG; // rad/s: never faster than this
const FOV = 140 * DEG; // across the screen diagonal
const CELL = 8; // css px per text-mask cell
const PAD = 32; // css px around each text line that counts as behind text (the blur then softens the edge)
const FADE = 1.8; // s: the sky fades in over the waves once the stars arrive
const MW = [2048, 1024]; // the baked Milky Way: right ascension x declination, about 5.7 texels a degree
const GOLD = [0.839, 0.694, 0.376];
const OUR_ROUTE = /\bcbg-route-(home|course)\b/;

// Equatorial unit vector to view space (x west = screen right, y up, z forward) at sidereal time lst, for
// a viewer at Doha facing south, eyes raised to altitude alt. 12 floats: mat3 columns (the view axes in
// equatorial coordinates, so GLSL `p * M` projects and `M * v` unprojects), then the zenith.
export function view(lst: number, alt: number): Float32Array {
  const c = Math.cos(lst), s = Math.sin(lst), ca = Math.cos(alt), sa = Math.sin(alt);
  const S = [Math.sin(LAT), 0, -Math.cos(LAT)], U = [Math.cos(LAT), 0, Math.sin(LAT)]; // south and up (frame turned by -lst)
  const rows = [[0, -1, 0], S.map((v, i) => -sa * v + ca * U[i]), S.map((v, i) => ca * v + sa * U[i]), U];
  return new Float32Array(rows.flatMap(([x, y, z]) => [x * c - y * s, x * s + y * c, z]));
}

// Stereographic lens for a w x h css viewport: [css px per unit, view altitude]. The horizon sits just under
// the bottom edge, so a portrait phone looks higher (past the zenith) than a laptop.
export function lens(w: number, h: number): [number, number] {
  const s = Math.hypot(w, h) / 4 / Math.tan(FOV / 4);
  return [s, Math.min(75 * DEG, 2 * Math.atan(h / 4 / s) + 2 * DEG)];
}

// Whether a device is struggling: the median of its last 24 scroll frames over 30 ms. On the Intel UHD laptop
// every canvas frame drawn during a scroll held that frame for 40 to 90 ms whatever the canvas's size (6 Oct 2026,
// lab/ab-perf.mjs), so 30 sky draws a second held every frame there. Such a device gets html.cbg-slow (CSS drops
// the navbar's backdrop blur) and a background that holds still while the page scrolls, then glides into place.
export const sluggish = (gaps: number[]) => gaps.length > 23 && gaps.filter((g) => g > 30).length > 11;

// One step of the turn toward its target: time-based damping with a speed cap, landing exactly.
export function turn(shown: number, target: number, dt: number): number {
  const step = (target - shown) * (1 - Math.exp(-dt / TAU));
  const next = shown + Math.max(-MAXV * dt, Math.min(MAXV * dt, step));
  return Math.abs(target - next) < 1e-6 ? target : next;
}

// Star colour from B-V, kept pale as the eye sees it: blue-white, white, the sun's yellow-white, orange, red.
const STOPS = [[-0.4, 0.64, 0.74, 1], [0, 0.86, 0.9, 1], [0.65, 1, 0.95, 0.86], [1.4, 1, 0.78, 0.55], [2, 1, 0.66, 0.42]];
export function tint(bv: number): number[] {
  const found = STOPS.findIndex((s) => s[0] > bv);
  const i = found < 0 ? 4 : Math.max(1, found), a = STOPS[i - 1], b = STOPS[i];
  const k = Math.max(0, Math.min(1, (bv - a[0]) / (b[0] - a[0])));
  return [1, 2, 3].map((j) => a[j] + (b[j] - a[j]) * k);
}

// stars.bin to vertex data, 7 floats a vertex: direction, magnitude, colour. Lines: direction, end (0|1), gold.
export function decode(buf: ArrayBuffer) {
  const [n, l] = new Uint16Array(buf, 0, 2);
  const ra = new Uint16Array(buf, 4, n), de = new Uint16Array(buf, 4 + 2 * n, n);
  const b = new Uint8Array(buf, 4 + 4 * n, 2 * n), seg = new Uint16Array(buf, 4 + 6 * n, 2 * l);
  const dir = (i: number) => {
    const a = (ra[i] / 65536) * 2 * Math.PI, d = ((de[i] / 65535) * 180 - 90) * DEG;
    return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  };
  const stars = new Float32Array(n * 7), lines = new Float32Array(l * 14);
  for (let i = 0; i < n; i++) stars.set([...dir(i), b[i] / 25 - 2, ...tint(b[n + i] / 60 - 0.5)], i * 7);
  seg.forEach((s, k) => lines.set([...dir(s), k & 1, ...GOLD], k * 7));
  return { stars, lines };
}

const PRECISION = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
// Shared by both drawing shaders: the text mask. K: canvas height (px), px per css px. Q: mask size in css px.
const HEAD = `${PRECISION}uniform sampler2D T;uniform vec2 K,Q;
float dim(){return 1.-.88*texture2D(T,vec2(gl_FragCoord.x,K.x-gl_FragCoord.y)/K.y/Q).r;}
`;

// The Milky Way, once, into an equirectangular texture (x: right ascension, y: declination): 3D value noise along
// the galactic plane, a dust lane toward the centre. r: density, g: warmth (toward the galactic centre).
// Galactic pole and centre in J2000 equatorial: RA 192.859, Dec 27.128 and RA 266.405, Dec -28.936.
export const BAKE = `${PRECISION}uniform vec2 R;
float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);vec2 e=vec2(0,1);
return mix(mix(mix(h(i),h(i+e.yxx),f.x),mix(h(i+e.xyx),h(i+e.yyx),f.x),f.y),mix(mix(h(i+e.xxy),h(i+e.yxy),f.x),mix(h(i+e.xyy),h(i+1.),f.x),f.y),f.z);}
void main(){
vec2 t=gl_FragCoord.xy/R;float ra=(t.x-.5)*6.2831853,de=(t.y-.5)*3.1415927;
vec3 e=vec3(cos(de)*cos(ra),cos(de)*sin(ra),sin(de));
float b=dot(e,vec3(-.8677,-.1981,.456)),g=dot(e,vec3(-.0549,-.8734,-.4838)),w=.14+.04*g;
float m=0.;if(abs(b)<3.*w){m=exp(-b*b/(w*w))*(.5+.5*smoothstep(-1.,1.,g))*smoothstep(.25,.8,.5*n(e*4.)+.3*n(e*9.+3.)+.2*n(e*23.+7.));
float l=(b-.012)/.03;m*=1.-.75*exp(-l*l)*smoothstep(-.2,.7,g);}
gl_FragColor=vec4(m,smoothstep(.3,1.,g),0.,1.);}`;

// The page background, opaque: the waves (W: wave time) under the still dim (45% night, up to 55% more toward the
// edges: the old .cbg-sky-dim's radial gradient, 120% x 95% at 50% 42%, from 38%), then the Milky Way looked up in
// the baked texture U, and the meteor. F: how far the sky has faded in (0 until the stars arrive).
// H: meteor head (css px) and direction; G: tail length (css px) and strength.
export const SKY = `${HEAD}${WAVES}uniform mat3 M;uniform vec3 Z;uniform vec2 R;uniform float S,W,F;uniform vec4 H,G;uniform sampler2D U;
void main(){
vec3 B=waves(gl_FragCoord.xy,R,W);vec2 u=gl_FragCoord.xy/R;
float v=1.-.55*(1.-.55*clamp((length(vec2((u.x-.5)/1.2,(.58-u.y)/.95))-.38)/.62,0.,1.));
B=mix(B,vec3(.008,.02,.047)*v+B*(1.-v),F);
vec3 c=vec3(0);float a=0.;
if(F>0.){vec2 p=(gl_FragCoord.xy-.5*R)/S;float q=dot(p,p);vec3 e=M*(vec3(4.*p,4.-q)/(4.+q));
vec4 w=texture2D(U,vec2(atan(e.y,e.x)*.1591549+.5,asin(clamp(e.z,-1.,1.))*.3183099+.5));
a=.1*w.r*smoothstep(-.02,.15,dot(e,Z))*F;c=mix(vec3(.62,.68,.9),vec3(.95,.86,.74),w.g)*a;
if(G.y>0.){vec2 v=vec2(gl_FragCoord.x,K.x-gl_FragCoord.y)/K.y-H.xy;float t=-dot(v,H.zw),s=dot(v,vec2(-H.w,H.z)),k=clamp(t/G.x,0.,1.);
float f=G.y*(step(-1.,t)*step(t,G.x)*(1.-k)*(1.-k)*exp(-s*s*2.)+.4*exp(-dot(v,v)*.5));c+=vec3(.93,.95,1.)*f;a+=f;}}
float d=dim();a=min(a,1.)*d;
gl_FragColor=vec4(c*d+(1.-a)*B,1.);}`;

// Stars as soft point sprites (faint diffraction spikes on the ~20 brightest), lines in gold. r < 0 = a line.
const STAR_V = `attribute vec3 p;attribute vec4 m;uniform mat3 M;uniform vec3 Z;uniform vec2 R;uniform float S,D,t,L,F;
varying vec3 c;varying float a,r,z,w;
void main(){vec3 v=p*M;float h=dot(p,Z),x=smoothstep(-.02,.12,h)*F;
gl_Position=vec4(4.*S*v.xy/max(1.+v.z,.05)/R,0.,1.);c=m.yzw;
if(L>0.){a=L*.15*x;z=m.x;r=-1.;return;}
float f=pow(10.,-.4*m.x),k=fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5)*6.283;
a=min(1.,3.*sqrt(f))*x*(1.-mix(.5,.14,smoothstep(.05,.5,h))*(.5+.25*(sin(t*(.6+.1*k)+k)+sin(t*1.7+3.*k))));
r=D*(.6+1.4*pow(f,.25));z=step(m.x,1.5);w=r*(z>0.?18.:7.);gl_PointSize=x>0.?w:0.;}`;
const STAR_F = `${HEAD}varying vec3 c;varying float a,r,z,w;
void main(){float i;
if(r<0.)i=smoothstep(0.,.15,z)*smoothstep(1.,.85,z);
else{vec2 q=(gl_PointCoord-.5)*w,u=abs(q);float d=length(q)/r;
i=exp(-d*d*1.3)+.05*exp(-d)+z*.22*(exp(-u.y*1.2)*max(0.,1.-2.*u.x/w)+exp(-u.x*1.2)*max(0.,1.-2.*u.y/w));}
i*=a*dim();gl_FragColor=vec4(c*i,i);}`;
const QUAD = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

type Gl = WebGLRenderingContext;
type Uniforms = Record<string, WebGLUniformLocation | null>;

function link(gl: Gl, vert: string, frag: string, attrs: string[]): [WebGLProgram, Uniforms] {
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    gl.attachShader(prog, s);
  }
  attrs.forEach((a, i) => gl.bindAttribLocation(prog, i, a));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  const u: Uniforms = {};
  for (let i = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) - 1; i >= 0; i--) {
    const name = gl.getActiveUniform(prog, i)!.name;
    u[name] = gl.getUniformLocation(prog, name);
  }
  return [prog, u];
}

const buffer = (gl: Gl, data: Float32Array) => {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return b;
};

const texture = (gl: Gl, unit: number, wrapS: number) => {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(1));
  return t;
};

// Starts the background once per visit (it outlives client-side page changes; CSS hides it on other routes).
// Returns a stop for tests. Never throws: without WebGL the still gradient stays.
export function skyBackground(doc: Document = document): () => void {
  const win = doc.defaultView;
  if (!win || doc.querySelector('canvas.cbg-sky')) return () => {};
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  const px = Math.min(win.devicePixelRatio || 1, 1); // canvas px per css px: stars stay crisp enough, under half the pixels of 1.5
  const canvas = doc.createElement('canvas');
  canvas.className = 'cbg-sky';
  canvas.setAttribute('aria-hidden', 'true');
  // Out of the page flow from the start: the bundle can run before the main CSS has landed, and an
  // unstyled canvas would sit in course.link's flex body and squeeze the navbar. The fade is CSS.
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100vh;height:100lvh;z-index:-1;pointer-events:none';
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return () => {};
  let sky: [WebGLProgram, Uniforms], dots: [WebGLProgram, Uniforms] | undefined;
  try {
    sky = link(gl, QUAD, SKY, ['a']);
  } catch {
    return () => {};
  }
  const tri = buffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));
  const milky = texture(gl, 1, gl.REPEAT); // unit 1: the Milky Way, baked once the stars arrive
  texture(gl, 0, gl.CLAMP_TO_EDGE); // unit 0 (left active): the text mask
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.useProgram(sky[0]);
  gl.uniform1i(sky[1].U, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied: the stars and lines over the opaque background
  gl.enableVertexAttribArray(0);
  doc.body.append(canvas); // after course.link's #react-root, so hydration never meets it; above body::before

  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  let stars: WebGLBuffer | null = null, lines: WebGLBuffer | null = null, nStars = 0, nLines = 0;
  let q = [1, 1], texts = new Map<Element, Node[]>(), maskAt = 0, cells = new Uint8Array(0), raf = 0, last = 0, dirty = true;
  let shown = 0, wave = 0, born = 0, measuring = 0, tickAt = 0, scrollAt = 0, slow = false;
  const gaps: number[] = []; // frame intervals while scrolling, until the device proves sluggish
  let shot: { t0: number; dur: number; len: number; x: number; y: number; dx: number; dy: number } | undefined;
  let next = 12 + Math.random() * 14; // first shooting star, s after the stars appear
  const range = doc.createRange();
  const ours = () => OUR_ROUTE.test(doc.documentElement.className);
  const waveGoal = () => (reduce.matches ? 0 : win.scrollY * SPEED);
  wave = waveGoal();

  // The text to keep the sky dim behind: every non-empty text node, grouped by its section so a draw only
  // reads the lines of sections on screen. Re-collected, at most 300 ms late, when the page changes.
  const collect = () => {
    measuring = 0;
    texts = new Map();
    const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue?.trim() && !n.parentElement?.closest('[class*="sr-only"]') ? 1 : 3), // sr-only reports a huge box
    });
    for (let n; (n = walk.nextNode());) {
      const g = n.parentElement!.closest('section,header,footer,nav,aside') ?? n.parentElement!;
      (texts.get(g) ?? texts.set(g, []).get(g)!).push(n);
    }
    kick();
  };
  const recollect = () => {
    if (!measuring) measuring = win.setTimeout(collect, 300);
  };
  // Where every visible text line is now, padded and blurred, as a low-res viewport mask (8 css px cells).
  // Read on every draw while scrolling and every 0.25 s otherwise, so text that is pinned, carried or slid
  // sideways (the hero, the carousels, the course story) keeps the stars behind it dim. Faded-out text
  // (opacity 0, visibility hidden) doesn't count, and the 3D stages (.cbg-stage) are never dimmed.
  const mask = (w: number, h: number) => {
    const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL), a = new Float32Array(cols * rows);
    const box = (r: DOMRect, v: number, pad: number) => {
      const x1 = Math.min(cols, Math.ceil((r.right + pad) / CELL)), y1 = Math.min(rows, Math.ceil((r.bottom + pad) / CELL));
      for (let y = Math.max(0, Math.floor((r.top - pad) / CELL)); y < y1; y++)
        a.fill(v, y * cols + Math.max(0, Math.floor((r.left - pad) / CELL)), y * cols + x1);
    };
    const near = (r: DOMRect) => r.width && r.bottom > -PAD && r.top < h + PAD;
    for (const [g, ns] of texts) {
      if (!near(g.getBoundingClientRect())) continue;
      for (const n of ns) {
        if (n.parentElement?.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) === false) continue;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (near(r)) box(r, 1, PAD);
      }
    }
    for (const c of doc.querySelectorAll('.cbg-stage')) box(c.getBoundingClientRect(), 0, 0);
    // Soft edges: a box blur (radius 3 cells) along rows, then columns, twice (close to a Gaussian). The
    // screen edges repeat outward, so text at an edge stays fully covered.
    for (let pass = 0; pass < 4; pass++) {
      const [n, lines, step, gap] = pass & 1 ? [rows, cols, cols, 1] : [cols, rows, 1, cols];
      const sum = new Float32Array(n + 7);
      for (let j = 0; j < lines; j++) {
        for (let i = 0; i < n + 6; i++) sum[i + 1] = sum[i] + a[j * gap + Math.min(n - 1, Math.max(0, i - 3)) * step];
        for (let i = 0; i < n; i++) a[j * gap + i * step] = (sum[i + 7] - sum[i]) / 7;
      }
    }
    if (cells.length !== a.length) cells = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) cells[i] = a[i] * 255;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, cells); // unit 0 is active
    q = [cols * CELL, rows * CELL];
  };

  const uniforms = (u: Uniforms, m: Float32Array, s: number, fade: number) => {
    gl.uniformMatrix3fv(u.M, false, m.subarray(0, 9));
    gl.uniform3fv(u.Z, m.subarray(9));
    gl.uniform2f(u.R, canvas.width, canvas.height);
    gl.uniform1f(u.S, s);
    gl.uniform1f(u.F, fade);
    gl.uniform2f(u.K, canvas.height, px);
    gl.uniform2f(u.Q, q[0], q[1]);
  };
  const attrs = (b: WebGLBuffer | null) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  };

  const frame = (ms: number) => {
    raf = 0;
    if (!ours() || doc.hidden) return;
    const still = reduce.matches, t = ms / 1000, live = !!stars && !still, scrolling = ms - scrollAt < 150;
    if (!slow && scrolling && tickAt) {
      gaps.push(ms - tickAt);
      if (gaps.length > 24) gaps.shift();
      slow = sluggish(gaps);
      if (slow) doc.documentElement.classList.add('cbg-slow');
    }
    tickAt = ms;
    const fade = !stars ? 0 : still ? 1 : 1 - (1 - Math.min(1, (t - born) / FADE)) ** 3;
    const target = still ? 0 : win.scrollY * RATE, goal = waveGoal();
    // Something besides the twinkle moving: the waves or the turn gliding, a shooting star, the fade, a scroll.
    const busy = dirty || wave !== goal || (live && (shown !== target || !!shot || fade < 1));
    if (live || busy) raf = win.requestAnimationFrame(frame);
    if (!due(ms, last, busy ? BACKDROP_MS : TWINKLE_MS) || (slow && ms - scrollAt < REST_MS)) return;
    if (pinned.band) return; // parked behind the band's film (6 Oct 2026 smoothness pass)
    const kicked = dirty;
    dirty = false;
    const dt = last ? (ms - last) / 1000 : 1 / 60;
    last = ms;
    const w = canvas.clientWidth, h = Math.max(win.innerHeight, canvas.clientHeight);
    if (canvas.width !== Math.round(w * px) || canvas.height !== Math.round(h * px)) {
      canvas.width = Math.round(w * px);
      canvas.height = Math.round(h * px);
    }
    wave = still ? goal : glide(wave, goal, dt);
    shown = still ? 0 : turn(shown, target, Math.min(0.1, dt));
    const [s, alt] = lens(w, h), m = view(LST0 + shown, alt);
    if (stars && ((kicked && !pinned.story) || ms - maskAt > 250)) {
      maskAt = ms;
      mask(w, h);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);

    // A shooting star every 20 to 45 s: 1.5 to 2.5 s along a long sine ease, starting off the centre and
    // heading outward and down, so it never crosses the hero headline.
    let head = [0, 0, 1, 0], tail = [1, 0];
    if (live && !shot && t - born > next) {
      const dir = Math.random() < 0.5 ? 1 : -1, ang = (18 + Math.random() * 14) * DEG, vw = win.innerWidth;
      shot = { t0: t, dur: 1.5 + Math.random(), len: (200 + Math.random() * 160) * Math.min(1, vw / 1200),
        x: vw * (0.5 + dir * (0.14 + Math.random() * 0.2)), y: win.innerHeight * (0.06 + Math.random() * 0.3),
        dx: Math.cos(ang) * dir, dy: Math.sin(ang) };
    }
    if (shot) {
      const k = (t - shot.t0) / shot.dur, e = (0.5 - 0.5 * Math.cos(Math.PI * k)) * shot.len, glow = Math.sin(Math.PI * k);
      head = [shot.x + shot.dx * e, shot.y + shot.dy * e, shot.dx, shot.dy];
      tail = [30 + 110 * glow, 0.55 * glow];
      if (k >= 1 || still) {
        shot = undefined;
        tail = [1, 0];
        next = t - born + 20 + Math.random() * 25;
      }
    }

    gl.useProgram(sky[0]);
    uniforms(sky[1], m, s * px, fade);
    gl.uniform1f(sky[1].W, wave);
    gl.uniform4fv(sky[1].H, head);
    gl.uniform4f(sky[1].G, tail[0], tail[1], 0, 0);
    gl.disableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (stars && dots) {
      gl.useProgram(dots[0]);
      uniforms(dots[1], m, s * px, fade);
      gl.uniform1f(dots[1].D, px);
      gl.uniform1f(dots[1].t, still ? 0 : t);
      gl.enableVertexAttribArray(1);
      const fig = still ? 1 : Math.min(1, Math.max(0, (t - born - 2) / 6)); // the figures fade in after the stars
      if (fig > 0) {
        gl.uniform1f(dots[1].L, fig * fig * (3 - 2 * fig));
        attrs(lines);
        gl.drawArrays(gl.LINES, 0, nLines);
      }
      gl.uniform1f(dots[1].L, 0);
      attrs(stars);
      gl.drawArrays(gl.POINTS, 0, nStars);
    }
    if (!canvas.classList.contains('is-on')) canvas.classList.add('is-on'); // fades in over the still gradient
  };
  function kick() {
    dirty = true;
    if (!raf) raf = win!.requestAnimationFrame(frame);
  }

  function stop() {
    off.abort();
    routes.disconnect();
    changes.disconnect();
    clearTimeout(measuring);
    if (raf) win!.cancelAnimationFrame(raf);
    stars = null;
    canvas.remove();
  }
  const routes = new win.MutationObserver(kick); // a client-side page change: draw for the page we land on
  const changes = new win.MutationObserver(recollect);
  routes.observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
  win.addEventListener('scroll', () => { scrollAt = performance.now(); kick(); }, opts);
  win.addEventListener('resize', kick, opts);
  doc.addEventListener('visibilitychange', kick, opts);
  reduce.addEventListener?.('change', kick, { signal: off.signal });
  kick();

  // The stars after the page has loaded (or 4 s), so their 25 KB and the Milky Way's one bake never compete with
  // the first screen. If any of it fails the waves carry on alone.
  const file = 'sky/stars.bin'; // public/sky, beside the bundle on Pages (a variable, so Vite leaves the URL alone)
  new Promise((done) => {
    if (doc.readyState === 'complete') done(0);
    win.addEventListener('load', done, { once: true, signal: off.signal });
    win.setTimeout(done, 4000);
  })
    .then(() => fetch(new URL(file, import.meta.url)))
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(res.status)))
    .then((buf) => {
      if (off.signal.aborted) return;
      const d = decode(buf);
      dots = link(gl, STAR_V, STAR_F, ['p', 'm']);
      // The bake: the Milky Way into texture unit 1, through a framebuffer, once.
      const [bake, bu] = link(gl, QUAD, BAKE, ['a']);
      const fb = gl.createFramebuffer();
      gl.activeTexture(gl.TEXTURE1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MW[0], MW[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, milky, 0);
      gl.viewport(0, 0, MW[0], MW[1]);
      gl.useProgram(bake);
      gl.uniform2f(bu.R, MW[0], MW[1]);
      gl.bindBuffer(gl.ARRAY_BUFFER, tri);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      gl.deleteProgram(bake);
      gl.activeTexture(gl.TEXTURE0);
      stars = buffer(gl, d.stars);
      lines = buffer(gl, d.lines);
      nStars = d.stars.length / 7;
      nLines = d.lines.length / 7;
      born = performance.now() / 1000;
      collect();
      changes.observe(doc.body, { childList: true, subtree: true, characterData: true });
    })
    .catch(() => {}); // no stars: the waves stay
  // A lost context (GPU reset, memory pressure): drop the canvas; the still gradient stays.
  canvas.addEventListener('webglcontextlost', () => stop(), { signal: off.signal });
  return stop;
}
