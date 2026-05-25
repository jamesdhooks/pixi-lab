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
import type { GameContext, GameEvent, GameMode, RenderQuality } from './types';
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
import type { LabExperience } from './LabExperience';
import { RenderTargetPool } from './render/RenderTargetPool';
import { RenderStyleManager } from './render/RenderStyleManager';
import { ProceduralTextureLibrary } from './render/procedural/ProceduralTextureLibrary';
import { GestureInterpreter } from './gestures/GestureInterpreter';
import { PerformanceGovernor } from './performance/PerformanceGovernor';
import { DirectorMode } from './director/DirectorMode';
import { StagnationRecovery } from './stagnation/StagnationRecovery';
import { DebugOverlay } from './debug/DebugOverlay';
import { SimulationScene } from './sim/SimulationScene';

export interface GameAppOptions {
  container: HTMLElement;
  definition: LabExperience;
  userId?: string;
  /** Override score provider (e.g. noop for preview mode) */
  scoreProvider?: HighScoreProvider;
  /** Initial mode */
  mode?: GameMode;
  /** Palette name from Styles registry */
  palette?: string;
  seed?: number;
  quality?: RenderQuality;
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
  private renderTargets!: RenderTargetPool;
  private styleManager!: RenderStyleManager;
  private procedural!: ProceduralTextureLibrary;
  private gestures!: GestureInterpreter;
  private governor!: PerformanceGovernor;
  private director!: DirectorMode;
  private stagnation!: StagnationRecovery;
  private debug!: DebugOverlay;

  private currentScene: Scene | null = null;
  private _mode: GameMode;
  private definition: LabExperience;
  private ctx!: GameContext;
  private ready = false;
  private quality: RenderQuality;

  // Track if any human input happened this frame
  private hasHumanInputThisFrame = false;

  constructor(private opts: GameAppOptions) {
    this.definition = opts.definition;
    this._mode = opts.mode ?? 'play';
    this.quality = opts.quality ?? 'basic';
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
    this.renderTargets = new RenderTargetPool(this.pixi.renderer);
    this.styleManager = new RenderStyleManager();
    this.procedural = new ProceduralTextureLibrary(this.pixi.renderer);
    this.gestures = new GestureInterpreter();
    this.governor = new PerformanceGovernor({
      onQualityChange: (quality) => {
        this.quality = quality;
        this.ctx.quality = quality;
        this.styleManager.setQuality(quality);
        if (this.currentScene instanceof SimulationScene) {
          this.currentScene.setQuality(quality);
        }
        this.onEvent({ kind: 'quality_change', payload: { quality } });
      },
    });
    this.director = new DirectorMode(definition.directorEvents ?? [], opts.seed ?? definition.defaultSeed ?? 1);
    this.stagnation = new StagnationRecovery();
    this.debug = new DebugOverlay(this.pixi.app);

    this.ctx = {
      mode: this._mode,
      seed: opts.seed ?? definition.defaultSeed ?? 1,
      quality: this.quality,
      width: this.pixi.width,
      height: this.pixi.height,
      systems: {
        world: this.physicsWorld,
        pixi: this.pixi,
        sprites: this.spriteFactory,
        particles: this.particleSystem,
        audio: this.audio,
        settings: this._settings,
        renderTargets: this.renderTargets,
        styleManager: this.styleManager,
        gestures: this.gestures,
        governor: this.governor,
        director: this.director,
        stagnation: this.stagnation,
        debug: this.debug,
        procedural: this.procedural,
      },
      emit: this.onEvent,
    };

    this.input.mount(container);
    this.telemetry.mount(container);

    // AI controller
    if (definition.kind === 'game' && definition.capabilities.aiAutoplay && definition.aiFactory) {
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

  setQuality(quality: RenderQuality) {
    this.quality = quality;
    this.ctx.quality = quality;
    this.governor.setQuality(quality);
    this.styleManager.setQuality(quality);
    if (this.currentScene instanceof SimulationScene) {
      this.currentScene.setQuality(quality);
    }
  }

  setStyle(styleId: string) {
    this.styleManager.setStyle(styleId);
    if (this.currentScene instanceof SimulationScene) {
      this.currentScene.setStyle(styleId);
    }
    this.onEvent({ kind: 'style_change', payload: { styleId } });
  }

  setDebugEnabled(enabled: boolean) {
    this.debug.setEnabled(enabled);
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
    } else if (!this.aiController && this.definition.kind === 'game' && this.definition.aiFactory) {
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
    this.debug?.destroy();
    this.renderTargets?.destroy();
    this.procedural?.destroy();
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
    const gestureEvents = this.gestures.update(snap);
    if (gestureEvents.length > 0) {
      this.hasHumanInputThisFrame = true;
      if (this.currentScene instanceof SimulationScene) {
        this.currentScene.pushGestures(gestureEvents);
      }
    }

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
    const directorEvent = this.director.update(dt, !this.hasHumanInputThisFrame);
    if (directorEvent) {
      this.onEvent({ kind: 'director_event', payload: { id: directorEvent.id } });
    }

    this.currentScene?.update(dt);

    const newQuality = this.governor.update(dt);
    if (newQuality) {
      this.onEvent({ kind: 'quality_change', payload: { quality: newQuality } });
    }

    if (this.currentScene instanceof SimulationScene) {
      const report = this.stagnation.update(dt, this.currentScene);
      if (report) {
        this.onEvent({ kind: 'stagnation_recovery', payload: { reason: report.reason } });
      }
    }

    this.debug.update({
      fps: this.ticker.fps,
      quality: this.quality,
      renderTargets: JSON.stringify(this.renderTargets.stats()),
    });

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
    this.renderTargets.resizePersistent(width, height);
    this.ctx.width = width;
    this.ctx.height = height;
    this.currentScene?.resize(width, height);
  };

  private handleScreensaverEnter = () => {
    this._mode = 'screensaver';
    this.ctx.mode = 'screensaver';
    if (this.definition.kind === 'game' && this.definition.capabilities.screensaver && this.definition.screensaverFactory) {
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
