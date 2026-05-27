import type { AmbientDataSnapshot, SimParticle } from '@hooksjam/pixi-lab-core';
import { SeededRng } from '@hooksjam/pixi-lab-core';

export interface HousePulseMapModelOptions {
  seed: number;
  width: number;
  height: number;
  nodeCount: number;
  connectionCount: number;
  maxBrightness: number;
}

interface HouseNode {
  x: number;
  y: number;
  room: number;
  baseSize: number;
  phase: number;
  activityBias: number;
}

interface HouseConnection {
  from: number;
  to: number;
  phase: number;
  strength: number;
}

export interface HousePulseMapStats {
  nodeCount: number;
  connectionCount: number;
  visibleParticles: number;
  occupancy: number;
  energyUse: number;
  eventRate: number;
  securityState: number;
  brightness: number;
  motionScale: number;
  width: number;
  height: number;
}

export interface HousePulseMapSnapshot {
  stats: HousePulseMapStats;
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

export class HousePulseMapModel {
  private width: number;
  private height: number;
  private readonly nodes: HouseNode[];
  private readonly connections: HouseConnection[];
  private maxBrightness: number;
  private elapsed = 0;
  private occupancy = 0.42;
  private energyUse = 0.36;
  private eventRate = 0.28;
  private securityState = 0.12;
  private globalIntensity = 0.72;
  private eventSensitivity = 0.68;
  private pulseSpeed = 0.58;
  private sleepMode = false;
  private lowMotion = false;

  constructor(options: HousePulseMapModelOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.maxBrightness = clamp(options.maxBrightness, 0.1, 0.72);
    const rng = new SeededRng(options.seed);
    const nodeCount = Math.max(16, Math.floor(options.nodeCount));
    const connectionCount = Math.max(12, Math.floor(options.connectionCount));
    this.nodes = Array.from({ length: nodeCount }, (_, index) => {
      const room = index % 6;
      const roomCol = room % 3;
      const roomRow = Math.floor(room / 3);
      return {
        x: clamp((roomCol + 0.18 + rng.next() * 0.64) / 3, 0.04, 0.96),
        y: clamp((roomRow + 0.16 + rng.next() * 0.68) / 2, 0.05, 0.95),
        room,
        baseSize: rng.range(2.4, 8.6),
        phase: rng.next(),
        activityBias: rng.range(0.2, 1),
      };
    });
    this.connections = Array.from({ length: connectionCount }, () => {
      const from = Math.floor(rng.next() * nodeCount);
      const span = 1 + Math.floor(rng.next() * Math.min(12, nodeCount - 1));
      return {
        from,
        to: (from + span) % nodeCount,
        phase: rng.next(),
        strength: rng.range(0.28, 1),
      };
    });
  }

  applyAmbientData(snapshots: readonly AmbientDataSnapshot[]): void {
    const home = snapshots.find((snapshot) => snapshot.source === 'homeAssistant');
    const presence = snapshots.find((snapshot) => snapshot.source === 'presence');
    const synthetic = snapshots.find((snapshot) => snapshot.source === 'synthetic');
    const time = snapshots.find((snapshot) => snapshot.source === 'time');
    const phase = numberValue(synthetic, 'phase') ?? numberValue(time, 'phase') ?? 0.25;
    const intensity = numberValue(synthetic, 'intensity') ?? 0.42;

    const occupancy = numberValue(home, 'occupancy') ?? numberValue(presence, 'occupancy') ?? numberValue(presence, 'peopleHome');
    const energyUse = numberValue(home, 'energyUse') ?? numberValue(home, 'power') ?? numberValue(home, 'load');
    const eventRate = numberValue(home, 'eventRate') ?? numberValue(home, 'activity') ?? numberValue(synthetic, 'activity');
    const security = numberValue(home, 'securityState') ?? numberValue(home, 'security') ?? numberValue(home, 'alerts');
    const sleep = boolValue(home, 'sleepMode') ?? boolValue(synthetic, 'sleepMode') ?? boolValue(time, 'sleepMode');

    this.occupancy = occupancy !== null ? normalizePercent(occupancy) : clamp(0.25 + intensity * 0.42 + Math.sin(wrap01(phase) * Math.PI * 2) * 0.16);
    this.energyUse = energyUse !== null ? normalizePercent(energyUse) : clamp(0.22 + intensity * 0.48 + Math.cos(wrap01(phase + 0.18) * Math.PI * 2) * 0.14);
    this.eventRate = eventRate !== null ? normalizePercent(eventRate) : clamp(0.12 + intensity * 0.5 + Math.sin(wrap01(phase + 0.33) * Math.PI * 4) * 0.16);
    this.securityState = security !== null ? normalizePercent(security) : clamp(0.04 + Math.max(0, Math.sin(wrap01(phase + 0.62) * Math.PI * 2)) * 0.18);
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
    this.maxBrightness = clamp(value, 0.1, 0.72);
  }

