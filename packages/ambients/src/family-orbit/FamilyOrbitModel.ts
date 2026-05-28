import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface FamilyOrbitModelOptions {
  seed: number;
  width: number;
  height: number;
  memberCount: number;
  cometCount: number;
  maxBrightness: number;
}

interface OrbitMember {
  radius: number;
  angle: number;
  size: number;
  color: number;
  phase: number;
  homeBias: number;
}

interface OrbitComet {
  memberIndex: number;
  radiusOffset: number;
  angle: number;
  size: number;
  phase: number;
}

export interface FamilyOrbitStats {
  memberCount: number;
  cometCount: number;
  visibleParticles: number;
  peopleHome: number;
  activity: number;
  closeness: number;
  calendarLoad: number;
  brightness: number;
  motionScale: number;
  width: number;
  height: number;
}

export interface FamilyOrbitSnapshot {
  stats: FamilyOrbitStats;
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

function normalizeCount(value: number, scale: number): number {
  if (value <= 1) return clamp(value);
  return clamp(value / scale);
}

export class FamilyOrbitModel {
  private width: number;
  private height: number;
  private readonly members: OrbitMember[];
  private readonly comets: OrbitComet[];
  private maxBrightness: number;
  private elapsed = 0;
  private peopleHome = 0.58;
  private activity = 0.42;
  private closeness = 0.62;
  private calendarLoad = 0.32;
  private globalIntensity = 0.68;
  private activityPulse = 0.56;
  private orbitSpeed = 0.48;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: FamilyOrbitModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.1, 0.7);
    const rng = new SeededRng(options.seed);
    const memberCount = Math.max(2, Math.floor(options.memberCount));
    const cometCount = Math.max(0, Math.floor(options.cometCount));
    const palette = [0x93c5fd, 0xf9a8d4, 0xfde68a, 0x86efac, 0xc4b5fd, 0x67e8f9, 0xfca5a5, 0xa7f3d0];
    this.members = Array.from({ length: memberCount }, (_, index) => ({
      radius: 0.16 + (index % 4) * 0.09 + rng.range(-0.025, 0.03),
      angle: index / memberCount + rng.range(-0.025, 0.025),
      size: rng.range(7.5, 15.5),
      color: palette[index % palette.length],
      phase: rng.next(),
      homeBias: rng.range(0.35, 1),
    }));
    this.comets = Array.from({ length: cometCount }, (_, index) => ({
      memberIndex: index % memberCount,
      radiusOffset: rng.range(-0.05, 0.055),
      angle: rng.next(),
      size: rng.range(1.4, 4.8),
      phase: rng.next(),
    }));
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const presence = snapshots.find((snapshot) => snapshot.source === 'presence');
    const calendar = snapshots.find((snapshot) => snapshot.source === 'calendar');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const time = snapshots.find((snapshot) => snapshot.source === 'time');
    const phase = numberValue(synthetic, 'phase') ?? numberValue(time, 'phase') ?? 0.25;
    const syntheticActivity = numberValue(synthetic, 'activity') ?? numberValue(synthetic, 'intensity') ?? 0.44;
    const home = numberValue(presence, 'peopleHome') ?? numberValue(presence, 'home') ?? numberValue(presence, 'occupancy');
    const peopleAwayCount = numberValue(presence, 'peopleAway');
    const away = peopleAwayCount ?? numberValue(presence, 'away');
    const activity = numberValue(presence, 'activity') ?? numberValue(calendar, 'activity') ?? numberValue(calendar, 'upcoming');
    const closeness = numberValue(presence, 'closeness') ?? numberValue(presence, 'proximity') ?? numberValue(synthetic, 'closeness');
    const load = numberValue(calendar, 'busy') ?? numberValue(calendar, 'calendarLoad') ?? numberValue(calendar, 'events');
    const sleep = boolValue(presence, 'sleepMode') ?? boolValue(calendar, 'sleepMode') ?? boolValue(synthetic, 'sleepMode') ?? boolValue(time, 'sleepMode');

