import {
  ParticlePointRenderer,
  Scene,
  type AmbientDataSnapshot,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimStyle,
} from '@hooksjam/pixi-lab-core';
import { FAMILY_ORBIT_DEFAULTS } from './family-orbit.config.js';
import { FamilyOrbitModel } from './FamilyOrbitModel.js';

export const familyOrbitStyles: SimStyle[] = [
  {
    id: 'living-room-constellation',
    name: 'Living Room Constellation',
    description: 'Soft family-member orbits with warm connection glints for dashboard backgrounds.',
    palette: [0x93c5fd, 0xf9a8d4, 0xfde68a, 0x86efac],
    background: 0x030712,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.36, warmth: 0.48, vignette: 0.32 },
  },
  {
    id: 'bedtime-orbit',
    name: 'Bedtime Orbit',
    description: 'Dim blue and violet presence halos tuned for overnight passive display.',
    palette: [0x60a5fa, 0xa78bfa, 0x67e8f9, 0xc4b5fd],
    background: 0x020617,
    passes: ['primitive', 'bloom'],
    uniforms: { glow: 0.24, dim: 0.42, saturation: 0.46 },
  },
  {
    id: 'busy-household',
    name: 'Busy Household',
    description: 'Brighter comets and calendar pulses for active family coordination moments.',
    palette: [0xfef3c7, 0xfca5a5, 0x93c5fd, 0xa7f3d0],
    background: 0x111827,
    passes: ['primitive', 'bloom', 'colorGrade'],
    uniforms: { glow: 0.5, activity: 0.7, contrast: 0.52 },
  },
];

export class FamilyOrbitScene extends Scene {
  readonly name = 'FamilyOrbit';
  private renderer: ParticlePointRenderer | null = null;
  private model: FamilyOrbitModel | null = null;
  private quality: RenderQuality = 'basic';
  private style: SimStyle = familyOrbitStyles[0];
  private elapsedSinceDataPoll = 0;
  private activeMemberBudget = 0;
  private activeCometBudget = 0;

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
      alpha: this.preview ? 0.62 : 0.84,
      sizeScale: this.quality === 'basic' ? 0.88 : 1.12,
      zIndex: 0,
    });
    const stats = this.model.stats();
    this.ctx.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.visibleParticles,
      fieldVariance: stats.activity + stats.calendarLoad,
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
    this.style = familyOrbitStyles.find((style) => style.id === id) ?? this.style;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.renderer?.setQuality(quality);
  }

  private createModel(seed: number): void {
    const settings = this.ctx.systems.settings;
    const requestedMembers = this.preview ? 5 : Number(settings.get('memberCount') ?? FAMILY_ORBIT_DEFAULTS.memberCount);
    const requestedComets = this.preview ? 18 : Number(settings.get('cometCount') ?? FAMILY_ORBIT_DEFAULTS.cometCount);
    const memberCount = Number.isFinite(requestedMembers) ? Math.max(2, Math.min(12, Math.floor(requestedMembers))) : FAMILY_ORBIT_DEFAULTS.memberCount;
    const cometCount = Number.isFinite(requestedComets) ? Math.max(0, Math.min(160, Math.floor(requestedComets))) : FAMILY_ORBIT_DEFAULTS.cometCount;
    const maxBrightness = Number(settings.get('maxBrightness') ?? FAMILY_ORBIT_DEFAULTS.maxBrightness);
    this.activeMemberBudget = memberCount;
    this.activeCometBudget = cometCount;
    this.model = new FamilyOrbitModel({
      seed,
      width: this.ctx.width,
      height: this.ctx.height,
      memberCount,
      cometCount,
      maxBrightness: Number.isFinite(maxBrightness) ? maxBrightness : FAMILY_ORBIT_DEFAULTS.maxBrightness,
    });
  }

  private syncSettings(): void {
    if (!this.model) return;
    const requestedMembers = Number(this.ctx.systems.settings.get('memberCount') ?? this.activeMemberBudget);
    const requestedComets = Number(this.ctx.systems.settings.get('cometCount') ?? this.activeCometBudget);
    const nextMembers = Number.isFinite(requestedMembers) ? Math.max(2, Math.min(12, Math.floor(requestedMembers))) : this.activeMemberBudget;
    const nextComets = Number.isFinite(requestedComets) ? Math.max(0, Math.min(160, Math.floor(requestedComets))) : this.activeCometBudget;
    if (!this.preview && (nextMembers !== this.activeMemberBudget || nextComets !== this.activeCometBudget)) {
      this.createModel(this.ctx.seed);
      this.pollAmbientData();
    }
    const sleep = Boolean(this.ctx.systems.settings.get('sleepMode') ?? FAMILY_ORBIT_DEFAULTS.sleepMode);
    const lowMotion = Boolean(this.ctx.systems.settings.get('lowMotion') ?? FAMILY_ORBIT_DEFAULTS.lowMotion);
    const intensity = Number(this.ctx.systems.settings.get('intensity') ?? FAMILY_ORBIT_DEFAULTS.intensity);
    const brightness = Number(this.ctx.systems.settings.get('maxBrightness') ?? FAMILY_ORBIT_DEFAULTS.maxBrightness);
    const closeness = Number(this.ctx.systems.settings.get('closeness') ?? FAMILY_ORBIT_DEFAULTS.closeness);
    const pulse = Number(this.ctx.systems.settings.get('activityPulse') ?? FAMILY_ORBIT_DEFAULTS.activityPulse);
    const speed = Number(this.ctx.systems.settings.get('orbitSpeed') ?? FAMILY_ORBIT_DEFAULTS.orbitSpeed);
    this.model.setSleepMode(sleep);
    this.model.setLowMotion(lowMotion);
    this.model.setGlobalIntensity(Number.isFinite(intensity) ? intensity : FAMILY_ORBIT_DEFAULTS.intensity);
    this.model.setMaxBrightness(Number.isFinite(brightness) ? brightness : FAMILY_ORBIT_DEFAULTS.maxBrightness);
    this.model.setCloseness(Number.isFinite(closeness) ? closeness : FAMILY_ORBIT_DEFAULTS.closeness);
    this.model.setActivityPulse(Number.isFinite(pulse) ? pulse : FAMILY_ORBIT_DEFAULTS.activityPulse);
    this.model.setOrbitSpeed(Number.isFinite(speed) ? speed : FAMILY_ORBIT_DEFAULTS.orbitSpeed);
  }

  private pollAmbientData(): void {
    if (!this.model) return;
    const manager = this.ctx.systems.ambientData;
    const snapshots: AmbientDataSnapshot[] = manager
      ? manager.getAll(['presence', 'calendar', 'time', 'synthetic'])
      : [{ source: 'synthetic', timestamp: Date.now(), values: { synthetic: true, phase: 0.28, intensity: 0.48, activity: 0.44, closeness: 0.62 } }];
    this.model.applyAmbientData(snapshots);
  }
}
