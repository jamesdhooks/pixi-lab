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
import type {
  AmbientDataAdapter,
  BurstEffect,
  GameContext,
  GameEvent,
  GameMode,
  InputSnapshot,
  RenderQuality,
} from './types.js';
import type { RenderBackendProfileSelection } from './runtime/RenderBackendProfile.js';
import type { Scene } from './Scene.js';
import { Ticker } from './Ticker.js';
import { Input } from './Input.js';
import { Audio } from './Audio.js';
import { Settings } from './Settings.js';
import { Telemetry } from './Telemetry.js';
import { PixiApp } from './render/PixiApp.js';
import { SpriteFactory } from './render/Sprites.js';
import { ParticleSystem } from './render/Particles.js';
import { styleRegistry } from './render/Styles.js';
import { PhysicsWorld } from './physics/World.js';
import { ScreensaverManager } from './screensaver/ScreensaverManager.js';
import type { AIController } from './ai/AIController.js';
import type { SimulationAI, SimAIContext } from './ai/SimulationAI.js';
import type { SimulationExperience } from './LabExperience.js';
import type { HighScoreProvider } from './scoring/HighScoreProvider.js';
import { ApiHighScoreProvider } from './scoring/HighScoreProvider.js';
import type { LabExperience } from './LabExperience.js';
import { RenderTargetPool } from './render/RenderTargetPool.js';
import { RenderStyleManager } from './render/RenderStyleManager.js';
import { ProceduralTextureLibrary } from './render/procedural/ProceduralTextureLibrary.js';
import { GestureInterpreter } from './gestures/GestureInterpreter.js';
import { PerformanceGovernor } from './performance/PerformanceGovernor.js';
import { DirectorMode } from './director/DirectorMode.js';
import { StagnationRecovery } from './stagnation/StagnationRecovery.js';
import { DebugOverlay } from './debug/DebugOverlay.js';
import { SimulationScene } from './sim/SimulationScene.js';
import { BurstEmitterSystem } from './fx/BurstEmitterSystem.js';
import { AmbientDataManager } from './ambient/AmbientDataManager.js';

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
  /** Canonical engine/backend/profile selection chosen by the host runtime. */
  renderSelection?: RenderBackendProfileSelection;
  /** Legacy scene compatibility tier derived from renderSelection. */
  quality?: RenderQuality;
  transparent?: boolean;
  sleepMode?: boolean;
  lowMotion?: boolean;
  globalIntensity?: number;
  ambientDataAdapters?: AmbientDataAdapter[];
  /**
   * Cap the total rendered pixel count passed to PixiApp.
   * Useful on fill-rate-constrained devices (e.g. Raspberry Pi).
   * Example: 921_600 ≈ 1280×720.
   */
  maxPixels?: number;
  /**
   * Cap the game-loop tick rate (updates + renders per second).
   * Browser rAF callbacks arriving sooner than `1000/maxFps` ms since the
   * last processed frame are skipped. Useful for preview tiles that must share
   * the JS thread without saturating it.
   */
  maxFps?: number;
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
  private simulationAi: SimulationAI | null = null;
  private elapsedTime = 0;
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
  private burstEmitters!: BurstEmitterSystem;
  private ambientData!: AmbientDataManager;

  private currentScene: Scene | null = null;
  private _mode: GameMode;
  private definition: LabExperience;
  private ctx!: GameContext;
  private ready = false;
  /** Set to true on first destroy() call — makes destroy() idempotent and lets
   *  async init() bail out if cleanup was called before it resolved. */
  private destroyed = false;
  private quality: RenderQuality;
  private resizeObserver: ResizeObserver | null = null;
  private renderInvalidated = true;
  private resizeCount = 0;
  private screensaverUsingAi = false;

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
    this._settings = new Settings(opts.definition.id, opts.definition.settingsFields ?? []);
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
      maxFps: opts.maxFps,
    });
  }

  /** Async init — creates Pixi renderer. Call once before using. */
  async init() {
    const { container, definition, palette } = this.opts;

    // Measure the container. getBoundingClientRect() forces a synchronous
    // layout flush. clientWidth/offsetWidth are fallbacks. window.inner* is
    // the last resort for full-viewport containers whose CSS-percentage widths
    // can compute to 0 (e.g. width:100% on absolute/inset-0 inside fixed/inset-0
    // when the fixed parent has no explicit width declaration).
    const rect = container.getBoundingClientRect();
    const measuredW =
      rect.width || container.clientWidth || container.offsetWidth || window.innerWidth;
    const measuredH =
      rect.height || container.clientHeight || container.offsetHeight || window.innerHeight;
    this.pixi = await PixiApp.create({
      container,
      width: measuredW,
      height: measuredH,
      background: styleRegistry.getPalette(palette ?? definition.paletteHint ?? 'rainbow')
        .background,
      backgroundAlpha: this.opts.transparent || definition.transparentBackground ? 0 : 1,
      // Force WebGL — skips WebGPU auto-detection which adds overhead and can
      // be unstable on embedded GPU drivers (e.g. Raspberry Pi VideoCore).
      preference: 'webgl',
      // Cap DPR at 1 for basic quality — avoids 4× pixel overhead on HiDPI
      // screens when the device can't sustain higher-resolution rendering.
      maxDpr: this.quality === 'basic' ? 1 : 2,
      maxPixels: this.opts.maxPixels,
    });

    // If destroy() was called while PixiApp was initialising (e.g. React
    // StrictMode unmount), tear down the canvas that was just appended and bail.
    if (this.destroyed) {
      this.pixi.destroy();
      return;
    }

    this.spriteFactory = new SpriteFactory(this.pixi.app);
    this.particleSystem = new ParticleSystem(this.pixi.app, this.spriteFactory);
    this.physicsWorld = new PhysicsWorld();
    this.renderTargets = new RenderTargetPool(this.pixi.renderer);
    this.styleManager = new RenderStyleManager();
    if (definition.styleManifest) {
      this.styleManager.setManifest(definition.styleManifest);
    }
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
    this.director = new DirectorMode(definition.directorEvents ?? [], this.opts.seed ?? definition.defaultSeed ?? 1);
    this.stagnation = new StagnationRecovery();
    this.debug = new DebugOverlay(this.pixi.app);
    this.burstEmitters = new BurstEmitterSystem(this.pixi.app);
    this.burstEmitters.setQuality(this.quality);
    this.burstEmitters.setSleepMode((this.opts.sleepMode ?? false) || (this.opts.lowMotion ?? false));
    this.burstEmitters.setGlobalIntensity(this.opts.globalIntensity ?? 1);
    this.ambientData = new AmbientDataManager();
    for (const adapter of this.opts.ambientDataAdapters ?? []) {
      this.ambientData.register(adapter);
    }

    this.ctx = {
      mode: this._mode,
      seed: this.opts.seed ?? definition.defaultSeed ?? 1,
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
        burstEmitters: this.burstEmitters,
        ambientData: this.ambientData,
      },
      emit: this.onEvent,
    };

    this.input.mount(container);
    this.telemetry.mount(container);

    // Game AI is opt-in. `capabilities.aiAutoplay` means "supported", not
    // "run in normal play"; hidden AI input keeps scenes hot and can force
    // continuous renders even when nothing is visible.
    // Simulation demo AI
    if (definition.kind === 'simulation') {
      const simDef = definition as SimulationExperience;
      if (simDef.demoAiFactory) {
        this.simulationAi = simDef.demoAiFactory(this.ctx);
      }
    }

    // Watch for resize
    this.resizeObserver = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      this.handleResize(r.width, r.height);
    });
    this.resizeObserver.observe(container);

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
    this.burstEmitters.setPaused(true);
    this.ticker.stop();
    this.onEvent({ kind: 'paused' });
  }

  /** Resume from pause. */
  resume() {
    if (this._mode !== 'paused') return;
    this._mode = 'play';
    this.ctx.mode = 'play';
    this.burstEmitters.setPaused(false);
    this.ticker.start();
    this.onEvent({ kind: 'resumed' });
  }

  /** Switch active scene. */
  switchScene(scene: Scene) {
    this.currentScene?.onExit();
    this.currentScene = scene;
    scene.onEnter(this.ctx, this.input);
    this.pixi.setImageRendering(scene.getCanvasImageRendering());
    this.renderInvalidated = true;
    // Propagate current interaction mode to the incoming scene
    if (this._interactionMode) scene.setMode(this._interactionMode);
  }

  setMode(mode: GameMode) {
    if (!this.ready) return;
    const prev = this._mode;
    this._mode = mode;
    this.ctx.mode = mode;
    if (mode === 'demo' && prev !== 'demo' && this.simulationAi?.onActivate) {
      this.simulationAi.onActivate(this.buildSimAIContext(0));
    }
  }

  setQuality(quality: RenderQuality) {
    this.quality = quality;
    if (!this.ready) return;
    this.ctx.quality = quality;
    this.governor.setQuality(quality);
    this.styleManager.setQuality(quality);
    this.burstEmitters.setQuality(quality);
    if (this.currentScene instanceof SimulationScene) {
      this.currentScene.setQuality(quality);
    }
    this.renderInvalidated = true;
  }

  setStyle(styleId: string) {
    if (!this.ready) return;
    this.styleManager.setStyle(styleId);
    // Forward to all scene types — SimulationScene and game scenes alike
    this.currentScene?.setStyle(styleId);
    this.renderInvalidated = true;
    this.onEvent({ kind: 'style_change', payload: { styleId } });
  }

  setDebugEnabled(enabled: boolean) {
    if (!this.ready) return;
    this.debug.setEnabled(enabled);
    this.renderInvalidated = true;
  }

  /** Notify the active simulation scene that the host UI visibility has changed. */
  setUIHidden(hidden: boolean) {
    if (!this.ready) return;
    if (this.currentScene instanceof SimulationScene) {
      this.currentScene.onUIHidden(hidden);
    }
  }

  private buildSimAIContext(dt: number): SimAIContext {
    const simDef = this.definition.kind === 'simulation'
      ? (this.definition as SimulationExperience)
      : null;
    const styleIds = (simDef?.styleManifest?.styles ?? [])
      .filter((s) => s.id !== '__random__')
      .map((s) => s.id);
    return {
      width: this.ctx.width,
      height: this.ctx.height,
      dt,
      elapsedTime: this.elapsedTime,
      styleIds,
      applyStyle: (id) => this.setStyle(id),
      applyNumericSetting: (key, val) => {
        this._settings.set(key, val);
        this.onEvent({ kind: 'setting_change', payload: { key, value: val } });
      },
      resetScene: () => this.resetScene(),
      clearEmittersOnly: () => this.currentScene?.clearEmitters(),
    };
  }

  /** Trigger a scene reset (drain/clear/restart cycle). Scene must override reset(). */
  resetScene() {
    if (!this.ready) return;
    this.currentScene?.reset();
    this.renderInvalidated = true;
  }

  /**
   * In demo mode: immediately triggers a new overhaul cycle (reshuffles config and
   * replaces emitters). No-op when demo AI is not active.
   */
  demoShuffle() {
    this.simulationAi?.reset();
  }

  /** Change the active interaction mode. Forwarded to the current scene via setMode(). */
  private _interactionMode = '';
  get interactionMode(): string { return this._interactionMode; }
  setInteractionMode(id: string) {
    this._interactionMode = id;
    this.currentScene?.setMode(id);
  }

  /** Live debug stats for the React debug panel. */
  getDebugStats(): {
    fps: number;
    renderFps: number;
    frameMs: number;
    quality: string;
    interactionMode: string;
    aiEnabled: boolean;
    bodyCount: number;
    awakeBodies: number;
    canvasW: number;
    canvasH: number;
    bufferW: number;
    bufferH: number;
    resolution: number;
    resizeCount: number;
    heapMB: number | null;
  } {
    const fps = Math.round(this.ticker.fps);
    const renderFps = Math.round(this.ticker.renderFps);
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return {
      fps,
      renderFps,
      frameMs: fps > 0 ? Math.round(1000 / fps) : 0,
      quality: this.quality,
      interactionMode: this._interactionMode,
      aiEnabled: this.aiController !== null,
      bodyCount: this.physicsWorld.world.getBodyCount(),
      awakeBodies: this.physicsWorld.countAwakeDynamicBodies(),
      canvasW: this.ctx?.width ?? 0,
      canvasH: this.ctx?.height ?? 0,
      bufferW: this.pixi?.bufferWidth ?? 0,
      bufferH: this.pixi?.bufferHeight ?? 0,
      resolution: this.pixi?.resolution ?? 0,
      resizeCount: this.resizeCount,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : null,
    };
  }

  emitBurst(effect: BurstEffect) {
    if (!this.ready) return;
    this.burstEmitters.emit(effect);
    this.renderInvalidated = true;
    this.onEvent({ kind: 'burst_effect', payload: { kind: effect.kind, id: effect.id } });
  }

  setMaxPixels(maxPixels: number | undefined) {
    this.pixi.setMaxPixels(maxPixels);
    this.renderInvalidated = true;
  }

  setSleepMode(enabled: boolean) {
    if (!this.ready) return;
    this.burstEmitters.setSleepMode(enabled);
    this.renderInvalidated = true;
  }

  setLowMotion(enabled: boolean) {
    if (!this.ready) return;
    this.burstEmitters.setSleepMode(enabled || (this.opts.sleepMode ?? false));
    this.renderInvalidated = true;
  }

  setGlobalIntensity(value: number) {
    if (!this.ready) return;
    this.burstEmitters.setGlobalIntensity(value);
    this.renderInvalidated = true;
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
      return;
    }
    if (!this.ready) return;
    if (!this.aiController && this.definition.kind === 'game' && this.definition.aiFactory) {
      this.aiController = this.definition.aiFactory(this.ctx);
      this.renderInvalidated = true;
    }
  }

  /** Update screensaver idle threshold. */
  setScreensaverThreshold(ms: number) {
    this.screensaverManager.setThresholdMs(ms);
  }

  exitScreensaver() {
    if (!this.ready) return;
    this.screensaverManager.forceExit();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ready = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.ticker.stop();
    this.currentScene?.onExit();
    this.currentScene = null;
    this.input.unmount();
    this.telemetry.unmount();
    this.physicsWorld?.destroy();
    this.spriteFactory?.destroyAll();
    this.particleSystem?.destroy();
    this.burstEmitters?.destroy();
    this.ambientData?.clear();
    this.debug?.destroy();
    this.renderTargets?.destroy();
    this.procedural?.destroy();
    this.pixi?.destroy();
    this.audio.dispose();
  }

  // ── Ticker callbacks ──────────────────────────────────────────────────────

  private onFixedUpdate = (dt: number) => {
    if (this._mode === 'paused') return;
    if (this.physicsWorld.hasAwakeDynamicBodies()) {
      this.physicsWorld.step(dt);
    }
    this.currentScene?.fixedUpdate(dt);
  };

  private onUpdate = (dt: number, _physicsSteps: number) => {
    if (this._mode === 'paused') return;

    // Flush input — captures justDown/justUp this frame
    this.input.flush();
    const snap = this.input.snapshot;
    this.hasHumanInputThisFrame =
      snap.justDown.size > 0 || snap.justUp.size > 0 || snap.pointers.size > 0;
    const gestureEvents = this.gestures.update(snap);
    if (gestureEvents.length > 0) {
      this.hasHumanInputThisFrame = true;
      if (this.currentScene instanceof SimulationScene) {
        this.currentScene.pushGestures(gestureEvents);
      }
    }

    // Simulation demo AI — inject synthetic gestures when in demo mode
    if (
      this._mode === 'demo' &&
      this.simulationAi &&
      this.currentScene instanceof SimulationScene
    ) {
      const aiCtx = this.buildSimAIContext(dt);
      const aiGestures = this.simulationAi.think(aiCtx);
      if (aiGestures.length > 0) {
        this.currentScene.pushGestures(aiGestures);
      }
    }

    this.elapsedTime += dt;

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

    const hasSceneWork = this.shouldRunSceneUpdate(snap);
    if (hasSceneWork) {
      this.currentScene?.update(dt);
    }
    if (this.particleSystem.count > 0) {
      this.particleSystem.update(dt);
    }
    if (this.burstEmitters.count > 0) {
      this.burstEmitters.update(dt);
    }

    const newQuality = hasSceneWork ? this.governor.update(dt) : null;
    if (newQuality) {
      this.onEvent({ kind: 'quality_change', payload: { quality: newQuality } });
    }

    if (this.currentScene instanceof SimulationScene) {
      const report = this.stagnation.update(dt, this.currentScene);
      if (report) {
        this.onEvent({ kind: 'stagnation_recovery', payload: { reason: report.reason } });
      }
    }

    if (this.debug.isEnabled()) {
      this.debug.update({
        fps: this.ticker.fps,
        quality: this.quality,
        renderTargets: JSON.stringify(this.renderTargets.stats()),
      });
    }

    // Update telemetry
    if (this.telemetry.isEnabled) {
      this.telemetry.update({
        fps: this.ticker.fps,
        sceneName: this.currentScene?.name,
        mode: this._mode,
      });
    }
  };

  private onRender = (alpha: number): boolean => {
    if (this._mode === 'paused') return false;
    const scene = this.currentScene;
    const shouldRenderScene = scene?.shouldRender() ?? false;
    const shouldRenderSystems =
      this.renderInvalidated
      || this.input.snapshot.pointers.size > 0
      || this.particleSystem.count > 0
      || this.burstEmitters.count > 0
      || this.physicsWorld.hasAwakeDynamicBodies()
      || this.debug.isEnabled();
    if (!shouldRenderScene && !shouldRenderSystems) return false;
    scene?.render(alpha);
    this.renderInvalidated = false;
    this.pixi.render();
    return true;
  };

  private handleResize = (width: number, height: number) => {
    if (!this.ready || !this.pixi) return;
    if (width <= 0 || height <= 0) return; // skip degenerate sizes from layout glitches
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (nextWidth === this.ctx.width && nextHeight === this.ctx.height) return;
    this.resizeCount++;
    this.pixi.resize(nextWidth, nextHeight);
    this.input.setScale(
      nextWidth / Math.max(1, this.pixi.canvas.getBoundingClientRect().width),
      nextHeight / Math.max(1, this.pixi.canvas.getBoundingClientRect().height),
    );
    this.renderTargets.resizePersistent(nextWidth, nextHeight);
    this.ctx.width = nextWidth;
    this.ctx.height = nextHeight;
    this.currentScene?.resize(nextWidth, nextHeight);
    this.renderInvalidated = true;
  };

  private handleScreensaverEnter = () => {
    this._mode = 'screensaver';
    this.ctx.mode = 'screensaver';
    if (this.definition.kind === 'game' && this.definition.capabilities.screensaver && this.definition.screensaverFactory) {
      const scene = this.definition.screensaverFactory(this.ctx);
      this.switchScene(scene);
    } else if (this.definition.kind === 'game' && this.definition.capabilities.aiAutoplay) {
      this.screensaverUsingAi = true;
      this.setAIEnabled(true);
    }
    this.onEvent({ kind: 'screensaver_enter' });
  };

  private handleScreensaverExit = () => {
    this._mode = 'play';
    this.ctx.mode = 'play';
    if (this.screensaverUsingAi) {
      this.setAIEnabled(false);
      this.screensaverUsingAi = false;
    }
    // Restore main scene
    const scene = this.definition.factory(this.ctx);
    this.switchScene(scene);
    this.onEvent({ kind: 'screensaver_exit' });
  };

  private shouldRunSceneUpdate(snap: Readonly<InputSnapshot>): boolean {
    if (this.currentScene instanceof SimulationScene) return true;
    if (this._mode === 'demo' || this._mode === 'screensaver') return true;
    if (this.aiController) return true;
    if (this.renderInvalidated) return true;
    if (snap.justDown.size > 0 || snap.justUp.size > 0 || snap.pointers.size > 0) return true;
    if (this.particleSystem.count > 0 || this.burstEmitters.count > 0) return true;
    if (this.physicsWorld.hasAwakeDynamicBodies()) return true;
    return this.currentScene?.shouldRender() ?? false;
  }
}
