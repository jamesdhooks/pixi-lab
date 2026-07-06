import { DomScriptScene, type DomMountContext, type DomSceneOptions, type DomStylePayload } from '../../sim/DomScriptScene.js';
import { trackWebGLContext } from '../WebGLContextTracker.js';
import { simulationTimeScaleFromSettings } from '../../sim/SimulationSettings.js';
import { RawWebGL2ResourceContext, linkRawWebGL2Program, type RawWebGL2ProgramSources } from './RawWebGL2ResourceContext.js';

export interface RawWebGL2SceneOptions {
  name: string;
  markup: string;
  canvasSelector: string;
  /** Optional built-in full-screen shader sources. Omit when the scene owns a custom multi-pass renderer. */
  sources?: RawWebGL2ProgramSources;
  webglOptions?: WebGLContextAttributes;
  maxDevicePixelRatio?: number;
  renderScale?: (settings: Record<string, unknown>) => number;
  unsupportedMarkup?: string;
  onInit?: (state: RawWebGL2RenderState) => void;
  onReset?: (state: RawWebGL2RenderState) => void;
  onSettingsChange?: (state: RawWebGL2RenderState, change?: { key: string; value: unknown }) => void;
  onStyleChange?: (state: RawWebGL2RenderState) => void;
  onModeChange?: (state: RawWebGL2RenderState, mode: string) => void;
  getDebugStats?: (state: RawWebGL2RenderState) => Record<string, string | number | boolean | null> | null;
  shouldRender?: (state: RawWebGL2RenderState) => boolean;
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
  timeScale: number;
  width: number;
  height: number;
  frame: number;
  skippedRenderFrames: number;
  pendingRenderDeltaSeconds: number;
}

export function colorNumberToRgb(value: number | undefined, fallback: [number, number, number]): [number, number, number] {
  if (typeof value !== 'number') return fallback;
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function finiteNumberSetting(settings: Record<string, unknown>, key: string, fallback: number): number {
  const value = settings[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readRuntimeMaxPixels(root: HTMLDivElement): number | undefined {
  const source = root.closest<HTMLElement>('[data-pixi-lab-max-pixels]');
  const raw = source?.dataset.pixiLabMaxPixels;
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, maxDevicePixelRatio: number, renderScale: number, maxPixels?: number): { width: number; height: number } {
  let dpr = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio) * Math.max(0.1, renderScale);
  if (maxPixels !== undefined) {
    const cssPixels = Math.max(1, canvas.clientWidth * canvas.clientHeight);
    const physicalPixels = cssPixels * dpr * dpr;
    if (physicalPixels > maxPixels) dpr *= Math.sqrt(maxPixels / physicalPixels);
  }
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  return { width, height };
}

interface RawWebGL2StateHolder {
  current: RawWebGL2RenderState | null;
}

function mountRawWebGL2(root: HTMLDivElement, mountCtx: DomMountContext, options: RawWebGL2SceneOptions, holder?: RawWebGL2StateHolder): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>(options.canvasSelector);
  if (!canvas) return () => undefined;

  const gl = canvas.getContext('webgl2', options.webglOptions ?? { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' }) as WebGL2RenderingContext | null;
  if (!gl) {
    root.innerHTML = options.unsupportedMarkup ?? '<div class="grid h-full place-items-center bg-black text-sm text-white/80">WebGL2 is required for this raw engine scene.</div>';
    return () => undefined;
  }
  const releaseWebGLContext = trackWebGLContext(canvas, {
    kind: 'raw-webgl2',
    label: root.closest<HTMLElement>('[data-pixi-lab-context-label]')?.dataset.pixiLabContextLabel ?? options.name,
  });

  const program = options.sources ? linkRawWebGL2Program(gl, options.sources) : null;
  const vao = program ? gl.createVertexArray() : null;
  const now = performance.now();
  const initialSettings = mountCtx.getSettings();
  const initialRenderScale = options.renderScale?.(initialSettings) ?? 1;
  const dimensions = resizeCanvasToDisplaySize(canvas, gl, options.maxDevicePixelRatio ?? 2, initialRenderScale, readRuntimeMaxPixels(root));
  const resources = new RawWebGL2ResourceContext(gl);
  resources.resize(dimensions.width, dimensions.height);

  const state: RawWebGL2RenderState = {
    gl,
    canvas,
    program,
    vao,
    resources,
    settings: initialSettings,
    style: mountCtx.getStyle(),
    mode: null,
    timeSeconds: 0,
    elapsedMs: 0,
    deltaSeconds: 0,
    timeScale: simulationTimeScaleFromSettings(initialSettings),
    width: dimensions.width,
    height: dimensions.height,
    frame: 0,
    skippedRenderFrames: 0,
    pendingRenderDeltaSeconds: 0,
  };
  if (holder) holder.current = state;

  let startedAt = now;
  let previousTimestamp = now;
  let scaledElapsedSeconds = 0;
  let pendingRenderDeltaSeconds = 0;
  let raf = 0;

  try {
    options.onInit?.(state);
  } catch (error) {
    releaseWebGLContext();
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
    scaledElapsedSeconds = 0;
    state.timeSeconds = 0;
    state.elapsedMs = 0;
    state.deltaSeconds = 0;
    state.timeScale = simulationTimeScaleFromSettings(state.settings);
    state.frame = 0;
    state.skippedRenderFrames = 0;
    state.pendingRenderDeltaSeconds = 0;
    pendingRenderDeltaSeconds = 0;
    options.onReset?.(state);
  });
  const unsubMode = mountCtx.onModeChange((mode) => {
    state.mode = mode;
    options.onModeChange?.(state, mode);
  });

  const renderFrame = (timestamp: number) => {
    const renderScale = options.renderScale?.(state.settings) ?? 1;
    const size = resizeCanvasToDisplaySize(canvas, gl, options.maxDevicePixelRatio ?? 2, renderScale, readRuntimeMaxPixels(root));
    resources.resize(size.width, size.height);
    state.width = size.width;
    state.height = size.height;
    const realDeltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
    previousTimestamp = timestamp;
    state.timeScale = simulationTimeScaleFromSettings(state.settings);
    state.deltaSeconds = realDeltaSeconds * state.timeScale;
    pendingRenderDeltaSeconds += state.deltaSeconds;
    state.pendingRenderDeltaSeconds = pendingRenderDeltaSeconds;
    scaledElapsedSeconds += state.deltaSeconds;
    state.elapsedMs = scaledElapsedSeconds * 1000;
    state.timeSeconds = scaledElapsedSeconds;

    if (options.shouldRender?.(state) !== false) {
      state.deltaSeconds = pendingRenderDeltaSeconds;
      pendingRenderDeltaSeconds = 0;
      state.pendingRenderDeltaSeconds = 0;
      state.skippedRenderFrames = 0;
      options.render?.(state);
    } else {
      state.skippedRenderFrames += 1;
    }

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
    if (holder?.current === state) holder.current = null;
    releaseWebGLContext();
    resources.destroy();
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
  };
}

export class RawWebGL2Scene extends DomScriptScene {
  constructor(options: RawWebGL2SceneOptions) {
    const stateHolder: RawWebGL2StateHolder = { current: null };
    const domOptions: DomSceneOptions = {
      name: options.name,
      markup: options.markup,
      mount: (root, mountCtx) => mountRawWebGL2(root, mountCtx, options, stateHolder),
      getDebugStats: () => stateHolder.current && options.getDebugStats ? options.getDebugStats(stateHolder.current) : null,
    };
    super(domOptions);
  }
}
