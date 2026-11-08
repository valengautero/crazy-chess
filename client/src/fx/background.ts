import { loadSettings } from '../core/settings';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
// Paño de ondas lentas verde/violeta, posterizado para que parezca pixel art.
const FRAG = `
precision mediump float;
uniform vec2 r;
uniform float t;
void main() {
  vec2 uv = gl_FragCoord.xy / r.y;
  vec2 p = uv * 3.2;
  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    p += vec2(0.55 / fi * sin(fi * p.y + t * 0.25 + 0.3 * fi),
              0.55 / fi * sin(fi * p.x + t * 0.20 + 0.7 * fi));
  }
  float v = 0.5 + 0.5 * sin(p.x + p.y + t * 0.1);
  vec3 green  = vec3(0.06, 0.34, 0.24);
  vec3 violet = vec3(0.32, 0.12, 0.48);
  vec3 col = mix(green, violet, smoothstep(0.2, 0.8, v));
  col += 0.05 * sin(p.x * 2.0 - p.y);
  col = floor(col * 9.0 + 0.5) / 9.0;
  col *= 0.8;
  vec2 q = gl_FragCoord.xy / r;
  col *= 0.7 + 0.3 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.3);
  gl_FragColor = vec4(col, 1.0);
}`;

let canvas: HTMLCanvasElement | null = null;
let raf = 0;
let running = false;

export function initFx(): void {
  canvas = document.createElement('canvas');
  canvas.id = 'bg';
  document.body.prepend(canvas);
  const crt = document.createElement('div');
  crt.id = 'crt';
  document.body.append(crt);
  applyFx();
}

/** Aplica los ajustes de CRT y fondo animado. */
export function applyFx(): void {
  const s = loadSettings();
  document.body.classList.toggle('crt-on', s.crt);
  document.body.classList.toggle('persp-3d', s.view3d);
  if (!canvas) return;
  if (s.bgAnim && !running) startBackground();
  if (!s.bgAnim) stopBackground();
}

function stopBackground(): void {
  running = false;
  cancelAnimationFrame(raf);
  if (canvas) canvas.style.display = 'none';
}

function startBackground(): void {
  const c = canvas!;
  const gl = c.getContext('webgl', { antialias: false });
  if (!gl) return; // sin WebGL queda el degradado CSS
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('shader:', gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, 'r');
  const uT = gl.getUniformLocation(prog, 't');

  const resize = () => {
    // resolución baja a propósito: los "píxeles" grandes dan el aspecto retro
    c.width = Math.max(64, Math.floor(window.innerWidth / 4));
    c.height = Math.max(64, Math.floor(window.innerHeight / 4));
    gl.viewport(0, 0, c.width, c.height);
  };
  resize();
  window.addEventListener('resize', resize);
  c.style.display = 'block';
  running = true;
  const t0 = performance.now();
  const loop = () => {
    if (!running) return;
    gl.uniform2f(uR, c.width, c.height);
    gl.uniform1f(uT, (performance.now() - t0) / 2200);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(loop);
  };
  loop();
}
