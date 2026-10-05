// The night sky over the flow waves (home and course pages; "stars over waves", 5 Oct 2026): the real sky
// over Doha on a winter evening. About 3,900 stars from the Yale Bright Star Catalogue with their real
// colours (B-V) and brightness, gold constellation figures, a faint Milky Way, gentle twinkle (stronger near
// the horizon) and a rare slow shooting star. Scrolling turns the sky very slowly about the celestial pole,
// like the night passing. Data: public/sky/stars.bin (scripts/sky-data.ts), fetched after the page loads.
// Raw WebGL, not three.js: it shows from the first screen and must not wait for the 3D chunk.
// Layers: flow canvas, then a still dim (.cbg-sky-dim, darkens the waves), then this canvas, then content.
// Contrast: a mask of every text line, read on each draw, dims the sky to 12% behind text (text keeps 4.5:1).
// Cost: one transparent canvas, at most 30 draws a second (twinkle), none while hidden or off our routes;
// reduced motion draws a still sky only when the page scrolls (to keep the text mask in place).

const DEG = Math.PI / 180;
export const LAT = 25.3 * DEG; // Doha
export const LST0 = 127.5 * DEG; // sidereal time 8h30, a winter evening: Orion and Sirius to the right of the headline, Leo rising left
export const RATE = 0.0025 * DEG; // sky turn per scrolled pixel: about 20 degrees (80 minutes) over a long page
const TAU = 1.2; // s: the turn glides to a stop
const MAXV = 2 * DEG; // rad/s: never faster than this
const FOV = 140 * DEG; // across the screen diagonal
const CELL = 8; // css px per text-mask cell
const PAD = 18; // css px around each text line that counts as behind text
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

