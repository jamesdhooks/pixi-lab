import { Container, Particle, ParticleContainer, Texture, type Application } from 'pixi.js';
import type { BurstEffect, BurstEffectKind, BurstEffectMode, RenderQuality } from '../types.js';
import { SeededRng } from '../utils/SeededRng.js';

interface BurstParticleState {
  view: Particle;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotationSpeed: number;
  age: number;
  life: number;
  startScaleX: number;
  startScaleY: number;
  gravity: number;
  drag: number;
  color: number;
  mode: BurstEffectMode;
}

const DEFAULT_PALETTES: Record<BurstEffectKind, readonly number[]> = {
  spark: [0xffffff, 0xffd166, 0xff8a00],
  firework: [0xffffff, 0xff4fd8, 0x00e5ff, 0xffd166],
  ember: [0xfff1a8, 0xff9f1c, 0xd9480f],
  confetti: [0xff4fd8, 0x00e5ff, 0xffd166, 0x22c55e, 0xffffff],
  plasma: [0x93c5fd, 0xc084fc, 0xffffff],
  ash: [0x94a3b8, 0x64748b, 0x334155],
  smoke: [0xcbd5e1, 0x94a3b8, 0x64748b],
  firefly: [0xecfccb, 0xd9f99d, 0xfef3c7],
  arcSpark: [0xffffff, 0x7dd3fc, 0x38bdf8],
};

const QUALITY_CAPS: Record<RenderQuality, number> = {
  basic: 900,
  enhanced: 1800,
};

export class BurstEmitterSystem {
  readonly container = new Container();
  readonly backgroundLayer = new ParticleContainer<Particle>({ dynamicProperties: { position: true, color: true, rotation: true } });
  readonly simulationLayer = new ParticleContainer<Particle>({ dynamicProperties: { position: true, color: true, rotation: true } });
  readonly foregroundLayer = new ParticleContainer<Particle>({ dynamicProperties: { position: true, color: true, rotation: true } });

  private readonly states: BurstParticleState[] = [];
  private quality: RenderQuality = 'basic';
  private sleepMode = false;
  private paused = false;
  private globalIntensity = 1;
  private maxParticleCount = QUALITY_CAPS.basic;
  private seedCounter = 1;

  constructor(app: Application) {
    this.backgroundLayer.texture = Texture.WHITE;
    this.simulationLayer.texture = Texture.WHITE;
    this.foregroundLayer.texture = Texture.WHITE;
    this.container.addChild(this.backgroundLayer, this.simulationLayer, this.foregroundLayer);
    app.stage.addChild(this.container);
  }

  emit(effect: BurstEffect): void {
    if (this.paused) return;
    if (this.sleepMode && (effect.kind === 'firework' || effect.kind === 'confetti')) return;

    const mode = effect.mode ?? 'simulationLayer';
    const rng = new SeededRng(effect.seed ?? this.seedCounter++);
    const palette = effect.palette ?? DEFAULT_PALETTES[effect.kind];
    const qualityScale = this.quality === 'basic' ? 0.55 : this.quality === 'enhanced' ? 0.85 : 1;
    const sleepScale = this.sleepMode ? 0.35 : 1;
    const requestedCount = Math.floor(effect.count * qualityScale * sleepScale * this.globalIntensity);
    const available = Math.max(0, this.maxParticleCount - this.states.length);
    const count = Math.min(Math.max(0, requestedCount), available);

    for (let i = 0; i < count; i++) {
      const particle = new Particle({ texture: Texture.WHITE, anchorX: 0.5, anchorY: 0.5 });
      const angle = this.angleFor(effect.kind, rng, i, count);
      const speed = this.speedFor(effect.kind, effect.energy, rng) * sleepScale;
      const life = effect.duration ?? this.lifeFor(effect.kind, rng);
      const scale = this.scaleFor(effect.kind, effect.energy, rng) * sleepScale;
      const color = palette[rng.int(0, palette.length - 1)];
      particle.x = effect.x;
      particle.y = effect.y;
      particle.tint = color;
      particle.alpha = this.sleepMode ? 0.45 : 0.9;
      particle.scaleX = effect.kind === 'confetti' ? scale * rng.range(0.45, 1.2) : scale;
      particle.scaleY = effect.kind === 'confetti' ? scale * rng.range(0.12, 0.35) : scale;

      this.layerFor(mode).addParticle(particle);
      this.states.push({
        view: particle,
        x: effect.x,
        y: effect.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + this.verticalBiasFor(effect.kind, rng),
        rotationSpeed: rng.range(-5, 5),
        age: 0,
        life,
        startScaleX: particle.scaleX,
        startScaleY: particle.scaleY,
        gravity: this.gravityFor(effect.kind),
        drag: this.dragFor(effect.kind),
        color,
        mode,
      });
    }
  }

