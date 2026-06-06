import { DomScriptScene, type DomMountContext, type DomSceneOptions, type DomStylePayload } from '../../sim/DomScriptScene.js';

export interface RawWebGL2RenderState {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  /** Present for the built-in single-program shader path; null for custom multi-pass renderers. */
  program: WebGLProgram | null;
  vao: WebGLVertexArrayObject | null;
  settings: Record<string, unknown>;
  style: DomStylePayload | null;
  mode: string | null;
  timeSeconds: number;
  elapsedMs: number;
  deltaSeconds: number;
  width: number;
  height: number;
  frame: number;
}

export interface RawWebGL2ProgramSources {
  vertex: string;
  fragment: string;
}

export interface RawWebGL2SceneOptions {
  name: string;
  markup: string;
  canvasSelector: string;
  /** Optional built-in full-screen shader sources. Omit when the scene owns a custom multi-pass renderer. */
  sources?: RawWebGL2ProgramSources;
  webglOptions?: WebGLContextAttributes;
  maxDevicePixelRatio?: number;
  unsupportedMarkup?: string;
  onInit?: (state: RawWebGL2RenderState) => void;
  onReset?: (state: RawWebGL2RenderState) => void;
  onSettingsChange?: (state: RawWebGL2RenderState, change?: { key: string; value: unknown }) => void;
  onStyleChange?: (state: RawWebGL2RenderState) => void;
  onModeChange?: (state: RawWebGL2RenderState, mode: string) => void;
  render?: (state: RawWebGL2RenderState) => void;
  onDestroy?: (state: RawWebGL2RenderState) => void;
}

export function colorNumberToRgb(value: number | undefined, fallback: [number, number, number]): [number, number, number] {
  if (typeof value !== 'number') return fallback;
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function finiteNumberSetting(settings: Record<string, unknown>, key: string, fallback: number): number {
  const value = settings[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function compileRawWebGL2Shader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate WebGL2 shader');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'unknown WebGL2 shader compile error';
    gl.deleteShader(shader);
    throw new Error(log);
  }

  return shader;
}

export function linkRawWebGL2Program(gl: WebGL2RenderingContext, sources: RawWebGL2ProgramSources): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to allocate WebGL2 shader program');

  const vertex = compileRawWebGL2Shader(gl, gl.VERTEX_SHADER, sources.vertex);
  const fragment = compileRawWebGL2Shader(gl, gl.FRAGMENT_SHADER, sources.fragment);

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'unknown WebGL2 shader link error';
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return program;
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, maxDevicePixelRatio: number): { width: number; height: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  return { width, height };
}

function mountRawWebGL2(root: HTMLDivElement, mountCtx: DomMountContext, options: RawWebGL2SceneOptions): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>(options.canvasSelector);
  if (!canvas) return () => undefined;

  const gl = canvas.getContext('webgl2', options.webglOptions ?? { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) {
    root.innerHTML = options.unsupportedMarkup ?? '<div class="grid h-full place-items-center bg-black text-sm text-white/80">WebGL2 is required for this raw engine scene.</div>';
    return () => undefined;
  }

  const program = options.sources ? linkRawWebGL2Program(gl, options.sources) : null;
  const vao = program ? gl.createVertexArray() : null;
  const now = performance.now();
  const dimensions = resizeCanvasToDisplaySize(canvas, gl, options.maxDevicePixelRatio ?? 2);

  const state: RawWebGL2RenderState = {
    gl,
    canvas,
    program,
    vao,
    settings: mountCtx.getSettings(),
    style: mountCtx.getStyle(),
    mode: null,
    timeSeconds: 0,
    elapsedMs: 0,
    deltaSeconds: 0,
    width: dimensions.width,
    height: dimensions.height,
    frame: 0,
  };

  let startedAt = now;
  let previousTimestamp = now;
  let raf = 0;

  options.onInit?.(state);

  const unsubSettings = mountCtx.onSettingsChange((all, change) => {
    state.settings = all;
    options.onSettingsChange?.(state, change);
  });
  const unsubStyle = mountCtx.onStyleChange((payload) => {
    state.style = payload;
    options.onStyleChange?.(state);
  });
  const unsubReset = mountCtx.onReset(() => {
    startedAt = performance.now();
    previousTimestamp = startedAt;
    state.timeSeconds = 0;
    state.elapsedMs = 0;
    state.deltaSeconds = 0;
    state.frame = 0;
    options.onReset?.(state);
  });
  const unsubMode = mountCtx.onModeChange((mode) => {
    state.mode = mode;
    options.onModeChange?.(state, mode);
  });

  const renderFrame = (timestamp: number) => {
    const size = resizeCanvasToDisplaySize(canvas, gl, options.maxDevicePixelRatio ?? 2);
    state.width = size.width;
    state.height = size.height;
    state.elapsedMs = timestamp - startedAt;
    state.timeSeconds = state.elapsedMs / 1000;
    state.deltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
    previousTimestamp = timestamp;

    options.render?.(state);

    state.frame += 1;
    raf = requestAnimationFrame(renderFrame);
  };

  raf = requestAnimationFrame(renderFrame);

  return () => {
    cancelAnimationFrame(raf);
    unsubSettings();
    unsubStyle();
    unsubReset();
    unsubMode();
    options.onDestroy?.(state);
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
  };
}

export class RawWebGL2Scene extends DomScriptScene {
  constructor(options: RawWebGL2SceneOptions) {
    const domOptions: DomSceneOptions = {
      name: options.name,
      markup: options.markup,
      mount: (root, mountCtx) => mountRawWebGL2(root, mountCtx, options),
    };
    super(domOptions);
  }
}
