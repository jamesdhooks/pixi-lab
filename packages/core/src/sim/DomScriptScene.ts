import * as PIXI from 'pixi.js';
import { Scene } from '../Scene.js';
import type { GameContext, SimStyle } from '../types.js';
import type { Input } from '../Input.js';

// ── Public types ──────────────────────────────────────────────────────────────

/** Style data delivered to a mounted DOM scene. */
export interface DomStylePayload {
  id: string;
  palette: number[];
  background: number;
  uniforms?: Record<string, number>;
}

/**
 * Typed context passed to a `DomSceneOptions.mount` function.
 * Provides access to the current style/settings and lets the mount
 * function subscribe to future changes without touching DOM datasets
 * or CustomEvents.
 */
export interface DomMountContext {
  /** Style at mount time — null if no style has been applied yet. */
  getStyle(): DomStylePayload | null;
  /** Full settings snapshot at mount time. */
  getSettings(): Record<string, unknown>;
  /** Subscribe to future style changes. Returns an unsubscribe fn. */
  onStyleChange(cb: (payload: DomStylePayload) => void): () => void;
  /**
   * Subscribe to future settings changes.
   * `change` is set when a single key was changed; undefined means
   * initial delivery of all settings on mount.
   */
  onSettingsChange(
    cb: (
      all: Record<string, unknown>,
      change?: { key: string; value: unknown },
    ) => void,
  ): () => void;
  /** Subscribe to reset signals. Returns an unsubscribe fn. */
  onReset(cb: () => void): () => void;
  /** Subscribe to interaction-mode changes. Returns an unsubscribe fn. */
  onModeChange(cb: (mode: string) => void): () => void;
}

/**
 * Options for a DOM-backed scene that mounts via a typed TypeScript function
 * instead of an injected script string.
 */
export interface DomSceneOptions {
  name: string;
  /** HTML markup inserted into the root div before `mount` is called. */
  markup: string;
  /** Optional scene-owned debug metrics surfaced to host debug panels. */
  getDebugStats?: () => Record<string, string | number | boolean | null> | null;
  /**
   * Called with the root div and a typed context immediately after the root
   * is appended to the DOM. Register style/settings/reset/mode listeners here.
   * Return an optional cleanup fn called on unmount.
   */
  mount: (root: HTMLDivElement, ctx: DomMountContext) => (() => void) | void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function styleToPayload(style: SimStyle): DomStylePayload {
  return {
    id: style.id,
    palette: style.palette,
    background: style.background,
    uniforms: style.uniforms as Record<string, number> | undefined,
  };
}

// ── Scene ─────────────────────────────────────────────────────────────────────

/**
 * Generic DOM/canvas-backed scene adapter.
 *
 * Hosts simulations that need a raw WebGL2 canvas beside the PixiJS canvas
 * without forking the React runtime. The PixiJS canvas is hidden while this
 * scene is active; the mounted function owns any low-level canvases it creates.
 */
export class DomScriptScene extends Scene {
  readonly name: string;

  private root: HTMLDivElement | null = null;
  private mountCleanup: (() => void) | null = null;
  private previousPixi: typeof PIXI | undefined;
  private currentStyle: SimStyle | null = null;
  private unsubscribeSettings: (() => void) | null = null;

  private styleListeners: Array<(p: DomStylePayload) => void> = [];
  private settingsListeners: Array<
    (all: Record<string, unknown>, change?: { key: string; value: unknown }) => void
  > = [];
  private resetListeners: Array<() => void> = [];
  private modeListeners: Array<(mode: string) => void> = [];

  constructor(private readonly options: DomSceneOptions) {
    super();
    this.name = options.name;
  }

  onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;
    this.setQuality(ctx.quality);

    const hostCanvas = ctx.systems.pixi.canvas;
    const host = hostCanvas.parentElement;
    if (!host) return;

    hostCanvas.style.opacity = '0';
    hostCanvas.style.pointerEvents = 'none';

