/**
 * packages/core/src/GameApp.ts
 *
 * The top-level game runtime. React mounts this via GameRuntime.tsx.
 *
 * Responsibilities:
 * - Bootstrap PixiApp, PhysicsWorld, Input, Audio, Ticker, Telemetry
 * - Manage the active Scene
 * - Run the AI tick and screensaver manager each frame
 * - Emit GameEvents upward to the React shell via the provided callback
 * - Clean shutdown on destroy()
 */
import type { GameContext, GameEvent, GameMode } from './types';
import type { Scene } from './Scene';
import { Ticker } from './Ticker';
import { Input } from './Input';
import { Audio } from './Audio';
import { Settings } from './Settings';
import { Telemetry } from './Telemetry';
import { PixiApp } from './render/PixiApp';
import { SpriteFactory } from './render/Sprites';
import { ParticleSystem } from './render/Particles';
import { styleRegistry } from './render/Styles';
import { PhysicsWorld } from './physics/World';
import { ScreensaverManager } from './screensaver/ScreensaverManager';
import type { AIController } from './ai/AIController';
import type { HighScoreProvider } from './scoring/HighScoreProvider';
import { ApiHighScoreProvider } from './scoring/HighScoreProvider';
import type { GameDefinition } from './LabExperience';

export interface GameAppOptions {
  container: HTMLElement;
  definition: GameDefinition;
  userId?: string;
  /** Override score provider (e.g. noop for preview mode) */
  scoreProvider?: HighScoreProvider;
  /** Initial mode */
  mode?: GameMode;
  /** Palette name from Styles registry */
  palette?: string;
  /** Emit events upward to React shell */
  onEvent?: (event: GameEvent) => void;
}

export class GameApp {
  private pixi!: PixiApp;
  private physicsWorld!: PhysicsWorld;
  private input: Input;
  private audio: Audio;
  private _settings: Settings;
  private ticker: Ticker;
  private telemetry: Telemetry;
  private spriteFactory!: SpriteFactory;
  private particleSystem!: ParticleSystem;
  private screensaverManager: ScreensaverManager;
  private aiController: AIController | null = null;
  private scoreProvider: HighScoreProvider;
  private onEvent: (event: GameEvent) => void;

  private currentScene: Scene | null = null;
  private _mode: GameMode;
  private definition: GameDefinition;
  private ctx!: GameContext;
  private ready = false;

  // Track if any human input happened this frame
  private hasHumanInputThisFrame = false;

  constructor(private opts: GameAppOptions) {
    this.definition = opts.definition;
    this._mode = opts.mode ?? 'play';
    this.scoreProvider = opts.scoreProvider ?? new ApiHighScoreProvider();
    this.onEvent = opts.onEvent ?? (() => undefined);

    this.input = new Input();
    this.audio = new Audio();
    this._settings = new Settings(opts.definition.id, opts.definition.settingsFields);
    this.telemetry = new Telemetry();

    this.screensaverManager = new ScreensaverManager({
      thresholdMs: (this.definition.configDefaults?.screensaverMs as number) ?? 60_000,
      onEnter: this.handleScreensaverEnter,
      onExit: this.handleScreensaverExit,
    });

    this.ticker = new Ticker({
      onFixedUpdate: this.onFixedUpdate,
      onUpdate: this.onUpdate,
      onRender: this.onRender,
    });
  }

