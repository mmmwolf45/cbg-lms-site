// Band C, "Silk surface": one small raw-WebGL shader over the whole panel. A dark navy sheet folded by slow
// noise; the folds catch a warm gold key light and a faint blue rim. The pointer bends the folds softly
// towards itself (heavily smoothed); scroll shifts the phase gently. Rendered at half resolution.
// The idea (a noise-displaced surface with a 3-colour gradient and lighting) is after shadergradient
// (MIT, github.com/ruucm/shadergradient, "defaults/plane" and "cosmic/plane"); this GLSL is our own.

const FRAG = `precision highp float;
uniform vec2 R; uniform float T; uniform vec2 M; uniform float H; uniform float F;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// The sheet's height: a few long diagonal folds (a sine), bent by slow noise, leaning towards the pointer.
float sheet(vec2 p){
  vec2 m = (M - 0.5) * vec2(R.x / R.y, 1.0);
  vec2 d = m - p; float k = exp(-dot(d, d) * 8.0) * H;
  p += d * 0.18 * k;
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p;
  float n = noise(vec3(p * 0.9, T)) + 0.5 * noise(vec3(p * 1.9 + 3.0, T * 1.4 + F));
  return sin(q.y * 5.5 + q.x * 0.8 + n * 3.2 + F * 1.5) * 0.5 + n * 0.6 + 0.035 * k * sin(sqrt(dot(d, d) + 0.004) * 14.0 - T * 8.0);
}
void main(){
  vec2 uv = gl_FragCoord.xy / R, p = (uv - 0.5) * vec2(R.x / R.y, 1.0);
  float e = 1.0 / R.y, h = sheet(p);
  vec3 n = normalize(vec3(h - sheet(p + vec2(e, 0.0)), h - sheet(p + vec2(0.0, e)), e * 2.2));
  vec3 key = normalize(vec3(-0.6, 0.55, 0.45)), rim = normalize(vec3(0.75, -0.4, 0.35));
  float lit = max(dot(n, key), 0.0);
  vec3 col = mix(vec3(0.016, 0.035, 0.085), vec3(0.075, 0.13, 0.25), lit);            // navy, shaded by the folds
  col += vec3(0.88, 0.66, 0.27) * 0.7 * pow(max(dot(n, normalize(key + vec3(0, 0, 1))), 0.0), 64.0); // gold sheen
  col += vec3(0.25, 0.42, 0.85) * 0.24 * pow(max(dot(n, rim), 0.0), 3.0);               // faint blue rim
  col *= 1.0 - 0.5 * pow(length(uv - 0.5) * 1.3, 2.4);                                   // vignette
  col += (hash(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;                                // dither
  gl_FragColor = vec4(col, 1.0);
}`;

export default function mount(ctx) {
  const band = document.querySelector('#cbg-band');
  const wrap = band?.querySelector('.cbg-wrap');
  if (!wrap) return;
  const frame = document.createElement('div');
  frame.className = 'cbg-frame lab-silk';
  frame.setAttribute('role', 'img');
  frame.setAttribute('aria-label', 'A dark navy silk surface, its folds catching gold and faint blue light.');
  frame.innerHTML = '<div class="lab-silk-sheet"><canvas aria-hidden="true"></canvas></div>';
  wrap.appendChild(frame);
  const sheet = frame.firstChild, canvas = sheet.querySelector('canvas');

  // No WebGL: the panel's own CSS gradient stays as the still fallback.
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { canvas.remove(); return; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('[band-silk]', gl.getProgramInfoLog(prog)); canvas.remove(); return; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one big triangle
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['R', 'T', 'M', 'H', 'F'].map((k) => [k, gl.getUniformLocation(prog, k)]));

  function size() {
    const s = Math.min(devicePixelRatio || 1, ctx.fine ? 1.5 : 1) * 0.5;
    canvas.width = Math.max(1, Math.round(sheet.clientWidth * s));
    canvas.height = Math.max(1, Math.round(sheet.clientHeight * s));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  let t = 7.3, f = 0.5, mx = 0.5, my = 0.5, tx = 0.5, ty = 0.5, h = 0, hT = 0;
  function render() {
    gl.uniform2f(U.R, canvas.width, canvas.height);
    gl.uniform1f(U.T, t); gl.uniform1f(U.F, f * 0.6);
    gl.uniform2f(U.M, mx, my); gl.uniform1f(U.H, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  size();
  canvas.classList.add('is-on');
  new ResizeObserver(() => { size(); render(); }).observe(sheet);
  if (ctx.reduced) { render(); return; }            // one still frame

  // Scroll phase: 0..1 as the panel crosses the screen (followed with a long ease in the loop).
  const st = ctx.ScrollTrigger.create({ trigger: sheet });
  let raf = 0, visible = false, last = 0;
  const damp = (a, b, dt, tau) => a + (b - a) * (1 - Math.exp(-dt / tau));
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    t += dt * 0.022;                                // very slow drift
    f = damp(f, st.progress, dt, 1.2);
    mx = damp(mx, tx, dt, 1.1); my = damp(my, ty, dt, 1.1);
    h = damp(h, hT, dt, 1.6);
    render();
    if (visible && !document.hidden) raf = requestAnimationFrame(loop);
  }
  const run = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(sheet);
  document.addEventListener('visibilitychange', run);
  if (ctx.fine) {
    band.addEventListener('pointermove', (e) => {
      const r = sheet.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height;
      hT = 1;
    });
    band.addEventListener('pointerleave', () => { hT = 0; });
  }
  render();
}