    // Expose the shared PIXI instance as a global so the mounted scene can
    // create a second PIXI.Application without bundling a second copy of PixiJS.
    this.previousPixi = (window as typeof window & { PIXI?: typeof PIXI }).PIXI;
    (window as typeof window & { PIXI?: typeof PIXI }).PIXI = PIXI;

    const root = document.createElement('div');
    root.className = 'absolute inset-0 h-full w-full overflow-hidden bg-black';
    root.setAttribute('data-pixi-lab-dom-scene', this.name);
    root.innerHTML = this.options.markup;

    this.currentStyle = ctx.systems.styleManager?.getStyle() ?? null;

    this.unsubscribeSettings = ctx.systems.settings.onChange((key, value) => {
      if (!this.root) return;
      const all = ctx.systems.settings.getAll() as Record<string, unknown>;
      const change = { key: String(key), value: value as unknown };
      this.settingsListeners.forEach((cb) => cb(all, change));
    });

    const mountCtx = this.buildContext(ctx);

    host.appendChild(root);
    this.root = root;

    const cleanup = this.options.mount(root, mountCtx);
    this.mountCleanup = cleanup ?? null;

    // Deliver initial style and settings after mount registered its listeners
    if (this.currentStyle) {
      const payload = styleToPayload(this.currentStyle);
      this.styleListeners.forEach((cb) => cb(payload));
    }
    const initialSettings = ctx.systems.settings.getAll() as Record<string, unknown>;
    this.settingsListeners.forEach((cb) => cb(initialSettings, undefined));
  }

  onExit(): void {
    this.mountCleanup?.();
    this.mountCleanup = null;

    this.root?.remove();
    this.root = null;

    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;

    this.styleListeners = [];
    this.settingsListeners = [];
    this.resetListeners = [];
    this.modeListeners = [];

    const hostCanvas = this.ctx?.systems?.pixi?.canvas;
    if (hostCanvas) {
      hostCanvas.style.opacity = '';
      hostCanvas.style.pointerEvents = '';
    }

    if (this.previousPixi) {
      (window as typeof window & { PIXI?: typeof PIXI }).PIXI = this.previousPixi;
    } else {
      delete (window as typeof window & { PIXI?: typeof PIXI }).PIXI;
    }
  }

  setStyle(_id: string): void {
    this.currentStyle = this.ctx?.systems.styleManager?.getStyle() ?? this.currentStyle;
    if (!this.currentStyle) return;
    const payload = styleToPayload(this.currentStyle);
    this.styleListeners.forEach((cb) => cb(payload));
  }

  setMode(id: string): void {
    this.modeListeners.forEach((cb) => cb(id));
  }

  reset(): void {
    this.resetListeners.forEach((cb) => cb());
  }

  shouldRender(): boolean {
    return true;
  }

  override getDebugStats(): Record<string, string | number | boolean | null> | null {
    return this.options.getDebugStats?.() ?? null;
  }

  private buildContext(ctx: GameContext): DomMountContext {
    return {
      getStyle: () =>
        this.currentStyle ? styleToPayload(this.currentStyle) : null,

      getSettings: () =>
        ctx.systems.settings.getAll() as Record<string, unknown>,

      onStyleChange: (cb) => {
        this.styleListeners.push(cb);
        return () => {
          this.styleListeners = this.styleListeners.filter((l) => l !== cb);
        };
      },

      onSettingsChange: (cb) => {
        this.settingsListeners.push(cb);
        return () => {
          this.settingsListeners = this.settingsListeners.filter((l) => l !== cb);
        };
      },

      onReset: (cb) => {
        this.resetListeners.push(cb);
        return () => {
          this.resetListeners = this.resetListeners.filter((l) => l !== cb);
        };
      },

      onModeChange: (cb) => {
        this.modeListeners.push(cb);
        return () => {
          this.modeListeners = this.modeListeners.filter((l) => l !== cb);
        };
      },
    };
  }
}
