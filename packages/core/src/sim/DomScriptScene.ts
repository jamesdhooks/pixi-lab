import * as PIXI from 'pixi.js';
import { Scene } from '../Scene.js';
import type { GameContext, SettingsValue, SimStyle } from '../types.js';
import type { Input } from '../Input.js';

export interface DomScriptSceneOptions {
  name: string;
  markup: string;
  script: string;
}

/**
 * Generic DOM/canvas-backed scene adapter.
 *
 * This is still the normal Pixi Lab scene path: GameRuntime owns GameApp,
 * GameApp owns the active Scene, and this Scene owns any low-level canvases it
 * needs internally. It exists for simulations that need direct WebGL resources
 * beside/under a Pixi overlay without forking the React runtime.
 */
export class DomScriptScene extends Scene {
  readonly name: string;

  private root: HTMLDivElement | null = null;
  private scriptElement: HTMLScriptElement | null = null;
  private previousPixi: typeof PIXI | undefined;
  private currentStyle: SimStyle | null = null;
  private unsubscribeSettings: (() => void) | null = null;

  constructor(private readonly options: DomScriptSceneOptions) {
    super();
    this.name = options.name;
  }

  onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;

    const hostCanvas = ctx.systems.pixi.canvas;
    const host = hostCanvas.parentElement;
    if (!host) return;

    hostCanvas.style.opacity = '0';
    hostCanvas.style.pointerEvents = 'none';

    this.previousPixi = (window as typeof window & { PIXI?: typeof PIXI }).PIXI;
    (window as typeof window & { PIXI?: typeof PIXI }).PIXI = PIXI;

    const root = document.createElement('div');
    root.className = 'absolute inset-0 h-full w-full overflow-hidden bg-black';
    root.setAttribute('data-pixi-lab-dom-scene', this.name);
    root.innerHTML = this.options.markup;

    this.currentStyle = ctx.systems.styleManager?.getStyle() ?? null;
    this.applyStyleToRoot(root, this.currentStyle);
    this.applySettingsToRoot(root);

    this.unsubscribeSettings = ctx.systems.settings.onChange((key, value) => {
      if (!this.root) return;
      this.applySettingsToRoot(this.root, { key: String(key), value });
    });

    const script = document.createElement('script');
    script.text = this.options.script;
    root.appendChild(script);

    host.appendChild(root);
    this.root = root;
    this.scriptElement = script;
  }

  onExit(): void {
    this.scriptElement?.remove();
    this.root?.remove();
    this.unsubscribeSettings?.();
    this.scriptElement = null;
    this.root = null;
    this.unsubscribeSettings = null;

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
    if (this.root) this.applyStyleToRoot(this.root, this.currentStyle);
  }

  setMode(id: string): void {
    this.root?.dispatchEvent(new CustomEvent('pixi-lab-mode-change', { detail: { mode: id } }));
  }

  reset(): void {
    this.root?.dispatchEvent(new CustomEvent('pixi-lab-reset'));
  }

  shouldRender(): boolean {
    return true;
  }

  private applyStyleToRoot(root: HTMLDivElement, style: SimStyle | null): void {
    if (!style) return;
    const payload = {
      id: style.id,
      palette: style.palette,
      background: style.background,
      uniforms: style.uniforms,
    };
    root.dataset.pixiLabStyle = JSON.stringify(payload);
    root.dispatchEvent(new CustomEvent('pixi-lab-style-change', { detail: payload }));
  }

  private applySettingsToRoot(
    root: HTMLDivElement,
    change?: { key: string; value: SettingsValue },
  ): void {
    const payload = {
      settings: this.ctx.systems.settings.getAll(),
      change,
    };
    root.dataset.pixiLabSettings = JSON.stringify(payload.settings);
    root.dispatchEvent(new CustomEvent('pixi-lab-settings-change', { detail: payload }));
  }
}
