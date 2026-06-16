import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
} from '@hooksjam/pixi-lab-core';
import { HOUSE_PULSE_MAP_DEFAULTS } from './house-pulse-map.config.js';
import { HousePulseMapModel } from './HousePulseMapModel.js';

export const housePulseMapStyles: SimStyle[] = [
  {
    id: 'neon-floorplan',
    name: 'Neon Floorplan',
    description: 'Cool cyan and green pulses across a synthetic smart-home floorplan.',
    palette: [0x22d3ee, 0x34d399, 0xa7f3d0, 0x93c5fd],
    background: 0x020617,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.38, grid: 0.42, contrast: 0.54 },
  },
  {
    id: 'warm-housebeat',
    name: 'Warm Housebeat',
    description: 'Amber home activity pulses for dashboard and kitchen-wall displays.',
    palette: [0xfbbf24, 0xf97316, 0x34d399, 0xfef3c7],
    background: 0x120a02,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.34, warmth: 0.58, vignette: 0.24 },
  },
  {
    id: 'sleep-standby',
    name: 'Sleep Standby',
    description: 'Dim low-motion home status glimmers for overnight passive mode.',
    palette: [0x1e3a8a, 0x64748b, 0x22d3ee, 0x0f172a],
    background: 0x020617,
    passes: ['primitive', 'colorGrade'],
    uniforms: { glow: 0.12, dim: 0.76, motion: 0.24 },
  },
];

export class HousePulseMapScene extends Scene {
  readonly name = 'HousePulseMap';
  private renderer: ParticlePointRenderer | null = null;
  private model: HousePulseMapModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = housePulseMapStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeNodeBudget = 0;
  private activeConnectionBudget = 0;

  constructor(private readonly preview = false) {
    super();
  }

  override shouldRender() { return true; }

  override onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;
    this.quality = ctx.quality;
    this.renderer = new ParticlePointRenderer(ctx.systems.pixi.app);
    this.renderer.setQuality(ctx.quality);
    this.createModel(ctx.seed);
    this.pollAmbientData();
    this.syncSettings();
  }

  override onExit(): void {
    this.renderer?.destroy();
    this.renderer = null;
    this.model = null;
  }

  override update(dt: number): void {
    if (!this.model) return;
    this.elapsedSinceDataPoll += dt;
    if (this.elapsedSinceDataPoll >= 1 || this.elapsedSinceDataPoll === dt) {
      this.elapsedSinceDataPoll = 0;
      this.pollAmbientData();
      this.syncSettings();
    }
    this.model.update(dt);
  }

  override render(): void {
    if (!this.renderer || !this.model) return;
    const style = this.ctx.systems.styleManager?.getStyle() ?? this.style;
    this.renderer.renderParticles(this.model.renderParticles(), style, {
      alpha: this.preview ? 0.66 : 0.84,
      sizeScale: this.quality === 'basic' ? 0.82 : 1.08,
      zIndex: 0,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.visibleParticles,
      fieldVariance: stats.eventRate,
    });
  }

  override resize(width: number, height: number): void {
    this.model?.resize(width, height);
  }

  override reset(): void {
    if (!this.ctx) return;
    this.createModel(this.ctx.seed + 1);
    this.pollAmbientData();
    this.syncSettings();
  }

  override setStyle(id: string): void {
    this.style = housePulseMapStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedNodes = this.preview ? 36 : Number(settings.get('nodeCount') ?? HOUSE_PULSE_MAP_DEFAULTS.nodeCount);
    const requestedConnections = this.preview ? 48 : Number(settings.get('connectionCount') ?? HOUSE_PULSE_MAP_DEFAULTS.connectionCount);
    const nodeCount = Number.isFinite(requestedNodes) ? Math.max(24, Math.min(420, Math.floor(requestedNodes))) : HOUSE_PULSE_MAP_DEFAULTS.nodeCount;
    const connectionCount = Number.isFinite(requestedConnections) ? Math.max(24, Math.min(720, Math.floor(requestedConnections))) : HOUSE_PULSE_MAP_DEFAULTS.connectionCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? HOUSE_PULSE_MAP_DEFAULTS.maxBrightness);
    this.activeNodeBudget = nodeCount;
    this.activeConnectionBudget = connectionCount;
    this.model = new HousePulseMapModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      nodeCount,
      connectionCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : HOUSE_PULSE_MAP_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedNodes = Number(this.ctx.systems.settings.get('nodeCount') ?? this.activeNodeBudget);
    const requestedConnections = Number(this.ctx.systems.settings.get('connectionCount') ?? this.activeConnectionBudget);
    const nextNodes = Number.isFinite(requestedNodes) ? Math.max(24, Math.min(420, Math.floor(requestedNodes))) : this.activeNodeBudget;
    const nextConnections = Number.isFinite(requestedConnections) ? Math.max(24, Math.min(720, Math.floor(requestedConnections))) : this.activeConnectionBudget;
    if (!this.preview && (nextNodes !== this.activeNodeBudget || nextConnections !== this.activeConnectionBudget)) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? HOUSE_PULSE_MAP_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? HOUSE_PULSE_MAP_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? HOUSE_PULSE_MAP_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? HOUSE_PULSE_MAP_DEFAULTS.maxBrightness);
    const eventSensitivity = Number(this.ctx.systems.settings.get('eventSensitivity') ?? HOUSE_PULSE_MAP_DEFAULTS.eventSensitivity);
    const pulseSpeed = Number(this.ctx.systems.settings.get('pulseSpeed') ?? HOUSE_PULSE_MAP_DEFAULTS.pulseSpeed);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : HOUSE_PULSE_MAP_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : HOUSE_PULSE_MAP_DEFAULTS.maxBrightness);
    this.model.setEventSensitivity(Number.isFinite(eventSensitivity) ? eventSensitivity : HOUSE_PULSE_MAP_DEFAULTS.eventSensitivity);
    this.model.setPulseSpeed(Number.isFinite(pulseSpeed) ? pulseSpeed : HOUSE_PULSE_MAP_DEFAULTS.pulseSpeed);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['homeAssistant', 'presence', 'time', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.4, intensity: 0.42, activity: 0.36 } }];
    this.model.applyAmbientData(snapshots);
  }
}
