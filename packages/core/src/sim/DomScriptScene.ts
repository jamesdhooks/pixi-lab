import * as PIXI from 'pixi.js';
import { Scene } from '../Scene.js';
import type { GameContext } from '../types.js';
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
    this.scriptElement = null;
    this.root = null;

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

  shouldRender(): boolean {
    return true;
  }
}