  /** Async init — creates Pixi renderer. Call once before using. */
  async init() {
    const { container, definition, palette } = this.opts;

    this.pixi = await PixiApp.create({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
      background: styleRegistry.getPalette(palette ?? definition.paletteHint ?? 'rainbow')
        .background,
    });

    this.spriteFactory = new SpriteFactory(this.pixi.app);
    this.particleSystem = new ParticleSystem(this.pixi.app, this.spriteFactory);
    this.physicsWorld = new PhysicsWorld();

    this.ctx = {
      mode: this._mode,
      width: this.pixi.width,
      height: this.pixi.height,
      systems: {
        world: this.physicsWorld,
        pixi: this.pixi,
        sprites: this.spriteFactory,
        particles: this.particleSystem,
        audio: this.audio,
        settings: this._settings,
      },
      emit: this.onEvent,
    };

    this.input.mount(container);
    this.telemetry.mount(container);

    // AI controller
    if (definition.capabilities.aiAutoplay && definition.aiFactory) {
      this.aiController = definition.aiFactory(this.ctx);
    }

    // Watch for resize
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      this.handleResize(r.width, r.height);
    });
    ro.observe(container);

    this.ready = true;
  }

  /** Start the game — mount main scene and begin ticking. */
  start() {
    if (!this.ready) throw new Error('GameApp.init() must be called before start()');
    const scene = this.definition.factory(this.ctx);
    this.switchScene(scene);
    this.ticker.start();
  }

  /** Pause game tick. */
  pause() {
    this._mode = 'paused';
    this.ctx.mode = 'paused';
    this.ticker.stop();
    this.onEvent({ kind: 'paused' });
  }

  /** Resume from pause. */
  resume() {
    if (this._mode !== 'paused') return;
    this._mode = 'play';
    this.ctx.mode = 'play';
    this.ticker.start();
    this.onEvent({ kind: 'resumed' });
  }

  /** Switch active scene. */
  switchScene(scene: Scene) {
    this.currentScene?.onExit();
    this.currentScene = scene;
    scene.onEnter(this.ctx, this.input);
  }

  setMode(mode: GameMode) {
    this._mode = mode;
    this.ctx.mode = mode;
  }

  get scoreHandler(): HighScoreProvider {
    return this.scoreProvider;
  }

  get settings(): Settings {
    return this._settings;
  }

  get physicsW(): PhysicsWorld {
    return this.physicsWorld;
  }

  get pixiApp(): PixiApp {
    return this.pixi;
  }

  get sprites(): SpriteFactory {
    return this.spriteFactory;
  }

  get audioSystem(): Audio {
    return this.audio;
  }

  /** Enable/disable AI autoplay. */
  setAIEnabled(enabled: boolean) {
    if (!enabled) {
      this.aiController = null;
    } else if (!this.aiController && this.definition.aiFactory) {
      this.aiController = this.definition.aiFactory(this.ctx);
    }
  }

  /** Update screensaver idle threshold. */
  setScreensaverThreshold(ms: number) {
    this.screensaverManager.setThresholdMs(ms);
  }

  destroy() {
    this.ticker.stop();
    this.currentScene?.onExit();
    this.currentScene = null;
    this.input.unmount();
    this.telemetry.unmount();
    this.physicsWorld.destroy();
    this.spriteFactory?.destroyAll();
    this.particleSystem?.destroy();
    this.pixi?.destroy();
    this.audio.dispose();
  }

  // ── Ticker callbacks ──────────────────────────────────────────────────────

  private onFixedUpdate = (dt: number) => {
    if (this._mode === 'paused') return;
    this.physicsWorld.step(dt);
    this.currentScene?.fixedUpdate(dt);
  };

  private onUpdate = (dt: number, _physicsSteps: number) => {
    if (this._mode === 'paused') return;

    // Flush input — captures justDown/justUp this frame
    this.input.flush();
    const snap = this.input.snapshot;
    this.hasHumanInputThisFrame = snap.justDown.size > 0;

    // AI tick — inject intents before scene update so scene sees them
    if (
      this.aiController &&
      (this._mode === 'play' || this._mode === 'screensaver' || this._mode === 'demo')
    ) {
      const intents = this.aiController.think({
        width: this.ctx.width,
        height: this.ctx.height,
        dt,
        state: {},
      });
      for (const intent of intents) {
        this.input.injectIntent(intent);
      }
    }

    // Screensaver manager
    this.screensaverManager.tick(dt, this.hasHumanInputThisFrame);

    this.currentScene?.update(dt);

    // Update telemetry
    this.telemetry.update({
      fps: this.ticker.fps,
      sceneName: this.currentScene?.name,
      mode: this._mode,
    });
  };

  private onRender = (alpha: number) => {
    if (this._mode === 'paused') return;
    this.currentScene?.render(alpha);
  };

  private handleResize = (width: number, height: number) => {
    this.pixi.resize(width, height);
    this.ctx.width = width;
    this.ctx.height = height;
    this.currentScene?.resize(width, height);
  };

  private handleScreensaverEnter = () => {
    this._mode = 'screensaver';
    this.ctx.mode = 'screensaver';
    if (this.definition.capabilities.screensaver && this.definition.screensaverFactory) {
      const scene = this.definition.screensaverFactory(this.ctx);
      this.switchScene(scene);
    }
    this.onEvent({ kind: 'screensaver_enter' });
  };

  private handleScreensaverExit = () => {
    this._mode = 'play';
    this.ctx.mode = 'play';
    // Restore main scene
    const scene = this.definition.factory(this.ctx);
    this.switchScene(scene);
    this.onEvent({ kind: 'screensaver_exit' });
  };
}
