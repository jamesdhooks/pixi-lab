import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface MusicDreamFieldModelOptions {
  seed: number;
  width: number;
  height: number;
  orbCount: number;
  ribbonCount: number;
  maxBrightness: number;
}

interface DreamOrb {
  anchorX: number;
  anchorY: number;
  phase: number;
  radius: number;
  speed: number;
  size: number;
  hue: number;
  band: number;
}

interface DreamRibbon {
  x: number;
  phase: number;
  speed: number;
  width: number;
  hue: number;
}

export interface MusicDreamFieldStats {
  orbCount: number;
  ribbonCount: number;
  visibleParticles: number;
  beatEnergy: number;
  spectralFlux: number;
  tempoPhase: number;
  bpm: number;
  brightness: number;
  motionScale: number;
  width: number;
  height: number;
}

export interface MusicDreamFieldSnapshot {
  stats: MusicDreamFieldStats;
  particles: Array<{ x: number; y: number; size: number; alpha: number; color: number }>;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function numberValue(snapshot: AmbientDataSnapshot | undefined, key: string): number | null {
  const value = snapshot?.values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function boolValue(snapshot: AmbientDataSnapshot | undefined, key: string): boolean | null {
  const value = snapshot?.values[key];
  return typeof value === 'boolean' ? value : null;
}

function normalizePercent(value: number): number {
  return value > 1 ? clamp(value / 100) : clamp(value);
}

function tempoFromSnapshot(snapshot: AmbientDataSnapshot | undefined): number | null {
  const bpm = numberValue(snapshot, 'bpm') ?? numberValue(snapshot, 'tempo');
  if (bpm === null) return null;
  return Math.max(48, Math.min(180, bpm));
}

export class MusicDreamFieldModel {
  private width: number;
  private height: number;
  private readonly orbs: DreamOrb[];
  private readonly ribbons: DreamRibbon[];
  private maxBrightness: number;
  private elapsed = 0;
  private beatEnergy = 0.42;
  private spectralFlux = 0.36;
  private bpm = 96;
  private globalIntensity = 0.72;
  private beatSensitivity = 0.68;
  private driftStrength = 0.48;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: MusicDreamFieldModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.08, 0.72);
    const rng = new SeededRng(options.seed);
    const orbCount = Math.max(12, Math.floor(options.orbCount));
    const ribbonCount = Math.max(4, Math.floor(options.ribbonCount));
    this.orbs = Array.from({ length: orbCount }, () => ({
      anchorX: rng.next(),
      anchorY: rng.range(0.12, 0.9),
      phase: rng.next(),
      radius: rng.range(0.02, 0.18),
      speed: rng.range(0.025, 0.12),
      size: rng.range(2.4, 10.8),
      hue: rng.next(),
      band: rng.range(0.2, 1),
    }));
    this.ribbons = Array.from({ length: ribbonCount }, () => ({
      x: rng.next(),
      phase: rng.next(),
      speed: rng.range(0.018, 0.08),
      width: rng.range(1.4, 5.8),
      hue: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const media = snapshots.find((snapshot) => snapshot.source === 'media');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const time = snapshots.find((snapshot) => snapshot.source === 'time');
    const phase = numberValue(synthetic, 'phase') ?? numberValue(time, 'phase');
    const mediaBeat = numberValue(media, 'beat') ?? numberValue(media, 'beatEnergy') ?? numberValue(media, 'energy') ?? numberValue(media, 'volume');
    const syntheticBeat = numberValue(synthetic, 'beat') ?? numberValue(synthetic, 'intensity');
    const flux = numberValue(media, 'spectralFlux') ?? numberValue(media, 'brightness') ?? numberValue(synthetic, 'flux');
    const tempo = tempoFromSnapshot(media) ?? tempoFromSnapshot(synthetic);
    const sleep = boolValue(media, 'sleepMode') ?? boolValue(synthetic, 'sleepMode') ?? boolValue(time, 'sleepMode');

    if (mediaBeat !== null) {
      this.beatEnergy = normalizePercent(mediaBeat);
    } else if (syntheticBeat !== null) {
      this.beatEnergy = normalizePercent(syntheticBeat);
    } else if (phase !== null) {
      this.beatEnergy = clamp(0.36 + Math.sin(phase * Math.PI * 8) * 0.18);
    }

    if (flux !== null) {
      this.spectralFlux = normalizePercent(flux);
    } else {
      this.spectralFlux = clamp(0.26 + this.beatEnergy * 0.46);
    }

    if (tempo !== null) {
      this.bpm = tempo;
    }

    if (sleep !== null) {
      this.sleepMode = sleep;
    }
  }

  update(dt: number): void {
    const safeDt = Math.max(0, Math.min(0.1, dt));
    this.elapsed += safeDt * this.stats().motionScale;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  setGlobalIntensity(value: number): void {
    this.globalIntensity = clamp(value, 0.05, 1.2);
  }

  setMaxBrightness(value: number): void {
    this.maxBrightness = clamp(value, 0.08, 0.72);
  }

  setBeatSensitivity(value: number): void {
    this.beatSensitivity = clamp(value, 0, 1);
  }

  setDriftStrength(value: number): void {
    this.driftStrength = clamp(value, 0, 1);
  }

  setSleepMode(enabled: boolean): void {
    this.sleepMode = enabled;
  }

  setLowMotion(enabled: boolean): void {
    this.lowMotion = enabled;
  }

  renderParticles(): SimParticle[] {
    const stats = this.stats();
    const tempoPulse = 0.5 + Math.sin(stats.tempoPhase * Math.PI * 2) * 0.5;
    const orbCount = this.visibleOrbCount();
    const ribbonCount = this.visibleRibbonCount();
    const palette = [0xa78bfa, 0x22d3ee, 0xf0abfc, 0x60a5fa, 0xfde68a, 0x34d399];

    const orbParticles = this.orbs.slice(0, orbCount).map((orb, index) => {
      const phase = orb.phase + this.elapsed * orb.speed * (0.5 + stats.beatEnergy);
      const pulse = 0.7 + tempoPulse * stats.beatEnergy * this.beatSensitivity * 0.7;
      const drift = Math.sin((phase + orb.band) * Math.PI * 2) * orb.radius * this.driftStrength;
      const x = wrap01(orb.anchorX + drift + Math.cos(phase * Math.PI * 2) * orb.radius * 0.45) * this.width;
      const y = clamp(orb.anchorY + Math.sin((phase * 0.67 + orb.hue) * Math.PI * 2) * orb.radius * 0.8, 0.04, 0.96) * this.height;
      const color = palette[(Math.floor(orb.hue * palette.length) + index) % palette.length];
      return {
        position: { x, y },
        velocity: { x: drift * this.width, y: Math.sin(phase * Math.PI * 2) * this.height * 0.01 },
        size: orb.size * pulse * (0.7 + orb.band * 0.5),
        color,
        alpha: clamp((0.1 + orb.band * 0.28 + stats.spectralFlux * 0.2) * stats.brightness, 0, this.maxBrightness),
      } satisfies SimParticle;
    });

    const ribbonParticles = this.ribbons.slice(0, ribbonCount).map((ribbon, index) => {
      const phase = wrap01(ribbon.phase + this.elapsed * ribbon.speed * (0.25 + this.driftStrength));
      const x = wrap01(ribbon.x + Math.sin((phase + stats.tempoPhase) * Math.PI * 2) * 0.06 * this.driftStrength) * this.width;
      const y = phase * this.height;
      const color = palette[(Math.floor(ribbon.hue * palette.length) + index + 2) % palette.length];
      return {
        position: { x, y },
        velocity: { x: 0, y: ribbon.speed * this.height },
        size: ribbon.width * (1 + stats.spectralFlux * 0.8),
        color,
        alpha: clamp((0.08 + stats.beatEnergy * 0.18) * stats.brightness, 0, this.maxBrightness * 0.78),
      } satisfies SimParticle;
    });

    return [...orbParticles, ...ribbonParticles];
  }

  stats(): MusicDreamFieldStats {
    const beat = clamp(this.beatEnergy * (0.35 + this.beatSensitivity * 0.85));
    const sleepScale = this.sleepMode ? 0.34 : 1;
    const lowMotionScale = this.lowMotion ? 0.28 : 1;
    const brightness = clamp((0.26 + beat * 0.36 + this.spectralFlux * 0.16) * this.globalIntensity * (this.sleepMode ? 0.58 : 1), 0, this.maxBrightness);
    const motionScale = sleepScale * lowMotionScale * (0.18 + this.driftStrength * 0.56 + beat * 0.38);
    const tempoPhase = wrap01((this.elapsed * this.bpm) / 60);
    const orbCount = this.visibleOrbCount();
    const ribbonCount = this.visibleRibbonCount();
    return {
      orbCount,
      ribbonCount,
      visibleParticles: orbCount + ribbonCount,
      beatEnergy: beat,
      spectralFlux: this.spectralFlux,
      tempoPhase,
      bpm: this.bpm,
      brightness,
      motionScale,
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): MusicDreamFieldSnapshot {
    const stats = this.stats();
    return {
      stats: {
        ...stats,
        beatEnergy: Number(stats.beatEnergy.toFixed(4)),
        spectralFlux: Number(stats.spectralFlux.toFixed(4)),
        tempoPhase: Number(stats.tempoPhase.toFixed(4)),
        brightness: Number(stats.brightness.toFixed(5)),
        motionScale: Number(stats.motionScale.toFixed(5)),
      },
      particles: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(4)),
        color: particle.color,
      })),
    };
  }

  private visibleOrbCount(): number {
    const sleep = this.sleepMode ? 0.48 : 1;
    const motion = this.lowMotion ? 0.58 : 1;
    const beat = 0.54 + this.beatEnergy * 0.46;
    return Math.max(6, Math.min(this.orbs.length, Math.round(this.orbs.length * sleep * motion * beat)));
  }

  private visibleRibbonCount(): number {
    const sleep = this.sleepMode ? 0.35 : 1;
    const motion = this.lowMotion ? 0.5 : 1;
    const flux = 0.42 + this.spectralFlux * 0.58;
    return Math.max(2, Math.min(this.ribbons.length, Math.round(this.ribbons.length * sleep * motion * flux)));
  }
}