  setEventSensitivity(value: number): void {
    this.eventSensitivity = clamp(value, 0, 1);
  }

  setPulseSpeed(value: number): void {
    this.pulseSpeed = clamp(value, 0, 1);
  }

  setSleepMode(enabled: boolean): void {
    this.sleepMode = enabled;
  }

  setLowMotion(enabled: boolean): void {
    this.lowMotion = enabled;
  }

  renderParticles(): SimParticle[] {
    const stats = this.stats();
    const palette = [0x22d3ee, 0x34d399, 0xfacc15, 0xfb7185, 0xa78bfa, 0x93c5fd];
    const activity = clamp(stats.occupancy * 0.38 + stats.energyUse * 0.28 + stats.eventRate * 0.34);
    const connectionCount = this.visibleConnectionCount();
    const nodeCount = this.visibleNodeCount();
    const connectionParticles = this.connections.slice(0, connectionCount).map((connection, index) => {
      const from = this.nodes[connection.from];
      const to = this.nodes[connection.to];
      const travel = wrap01(connection.phase + this.elapsed * (0.12 + this.pulseSpeed * 0.32) * (0.3 + stats.eventRate));
      const x = (from.x + (to.x - from.x) * travel) * this.width;
      const y = (from.y + (to.y - from.y) * travel) * this.height;
      const alertBoost = index % 11 === 0 ? stats.securityState : 0;
      return {
        position: { x, y },
        velocity: { x: (to.x - from.x) * this.width, y: (to.y - from.y) * this.height },
        size: (1.4 + connection.strength * 3.2) * (0.75 + stats.eventRate * this.eventSensitivity),
        color: alertBoost > 0.35 ? 0xfb7185 : palette[(from.room + index) % palette.length],
        alpha: clamp((0.12 + connection.strength * 0.28 + alertBoost * 0.28) * stats.brightness, 0, this.maxBrightness),
      } satisfies SimParticle;
    });

    const nodeParticles = this.nodes.slice(0, nodeCount).map((node, index) => {
      const pulse = 0.58 + Math.sin((node.phase + this.elapsed * (0.06 + this.pulseSpeed * 0.22)) * Math.PI * 2) * 0.22 + activity * node.activityBias * 0.55;
      const alert = node.room === 5 ? stats.securityState : 0;
      return {
        position: { x: node.x * this.width, y: node.y * this.height },
        velocity: { x: 0, y: 0 },
        size: node.baseSize * pulse,
        color: alert > 0.3 ? 0xf43f5e : palette[(node.room + index) % palette.length],
        alpha: clamp((0.2 + node.activityBias * 0.36 + alert * 0.3) * stats.brightness, 0, this.maxBrightness),
      } satisfies SimParticle;
    });
    return [...connectionParticles, ...nodeParticles];
  }

  stats(): HousePulseMapStats {
    const sleepScale = this.sleepMode ? 0.24 : 1;
    const lowMotionScale = this.lowMotion ? 0.34 : 1;
    const activeBrightness = 0.18 + this.occupancy * 0.2 + this.energyUse * 0.2 + this.eventRate * 0.24 + this.securityState * 0.18;
    return {
      nodeCount: this.visibleNodeCount(),
      connectionCount: this.visibleConnectionCount(),
      visibleParticles: this.visibleNodeCount() + this.visibleConnectionCount(),
      occupancy: this.occupancy,
      energyUse: this.energyUse,
      eventRate: this.eventRate,
      securityState: this.securityState,
      brightness: clamp(activeBrightness * this.globalIntensity * sleepScale, 0, this.maxBrightness),
      motionScale: sleepScale * lowMotionScale * (0.24 + this.eventRate * 0.44 + this.occupancy * 0.24 + this.pulseSpeed * 0.2),
      width: this.width,
      height: this.height,
    };
  }

  snapshot(): HousePulseMapSnapshot {
    const stats = this.stats();
    return {
      stats: {
        ...stats,
        occupancy: Number(stats.occupancy.toFixed(4)),
        energyUse: Number(stats.energyUse.toFixed(4)),
        eventRate: Number(stats.eventRate.toFixed(4)),
        securityState: Number(stats.securityState.toFixed(4)),
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

  private visibleNodeCount(): number {
    const sleep = this.sleepMode ? 0.48 : 1;
    const motion = this.lowMotion ? 0.72 : 1;
    const activity = 0.46 + this.occupancy * 0.3 + this.eventRate * 0.24;
    return Math.max(8, Math.min(this.nodes.length, Math.round(this.nodes.length * sleep * motion * activity)));
  }

  private visibleConnectionCount(): number {
    const sleep = this.sleepMode ? 0.32 : 1;
    const motion = this.lowMotion ? 0.54 : 1;
    const activity = 0.34 + this.eventRate * 0.44 + this.energyUse * 0.22;
    return Math.max(6, Math.min(this.connections.length, Math.round(this.connections.length * sleep * motion * activity)));
  }
}
