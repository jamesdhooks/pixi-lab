export type WebGLContextOwnerKind = 'pixi' | 'raw-webgl2';

export interface WebGLContextTrackOptions {
  kind: WebGLContextOwnerKind;
  label: string;
}

export interface WebGLContextDebugEntry {
  id: number;
  kind: WebGLContextOwnerKind;
  label: string;
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  createdAt: number;
  lost: boolean;
}

export interface WebGLContextDebugSnapshot {
  mounted: number;
  live: number;
  lost: number;
  pixi: number;
  rawWebGL2: number;
  entries: WebGLContextDebugEntry[];
}

interface WebGLContextTrackedEntry extends WebGLContextDebugEntry {
  canvas: HTMLCanvasElement;
  release: () => void;
}

interface WebGLContextTrackerState {
  nextId: number;
  entries: Map<number, WebGLContextTrackedEntry>;
}

declare global {
  interface Window {
    __pixiLabWebGLContextTracker?: WebGLContextTrackerState;
  }
}

function trackerState(): WebGLContextTrackerState | null {
  if (typeof window === 'undefined') return null;
  window.__pixiLabWebGLContextTracker ??= {
    nextId: 1,
    entries: new Map<number, WebGLContextTrackedEntry>(),
  };
  return window.__pixiLabWebGLContextTracker;
}

export function trackWebGLContext(canvas: HTMLCanvasElement, options: WebGLContextTrackOptions): () => void {
  const state = trackerState();
  if (!state) return () => undefined;
  const id = state.nextId;
  state.nextId += 1;
  const entry: WebGLContextTrackedEntry = {
    id,
    kind: options.kind,
    label: options.label,
    width: canvas.width,
    height: canvas.height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
    createdAt: performance.now(),
    lost: false,
    canvas,
    release: () => undefined,
  };
  const handleContextLost = () => {
    entry.lost = true;
  };
  const handleContextRestored = () => {
    entry.lost = false;
  };
  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);
  entry.release = () => {
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    state.entries.delete(id);
  };
  state.entries.set(id, entry);
  return entry.release;
}

export function getWebGLContextDebugSnapshot(): WebGLContextDebugSnapshot {
  const state = trackerState();
  if (!state) return { mounted: 0, live: 0, lost: 0, pixi: 0, rawWebGL2: 0, entries: [] };
  const entries = Array.from(state.entries.values()).map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    label: entry.label,
    width: entry.canvas.width,
    height: entry.canvas.height,
    clientWidth: entry.canvas.clientWidth,
    clientHeight: entry.canvas.clientHeight,
    createdAt: entry.createdAt,
    lost: entry.lost,
  }));
  const lost = entries.filter((entry) => entry.lost).length;
  return {
    mounted: entries.length,
    live: entries.length - lost,
    lost,
    pixi: entries.filter((entry) => entry.kind === 'pixi').length,
    rawWebGL2: entries.filter((entry) => entry.kind === 'raw-webgl2').length,
    entries,
  };
}