    const homeNormalized = home !== null ? normalizeCount(home, Math.max(1, this.members.length)) : clamp(0.45 + Math.sin(wrap01(phase) * Math.PI * 2) * 0.22 + syntheticActivity * 0.18);
    const awayPenalty = away !== null ? (peopleAwayCount !== null ? clamp(peopleAwayCount / Math.max(1, this.members.length)) : normalizeCount(away, Math.max(1, this.members.length))) * 0.18 : 0;
    this.peopleHome = clamp(homeNormalized - awayPenalty);
    this.activity = activity !== null ? normalizeCount(activity, 10) : clamp(0.18 + syntheticActivity * 0.52 + Math.max(0, Math.cos(wrap01(phase + 0.17) * Math.PI * 2)) * 0.18);
    this.closeness = closeness !== null ? clamp(closeness) : clamp(0.36 + this.peopleHome * 0.36 + Math.max(0, Math.sin(wrap01(phase + 0.42) * Math.PI * 2)) * 0.16);
    this.calendarLoad = load !== null ? normalizeCount(load, 12) : clamp(0.12 + this.activity * 0.38 + Math.max(0, Math.sin(wrap01(phase + 0.7) * Math.PI * 2)) * 0.2);
    if (sleep !== null) this.sleepMode = sleep;
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
    this.maxBrightness = clamp(value, 0.1, 0.7);
  }

  setCloseness(value: number): void {
    this.closeness = clamp(value, 0, 1);
  }

  setActivityPulse(value: number): void {
    this.activityPulse = clamp(value, 0, 1);
  }

  setOrbitSpeed(value: number): void {
    this.orbitSpeed = clamp(value, 0, 1);
  }

  setSleepMode(enabled: boolean): void {
    this.sleepMode = enabled;
  }

  setLowMotion(enabled: boolean): void {
    this.lowMotion = enabled;
  }

  renderParticles(): SimParticle[] {
    const stats = this.stats();
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    const radiusScale = Math.min(this.width, this.height) * (0.42 - stats.closeness * 0.16);
    const pulse = 0.78 + Math.sin(this.elapsed * 2.4 + stats.activity * Math.PI) * 0.16 * this.activityPulse;
    const memberCount = this.visibleMemberCount();
    const cometCount = this.visibleCometCount();
    const memberParticles = this.members.slice(0, memberCount).map((member, index) => {
      const orbit = (member.angle + this.elapsed * (0.012 + this.orbitSpeed * 0.055) * (index % 2 === 0 ? 1 : -1)) * Math.PI * 2;
      const radius = Math.max(4, radiusScale * member.radius * (1 - stats.peopleHome * member.homeBias * 0.18));
      const alpha = clamp((0.18 + stats.peopleHome * 0.28 + stats.closeness * 0.18 + stats.activity * 0.08) * stats.brightness, 0, this.maxBrightness);
      return {
        position: { x: centerX + Math.cos(orbit) * radius, y: centerY + Math.sin(orbit) * radius * 0.72 },
        velocity: { x: -Math.sin(orbit), y: Math.cos(orbit) },
        size: member.size * pulse * (0.78 + stats.closeness * 0.32),
        color: member.color,
        alpha,
      } satisfies SimParticle;
    });
    const cometParticles = this.comets.slice(0, cometCount).map((comet) => {
      const member = this.members[comet.memberIndex];
      const orbit = (member.angle + comet.angle + this.elapsed * (0.04 + this.orbitSpeed * 0.12)) * Math.PI * 2;
      const radius = Math.max(3, radiusScale * (member.radius + comet.radiusOffset + stats.calendarLoad * 0.04));
      return {
        position: { x: centerX + Math.cos(orbit) * radius, y: centerY + Math.sin(orbit) * radius * 0.72 },
        velocity: { x: Math.cos(orbit) * stats.activity, y: Math.sin(orbit) * stats.activity },
        size: comet.size * (0.75 + stats.activity * 0.55),
        color: comet.phase > 0.5 ? 0xbfdbfe : 0xfef3c7,
        alpha: clamp((0.06 + stats.activity * 0.22 + stats.calendarLoad * 0.1) * stats.brightness, 0, this.maxBrightness),
      } satisfies SimParticle;
    });
    return [...memberParticles, ...cometParticles];
  }

  stats(): FamilyOrbitStats {
    const sleepScale = this.sleepMode ? 0.24 : 1;
    const lowMotionScale = this.lowMotion ? 0.35 : 1;
    const brightness = 0.22 + this.peopleHome * 0.2 + this.closeness * 0.18 + this.activity * 0.12;
    return {
      memberCount: this.visibleMemberCount(),
      cometCount: this.visibleCometCount(),
      visibleParticles: this.visibleMemberCount() + this.visibleCometCount(),
      peopleHome: this.peopleHome,
      activity: this.activity,
      closeness: this.closeness,
      calendarLoad: this.calendarLoad,
      brightness: clamp(brightness * this.globalIntensity * sleepScale, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.16 + this.orbitSpeed * 0.5 + this.activity * 0.24 + this.calendarLoad * 0.12),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): FamilyOrbitSnapshot {
    const stats = this.stats();
    return {
      stats: {
        ...stats,
        peopleHome: Number(stats.peopleHome.toFixed(4)),
        activity: Number(stats.activity.toFixed(4)),
        closeness: Number(stats.closeness.toFixed(4)),
        calendarLoad: Number(stats.calendarLoad.toFixed(4)),
        brightness: Number(stats.brightness.toFixed(5)),
        motionScale: Number(stats.motionScale.toFixed(5)),
      },
      particles: this.renderParticles().map((particle) => ({
        x: Number(particle.position.x.toFixed(3)),
        y: Number(particle.position.y.toFixed(3)),
        size: Number(particle.size.toFixed(3)),
        alpha: Number(particle.alpha.toFixed(3)),
        color: particle.color,
      })),
    };
  }

  private visibleMemberCount(): number {
    const scale = this.sleepMode ? 0.72 : this.lowMotion ? 0.86 : 1;
    return Math.max(2, Math.min(this.members.length, Math.ceil(this.members.length * scale)));
  }

  private visibleCometCount(): number {
    const scale = (this.sleepMode ? 0.18 : this.lowMotion ? 0.42 : 1) * (0.3 + this.activity * 0.45 + this.calendarLoad * 0.25);
    return Math.max(0, Math.min(this.comets.length, Math.floor(this.comets.length * scale)));
  }
}