// Shared by both fragment shaders: the text mask. K: canvas height (device px), dpr. Q: mask size in css px.
const HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D T;uniform vec4 K;uniform vec2 Q;
float dim(){return 1.-.88*texture2D(T,vec2(gl_FragCoord.x,K.x-gl_FragCoord.y)/K.y/Q).r;}
`;

// Milky Way (3D value noise along the galactic plane, a dust lane toward the centre) and the meteor.
// Galactic pole and centre in J2000 equatorial: RA 192.859, Dec 27.128 and RA 266.405, Dec -28.936.
// H: meteor head (css px) and direction; G: tail length (css px) and strength.
export const SKY = `${HEAD}uniform mat3 M;uniform vec3 Z;uniform vec2 R;uniform float S;uniform vec4 H,G;
float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);vec2 e=vec2(0,1);
return mix(mix(mix(h(i),h(i+e.yxx),f.x),mix(h(i+e.xyx),h(i+e.yyx),f.x),f.y),mix(mix(h(i+e.xxy),h(i+e.yxy),f.x),mix(h(i+e.xyy),h(i+1.),f.x),f.y),f.z);}
void main(){
vec2 p=(gl_FragCoord.xy-.5*R)/S;float q=dot(p,p);
vec3 e=M*(vec3(4.*p,4.-q)/(4.+q));
float b=dot(e,vec3(-.8677,-.1981,.456)),g=dot(e,vec3(-.0549,-.8734,-.4838)),w=.14+.04*g;
float m=exp(-b*b/(w*w))*(.5+.5*smoothstep(-1.,1.,g))*smoothstep(.25,.8,.5*n(e*4.)+.3*n(e*9.+3.)+.2*n(e*23.+7.));
m*=1.-.75*exp(-pow((b-.012)/.03,2.))*smoothstep(-.2,.7,g);
float a=.1*m*smoothstep(-.02,.15,dot(e,Z));
vec3 c=mix(vec3(.62,.68,.9),vec3(.95,.86,.74),smoothstep(.3,1.,g))*a;
if(G.y>0.){vec2 v=vec2(gl_FragCoord.x,K.x-gl_FragCoord.y)/K.y-H.xy;float t=-dot(v,H.zw),s=dot(v,vec2(-H.w,H.z)),k=clamp(t/G.x,0.,1.);
float f=G.y*(step(-1.,t)*step(t,G.x)*(1.-k)*(1.-k)*exp(-s*s*2.)+.4*exp(-dot(v,v)*.5));c+=vec3(.93,.95,1.)*f;a+=f;}
gl_FragColor=vec4(c,min(a,1.))*dim();}`;

// Stars as soft point sprites (faint diffraction spikes on the ~20 brightest), lines in gold. r < 0 = a line.
const STAR_V = `attribute vec3 p;attribute vec4 m;uniform mat3 M;uniform vec3 Z;uniform vec2 R;uniform float S,D,t,L;
varying vec3 c;varying float a,r,z,w;
void main(){vec3 v=p*M;float h=dot(p,Z),x=smoothstep(-.02,.12,h);
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

// Starts the sky once per visit (like flowBackground). Never throws; without it the flow waves stay.
export function skyBackground(doc: Document = document): () => void {
  const win = doc.defaultView;
  if (!win || doc.querySelector('canvas.cbg-sky')) return () => {};
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  const phone = win.matchMedia('(pointer: coarse)').matches || win.innerWidth < 768;
  const dpr = Math.min(win.devicePixelRatio || 1, phone ? 1 : 1.5);
  const canvas = doc.createElement('canvas');
  const dim = doc.createElement('div');
  canvas.className = 'cbg-sky';
  dim.className = 'cbg-sky-dim';
  for (const el of [dim, canvas]) {
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100vh;height:100lvh;z-index:-1;pointer-events:none';
  }
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return () => {};
  let sky: [WebGLProgram, Uniforms], dots: [WebGLProgram, Uniforms];
  try {
    sky = link(gl, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}', SKY, ['a']);
    dots = link(gl, STAR_V, STAR_F, ['p', 'm']);
  } catch {
    return () => {};
  }
  const tri = buffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(1));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied
  gl.clearColor(0, 0, 0, 0);

  const off = new AbortController();
  const opts = { passive: true, signal: off.signal } as const;
  let stars: WebGLBuffer | null = null, lines: WebGLBuffer | null = null, nStars = 0, nLines = 0;
  let q = [1, 1], texts: Node[] = [], cells = new Uint8Array(0), raf = 0, last = 0, prev = 0, dirty = true, shown = 0, born = 0, measuring = 0;
  let shot: { t0: number; dur: number; len: number; x: number; y: number; dx: number; dy: number } | undefined;
  let next = 12 + Math.random() * 14; // first shooting star, s after the stars appear
  const range = doc.createRange();
  const ours = () => OUR_ROUTE.test(doc.documentElement.className);

  // The text to keep the sky dim behind: every non-empty text node (re-collected, at most 300 ms late, when
  // the page changes).
  const collect = () => {
    measuring = 0;
    texts = [];
    const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue?.trim() && !n.parentElement?.closest('[class*="sr-only"]') ? 1 : 3), // sr-only reports a huge box
    });
    for (let n; (n = walk.nextNode());) texts.push(n);
    kick();
  };
  const recollect = () => {
    if (!measuring) measuring = win.setTimeout(collect, 300);
  };
  // Where every text line is now, padded, as a low-res viewport mask (8 css px cells, soft edges from linear
  // filtering). Read on every draw, so text that is pinned, carried or slid sideways (the hero, the
  // carousels) keeps the stars behind it dim, frame for frame.
  const mask = (w: number, h: number) => {
    const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
    if (cells.length !== cols * rows) cells = new Uint8Array(cols * rows);
    else cells.fill(0);
    for (const n of texts) {
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (!r.width || r.bottom < -PAD || r.top > h + PAD) continue;
        const x1 = Math.min(cols, Math.ceil((r.right + PAD) / CELL)), y1 = Math.min(rows, Math.ceil((r.bottom + PAD) / CELL));
        for (let y = Math.max(0, Math.floor((r.top - PAD) / CELL)); y < y1; y++)
          cells.fill(255, y * cols + Math.max(0, Math.floor((r.left - PAD) / CELL)), y * cols + x1);
      }
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, cells);
    q = [cols * CELL, rows * CELL];
  };

  const uniforms = (u: Uniforms, m: Float32Array, s: number) => {
    gl.uniformMatrix3fv(u.M, false, m.subarray(0, 9));
    gl.uniform3fv(u.Z, m.subarray(9));
    gl.uniform2f(u.R, canvas.width, canvas.height);
    gl.uniform1f(u.S, s);
    gl.uniform4f(u.K, canvas.height, dpr, 0, 0);
    gl.uniform2f(u.Q, q[0], q[1]);
  };
  const attrs = (b: WebGLBuffer | null) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  };

  const frame = (ms: number) => {
    raf = 0;
    if (!ours() || doc.hidden || !stars) return;
    const still = reduce.matches;
    if (!still) raf = win.requestAnimationFrame(frame);
    if (!dirty && ms - last < 30) return; // 30 fps for the twinkle; a scroll draws at once (the text mask follows)
    dirty = false;
    last = ms;
    const dt = Math.min(0.1, (ms - (prev || ms)) / 1000), t = ms / 1000;
    prev = ms;
    if (!born) born = t;
    const w = canvas.clientWidth, h = Math.max(win.innerHeight, canvas.clientHeight);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    shown = still ? 0 : turn(shown, win.scrollY * RATE, dt);
    const [s, alt] = lens(w, h), m = view(LST0 + shown, alt);
    mask(w, h);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // A shooting star every 20 to 45 s: 1.5 to 2.5 s along a long sine ease, starting off the centre and
    // heading outward and down, so it never crosses the hero headline.
    let head = [0, 0, 1, 0], tail = [1, 0];
    if (!still && !shot && t - born > next) {
      const dir = Math.random() < 0.5 ? 1 : -1, ang = (18 + Math.random() * 14) * DEG, vw = win.innerWidth;
      shot = { t0: t, dur: 1.5 + Math.random(), len: (200 + Math.random() * 160) * Math.min(1, vw / 1200),
        x: vw * (0.5 + dir * (0.14 + Math.random() * 0.2)), y: win.innerHeight * (0.06 + Math.random() * 0.3),
        dx: Math.cos(ang) * dir, dy: Math.sin(ang) };
    }
    if (shot) {
      const k = (t - shot.t0) / shot.dur, e = (0.5 - 0.5 * Math.cos(Math.PI * k)) * shot.len, fade = Math.sin(Math.PI * k);
      head = [shot.x + shot.dx * e, shot.y + shot.dy * e, shot.dx, shot.dy];
      tail = [30 + 110 * fade, 0.55 * fade];
      if (k >= 1 || still) {
        shot = undefined;
        tail = [1, 0];
        next = t - born + 20 + Math.random() * 25;
      }
    }

    gl.useProgram(sky[0]);
    uniforms(sky[1], m, s * dpr);
    gl.uniform4fv(sky[1].H, head);
    gl.uniform4f(sky[1].G, tail[0], tail[1], 0, 0);
    gl.disableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(dots[0]);
    uniforms(dots[1], m, s * dpr);
    gl.uniform1f(dots[1].D, dpr);
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
    if (!canvas.classList.contains('is-on')) for (const el of [dim, canvas]) el.classList.add('is-on');
  };
  const kick = () => {
    dirty = true;
    if (!raf) raf = win.requestAnimationFrame(frame);
  };

  function stop() {
    off.abort();
    routes.disconnect();
    changes.disconnect();
    clearTimeout(measuring);
    if (raf) win!.cancelAnimationFrame(raf);
    stars = null;
    dim.remove();
    canvas.remove();
  }
  const routes = new win.MutationObserver(kick); // a client-side page change: draw for the page we land on
  const changes = new win.MutationObserver(recollect);

  // After the page has loaded (or 4 s), so the 25 KB of stars never compete with the first screen.
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
      stars = buffer(gl, d.stars);
      lines = buffer(gl, d.lines);
      nStars = d.stars.length / 7;
      nLines = d.lines.length / 7;
      doc.body.append(dim, canvas); // after the flow canvas: same layer, so above it and below all content
      gl.enableVertexAttribArray(0);
      collect();
      win.addEventListener('scroll', kick, opts);
      win.addEventListener('resize', kick, opts);
      doc.addEventListener('visibilitychange', kick, opts);
      reduce.addEventListener?.('change', kick, { signal: off.signal });
      routes.observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
      changes.observe(doc.body, { childList: true, subtree: true, characterData: true });
    })
    .catch(() => stop());
  // A lost context (GPU reset, memory pressure): drop the sky; the flow waves and the still gradient stay.
  canvas.addEventListener('webglcontextlost', () => stop(), { signal: off.signal });
  return stop;
}
