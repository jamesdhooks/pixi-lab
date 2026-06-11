import { DomScriptScene, type DomMountContext, type DomSceneOptions, type DomStylePayload } from '../../sim/DomScriptScene.js';
import { RawWebGL2ResourceContext, linkRawWebGL2Program, type RawWebGL2ProgramSources } from './RawWebGL2ResourceContext.js';

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

export interface RawWebGL2RenderState {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  /** Present for the built-in single-program shader path; null for custom multi-pass renderers. */
  program: WebGLProgram | null;
  vao: WebGLVertexArrayObject | null;
  resources: RawWebGL2ResourceContext;
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

export function colorNumberToRgb(value: number | undefined, fallback: [number, number, number]): [number, number, number] {
  if (typeof value !== 'number') return fallback;
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function finiteNumberSetting(settings: Record<string, unknown>, key: string, fallback: number): number {
  const value = settings[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

  const gl = canvas.getContext('webgl2', options.webglOptions ?? { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' }) as WebGL2RenderingContext | null;
  if (!gl) {
    root.innerHTML = options.unsupportedMarkup ?? '<div class="grid h-full place-items-center bg-black text-sm text-white/80">WebGL2 is required for this raw engine scene.</div>';
    return () => undefined;
  }

  const program = options.sources ? linkRawWebGL2Program(gl, options.sources) : null;
  const vao = program ? gl.createVertexArray() : null;
  const now = performance.now();
  const dimensions = resizeCanvasToDisplaySize(canvas, gl, options.maxDevicePixelRatio ?? 2);
  const resources = new RawWebGL2ResourceContext(gl);
  resources.resize(dimensions.width, dimensions.height);

  const state: RawWebGL2RenderState = {
    gl,
    canvas,
    program,
    vao,
    resources,
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

  try {
    options.onInit?.(state);
  } catch (error) {
    resources.destroy();
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
    throw error;
  }

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
    resources.resize(size.width, size.height);
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
    resources.destroy();
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