  update(dt: number): void {
    if (this.paused) return;
    for (let i = this.states.length - 1; i >= 0; i--) {
      const state = this.states[i];
      state.age += dt;
      if (state.age >= state.life) {
        this.layerFor(state.mode).removeParticle(state.view);
        this.states.splice(i, 1);
        continue;
      }

      const t = state.age / state.life;
      state.vx *= Math.pow(state.drag, dt * 60);
      state.vy = state.vy * Math.pow(state.drag, dt * 60) + state.gravity * dt;
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      state.view.x = state.x;
      state.view.y = state.y;
      state.view.rotation += state.rotationSpeed * dt;
      state.view.alpha = (1 - t) * (this.sleepMode ? 0.45 : 0.9);
      state.view.scaleX = state.startScaleX * (1 + t * 0.4);
      state.view.scaleY = state.startScaleY * (1 + t * 0.4);
      state.view.tint = state.color;
    }
  }

  clear(): void {
    this.states.length = 0;
    this.backgroundLayer.removeParticles(0, this.backgroundLayer.particleChildren.length);
    this.simulationLayer.removeParticles(0, this.simulationLayer.particleChildren.length);
    this.foregroundLayer.removeParticles(0, this.foregroundLayer.particleChildren.length);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.maxParticleCount = QUALITY_CAPS[quality];
    if (this.states.length > this.maxParticleCount) {
      const removeCount = this.states.length - this.maxParticleCount;
      for (let i = 0; i < removeCount; i++) {
        const state = this.states.shift();
        if (state) this.layerFor(state.mode).removeParticle(state.view);
      }
    }
  }

  setSleepMode(enabled: boolean): void {
    this.sleepMode = enabled;
  }

  setGlobalIntensity(value: number): void {
    this.globalIntensity = Math.max(0, Math.min(1, value));
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  get count(): number {
    return this.states.length;
  }

  destroy(): void {
    this.clear();
    this.container.destroy({ children: true });
  }

  private layerFor(mode: BurstEffectMode): ParticleContainer<Particle> {
    if (mode === 'foreground') return this.foregroundLayer;
    if (mode === 'background') return this.backgroundLayer;
    return this.simulationLayer;
  }

  private angleFor(kind: BurstEffectKind, rng: SeededRng, index: number, count: number): number {
    if (kind === 'firework' || kind === 'spark' || kind === 'plasma' || kind === 'arcSpark') {
      return (index / Math.max(1, count)) * Math.PI * 2 + rng.range(-0.2, 0.2);
    }
    if (kind === 'ember' || kind === 'smoke' || kind === 'ash' || kind === 'firefly') {
      return -Math.PI / 2 + rng.range(-0.55, 0.55);
    }
    return rng.range(-Math.PI, 0);
  }

  private speedFor(kind: BurstEffectKind, energy: number, rng: SeededRng): number {
    const base = Math.max(1, energy);
    switch (kind) {
      case 'firework':
        return base * rng.range(90, 220);
      case 'spark':
      case 'plasma':
      case 'arcSpark':
        return base * rng.range(120, 280);
      case 'confetti':
        return base * rng.range(70, 170);
      case 'ember':
      case 'firefly':
        return base * rng.range(16, 55);
      case 'smoke':
      case 'ash':
        return base * rng.range(10, 35);
    }
  }

  private lifeFor(kind: BurstEffectKind, rng: SeededRng): number {
    switch (kind) {
      case 'spark':
      case 'arcSpark':
      case 'plasma':
        return rng.range(0.25, 0.65);
      case 'firework':
        return rng.range(0.8, 1.8);
      case 'confetti':
        return rng.range(1.2, 2.4);
      case 'ember':
      case 'firefly':
        return rng.range(1.5, 3.4);
      case 'smoke':
      case 'ash':
        return rng.range(1.8, 4.0);
    }
  }

  private scaleFor(kind: BurstEffectKind, energy: number, rng: SeededRng): number {
    const base = Math.max(0.5, energy);
    if (kind === 'confetti') return rng.range(4, 9) * base;
    if (kind === 'smoke') return rng.range(8, 18) * base;
    if (kind === 'firefly') return rng.range(2, 5) * base;
    return rng.range(2, 6) * base;
  }

  private verticalBiasFor(kind: BurstEffectKind, rng: SeededRng): number {
    if (kind === 'ember' || kind === 'smoke' || kind === 'ash' || kind === 'firefly') {
      return rng.range(-60, -15);
    }
    if (kind === 'confetti') return rng.range(-80, -20);
    return 0;
  }

  private gravityFor(kind: BurstEffectKind): number {
    if (kind === 'confetti' || kind === 'firework') return 120;
    if (kind === 'smoke' || kind === 'ash' || kind === 'ember' || kind === 'firefly') return -8;
    return 40;
  }

  private dragFor(kind: BurstEffectKind): number {
    if (kind === 'smoke' || kind === 'ash') return 0.96;
    if (kind === 'firefly' || kind === 'ember') return 0.985;
    return 0.94;
  }
}
