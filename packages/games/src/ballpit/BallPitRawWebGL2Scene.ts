import { RawWebGL2Scene, finiteNumberSetting, colorNumberToRgb, type RawWebGL2RenderState } from '@hooksjam/pixi-lab-core';

type BallPitInputMode = 'single' | 'stream' | 'explosion';

interface RawBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: [number, number, number];
}

interface BallPitRawState extends RawWebGL2RenderState {
  balls?: RawBall[];
  inputMode?: BallPitInputMode;
  pointerDown?: boolean;
  pointerX?: number;
  pointerY?: number;
  streamAccumulator?: number;
  ballProgram?: WebGLProgram;
  buffer?: WebGLBuffer;
  aPosition?: number;
  uResolution?: WebGLUniformLocation | null;
  uCenter?: WebGLUniformLocation | null;
  uRadius?: WebGLUniformLocation | null;
  uColor?: WebGLUniformLocation | null;
  cleanupPointer?: () => void;
}

const VERTEX = `#version 300 es
in vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_radius;
out vec2 v_unit;
void main() {
  v_unit = a_position;
  vec2 pixel = u_center + a_position * u_radius;
  vec2 clip = (pixel / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_unit;
uniform vec3 u_color;
out vec4 outColor;
void main() {
  float d = length(v_unit);
  if (d > 1.0) discard;
  float rim = smoothstep(1.0, 0.68, d);
  float gloss = smoothstep(0.5, 0.0, length(v_unit - vec2(-0.32, -0.38)));
  vec3 color = u_color * (0.48 + 0.52 * rim) + vec3(0.35) * gloss;
  outColor = vec4(color, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program');
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown program error';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

const PALETTE: [number, number, number][] = [
  [0.56, 0.45, 1.0],
  [0.21, 0.78, 0.96],
  [1.0, 0.45, 0.72],
  [0.32, 0.9, 0.64],
  [1.0, 0.66, 0.24],
];

function maxBalls(state: BallPitRawState): number {
  return Math.max(20, Math.min(900, finiteNumberSetting(state.settings, 'maxBalls', 220)));
}

function randomColor(state: BallPitRawState): [number, number, number] {
  const raw = state.settings.ballColor;
  if (typeof raw === 'number') return colorNumberToRgb(raw, [0.56, 0.45, 1.0]);
  return PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? PALETTE[0];
}

function spawn(state: BallPitRawState, x: number, y: number, vx = 0, vy = 0): void {
  const balls = state.balls ?? [];
  if (balls.length >= maxBalls(state)) return;
  const r = 10 + Math.random() * 18;
  balls.push({ x, y, vx, vy, radius: r, color: randomColor(state) });
  state.balls = balls;
}

function spawnExplosion(state: BallPitRawState, x: number, y: number): void {
  for (let i = 0; i < 22; i += 1) {
    const a = (Math.PI * 2 * i) / 22 + Math.random() * 0.16;
    const speed = 220 + Math.random() * 320;
    spawn(state, x, y, Math.cos(a) * speed, Math.sin(a) * speed);
  }
}

function installPointer(state: BallPitRawState): void {
  const canvas = state.canvas;
  const toLocal = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = state.width / Math.max(1, rect.width);
    const scaleY = state.height / Math.max(1, rect.height);
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  };
  const down = (event: PointerEvent) => {
    const p = toLocal(event);
    state.pointerDown = true;
    state.pointerX = p.x;
    state.pointerY = p.y;
    if (state.inputMode === 'explosion') spawnExplosion(state, p.x, p.y);
    else spawn(state, p.x, p.y);
    canvas.setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    const p = toLocal(event);
    state.pointerX = p.x;
    state.pointerY = p.y;
  };
  const up = (event: PointerEvent) => {
    state.pointerDown = false;
    canvas.releasePointerCapture?.(event.pointerId);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  state.cleanupPointer = () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  };
}

export class BallPitRawWebGL2Scene extends RawWebGL2Scene {
  constructor() {
    super({
      name: 'BallPitRawWebGL2',
      canvasSelector: 'canvas',
      markup: '<canvas class="h-full w-full touch-none bg-slate-950"></canvas>',
      maxDevicePixelRatio: 2,
      onInit: (state) => {
        const s = state as BallPitRawState;
        const gl = s.gl;
        s.inputMode = 'single';
        s.streamAccumulator = 0;
        s.balls = [];
        s.ballProgram = link(gl);
        s.buffer = gl.createBuffer() ?? undefined;
        const vertices = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.buffer ?? null);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        s.aPosition = gl.getAttribLocation(s.ballProgram, 'a_position');
        s.uResolution = gl.getUniformLocation(s.ballProgram, 'u_resolution');
        s.uCenter = gl.getUniformLocation(s.ballProgram, 'u_center');
        s.uRadius = gl.getUniformLocation(s.ballProgram, 'u_radius');
        s.uColor = gl.getUniformLocation(s.ballProgram, 'u_color');
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        installPointer(s);
      },
      onReset: (state) => {
        const s = state as BallPitRawState;
        s.balls = [];
        s.streamAccumulator = 0;
      },
      onModeChange: (state, mode) => {
        const s = state as BallPitRawState;
        if (mode === 'single' || mode === 'stream' || mode === 'explosion') s.inputMode = mode;
      },
      render: (state) => {
        const s = state as BallPitRawState;
        const gl = s.gl;
        const balls = s.balls ?? [];
        if (s.inputMode === 'stream' && s.pointerDown && typeof s.pointerX === 'number' && typeof s.pointerY === 'number') {
          s.streamAccumulator = (s.streamAccumulator ?? 0) + s.deltaSeconds;
          while (s.streamAccumulator >= 0.04) {
            spawn(s, s.pointerX + (Math.random() - 0.5) * 20, s.pointerY + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 80, -40);
            s.streamAccumulator -= 0.04;
          }
        }
        const gravity = finiteNumberSetting(s.settings, 'gravity', 1.0) * 820;
        const bounce = finiteNumberSetting(s.settings, 'bounciness', 0.72);
        for (const b of balls) {
          b.vy += gravity * s.deltaSeconds;
          b.x += b.vx * s.deltaSeconds;
          b.y += b.vy * s.deltaSeconds;
          if (b.x - b.radius < 0) { b.x = b.radius; b.vx = Math.abs(b.vx) * bounce; }
          if (b.x + b.radius > s.width) { b.x = s.width - b.radius; b.vx = -Math.abs(b.vx) * bounce; }
          if (b.y - b.radius < 0) { b.y = b.radius; b.vy = Math.abs(b.vy) * bounce; }
          if (b.y + b.radius > s.height) { b.y = s.height - b.radius; b.vy = -Math.abs(b.vy) * bounce; b.vx *= 0.992; }
        }
        gl.viewport(0, 0, s.width, s.height);
        gl.clearColor(0.014, 0.019, 0.045, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (!s.ballProgram || !s.buffer || s.aPosition === undefined) return;
        gl.useProgram(s.ballProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.buffer);
        gl.enableVertexAttribArray(s.aPosition);
        gl.vertexAttribPointer(s.aPosition, 2, gl.FLOAT, false, 0, 0);
        if (!s.uResolution || !s.uCenter || !s.uRadius || !s.uColor) return;
        gl.uniform2f(s.uResolution, s.width, s.height);
        for (const b of balls) {
          gl.uniform2f(s.uCenter, b.x, b.y);
          gl.uniform1f(s.uRadius, b.radius);
          gl.uniform3f(s.uColor, b.color[0], b.color[1], b.color[2]);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      },
      onDestroy: (state) => {
        const s = state as BallPitRawState;
        s.cleanupPointer?.();
        if (s.buffer) s.gl.deleteBuffer(s.buffer);
        if (s.ballProgram) s.gl.deleteProgram(s.ballProgram);
      },
    });
  }
}
