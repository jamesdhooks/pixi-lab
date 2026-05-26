import { SeededRng, TrailField } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface TimeEchoModelOptions {
  seed: number;
  width: number;
  height: number;
  particleCount: number;
  trailColumns: number;
  trailRows: number;
  historyLength: number;
  echoDelay: number;
  memoryPull: number;
  trailFade: number;
  drag: number;
}

export interface TimeEchoStats {
  particleCount: number;
  historyLength: number;
  meanSpeed: number;
  kineticEnergy: number;
  echoSeparation: number;
  trailMax: number;
  trailVariance: number;
  anchorCount: number;
  freezeCount: number;
}

interface EchoParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  heat: number;
  history: Float32Array;
  cursor: number;
  filled: number;
}

interface TimeAnchor {
  x: number;
  y: number;
  strength: number;
  radius: number;
  ttl: number;
}

interface FreezeBubble {
  x: number;
  y: number;
  radius: number;
  ttl: number;
}

export class TimeEchoModel {
  readonly trailField: TrailField;
  private readonly particles: EchoParticle[] = [];
  private readonly anchors: TimeAnchor[] = [];
  private readonly freezes: FreezeBubble[] = [];
  private rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;

  constructor(private readonly options: TimeEchoModelOptions) {
    this.trailField = new TrailField(options.trailColumns, options.trailRows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.stagnantMs = 0;
    this.particles.length = 0;
    this.anchors.length = 0;
    this.freezes.length = 0;
    this.trailField.fill(0);
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    const radiusMax = Math.max(24, Math.min(this.options.width, this.options.height) * 0.42);
    for (let i = 0; i < this.options.particleCount; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(12, radiusMax);
      const speed = this.rng.range(18, 76);
      const tangent = angle + Math.PI * 0.5 + this.rng.range(-0.85, 0.85);
      const particle: EchoParticle = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.72,
        vx: Math.cos(tangent) * speed,
        vy: Math.sin(tangent) * speed,
        size: this.rng.range(1, 3.2),
        phase: this.rng.range(0, Math.PI * 2),
        heat: this.rng.range(0.18, 0.9),
        history: new Float32Array(Math.max(2, this.options.historyLength) * 2),
        cursor: 0,
        filled: 0,
      };
      this.seedHistory(particle);
      this.particles.push(particle);
    }
    this.depositTrails(1);
  }

  update(dt: number): void {
    this.time += dt;
    const frameScale = Math.max(0.25, Math.min(2.5, dt * 60));
    this.trailField.fade(Math.pow(this.options.trailFade, frameScale));
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    for (const p of this.particles) {
      this.recordHistory(p);
      const echo = this.sampleEcho(p, this.options.echoDelay);
      const dx = echo.x - p.x;
      const dy = echo.y - p.y;
      p.vx += dx * this.options.memoryPull * 0.018 * frameScale;
      p.vy += dy * this.options.memoryPull * 0.018 * frameScale;

      const orbitX = cx - p.x;
      const orbitY = cy - p.y;
      p.vx += orbitX * 0.0009 * frameScale;
      p.vy += orbitY * 0.0009 * frameScale;

      for (const anchor of this.anchors) this.applyAnchor(p, anchor, frameScale);
      const freeze = this.freezeFactor(p);
      p.x += p.vx * dt * freeze;
      p.y += p.vy * dt * freeze;
      const drag = Math.max(0, Math.min(0.2, this.options.drag + (1 - freeze) * 0.08));
      p.vx *= 1 - drag * frameScale;
      p.vy *= 1 - drag * frameScale;
      p.phase += dt * (1.3 + this.options.memoryPull * 0.45);
      p.heat = Math.max(0.08, p.heat * (1 - 0.012 * frameScale) + Math.min(0.35, Math.hypot(dx, dy) / 1800));
      this.wrapParticle(p);
    }
    this.ageForces(dt);
    this.depositTrails(0.62);
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') this.addAnchor(event.x, event.y, 1.1, 150, 2.8);
    if (event.kind === 'drag') this.swirl(event.x, event.y, event.dx ?? 0, event.dy ?? 0, 150);
    this.trimForces();
    this.depositTrails(0.9);
  }

  setMemoryPull(value: number): void {
    this.options.memoryPull = value;
  }

  setTrailFade(value: number): void {
    this.options.trailFade = value;
  }

  setEchoDelay(value: number): void {
    this.options.echoDelay = value;
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.meanSpeed < 1.2 || stats.echoSeparation < 0.7 || stats.trailVariance < 0.000001;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1200,
      reason: stagnant ? 'time echoes collapsed into still, overlapping histories' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4200) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    this.addAnchor(cx, cy, -1.4, 260, 1.6);
    for (const p of this.particles) {
      const angle = this.rng.range(0, Math.PI * 2);
      const kick = this.rng.range(28, 92);
      p.vx += Math.cos(angle) * kick;
      p.vy += Math.sin(angle) * kick;
      p.x += Math.cos(angle) * this.rng.range(2, 18);
      p.y += Math.sin(angle) * this.rng.range(2, 18);
      p.heat = Math.min(1.8, p.heat + this.rng.range(0.25, 0.85));
      this.seedHistory(p);
    }
    this.stagnantMs = 0;
    this.depositTrails(1);
  }

  stats(): TimeEchoStats {
    let speed = 0;
    let kinetic = 0;
    let separation = 0;
    for (const p of this.particles) {
      const s = Math.hypot(p.vx, p.vy);
      speed += s;
      kinetic += s * s;
      const echo = this.sampleEcho(p, this.options.echoDelay);
      separation += Math.hypot(echo.x - p.x, echo.y - p.y);
    }
    const count = Math.max(1, this.particles.length);
    const trail = this.trailField.stats();
    return {
      particleCount: this.particles.length,
      historyLength: this.options.historyLength,
      meanSpeed: speed / count,
      kineticEnergy: kinetic / count,
      echoSeparation: separation / count,
      trailMax: trail.max,
      trailVariance: trail.variance,
      anchorCount: this.anchors.length,
      freezeCount: this.freezes.length,
    };
  }

  snapshot(): Array<{ x: number; y: number; vx: number; vy: number; echo: number; heat: number }> {
    return this.particles.slice(0, 32).map((p) => {
      const echo = this.sampleEcho(p, this.options.echoDelay);
      return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), vx: Number(p.vx.toFixed(2)), vy: Number(p.vy.toFixed(2)), echo: Number(Math.hypot(echo.x - p.x, echo.y - p.y).toFixed(2)), heat: Number(p.heat.toFixed(3)) };
    });
  }

  renderParticles(): SimParticle[] {
    const ghosts: SimParticle[] = [];
    for (const p of this.particles) {
      const echo = this.sampleEcho(p, this.options.echoDelay);
      ghosts.push({ position: { x: echo.x, y: echo.y }, velocity: { x: 0, y: 0 }, size: p.size * 1.5, color: 0xffffff, alpha: 0.11 + Math.min(0.24, p.heat * 0.12) });
    }
    for (const p of this.particles) {
      ghosts.push({ position: { x: p.x, y: p.y }, velocity: { x: p.vx, y: p.vy }, size: p.size, color: 0xffffff, alpha: 0.38 + Math.min(0.5, p.heat * 0.38) });
    }
    return ghosts;
  }

  collapseForTest(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    for (const p of this.particles) {
      p.x = cx;
      p.y = cy;
      p.vx = 0;
      p.vy = 0;
      p.heat = 0.08;
      this.seedHistory(p);
    }
    this.trailField.fill(0);
  }

  private seedHistory(p: EchoParticle): void {
    const length = Math.max(2, this.options.historyLength);
    for (let i = 0; i < length; i++) {
      const offset = i * 2;
      p.history[offset] = p.x - p.vx * (length - i) * 0.016;
      p.history[offset + 1] = p.y - p.vy * (length - i) * 0.016;
    }
    p.cursor = 0;
    p.filled = length;
  }

  private recordHistory(p: EchoParticle): void {
    const offset = p.cursor * 2;
    p.history[offset] = p.x;
    p.history[offset + 1] = p.y;
    p.cursor = (p.cursor + 1) % Math.max(2, this.options.historyLength);
    p.filled = Math.min(Math.max(2, this.options.historyLength), p.filled + 1);
  }

  private sampleEcho(p: EchoParticle, delay: number): { x: number; y: number } {
    const length = Math.max(2, this.options.historyLength);
    const safeDelay = Math.max(1, Math.min(length - 1, Math.round(delay)));
    const index = (p.cursor - safeDelay + length) % length;
    const offset = index * 2;
    return { x: p.history[offset], y: p.history[offset + 1] };
  }

  private applyAnchor(p: EchoParticle, anchor: TimeAnchor, frameScale: number): void {
    const dx = anchor.x - p.x;
    const dy = anchor.y - p.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const falloff = Math.max(0, 1 - distance / anchor.radius);
    p.vx += (dx / distance) * anchor.strength * 5.8 * falloff * frameScale;
    p.vy += (dy / distance) * anchor.strength * 5.8 * falloff * frameScale;
    p.heat = Math.min(1.7, p.heat + 0.04 * falloff * frameScale);
  }

  private freezeFactor(p: EchoParticle): number {
    let factor = 1;
    for (const freeze of this.freezes) {
      const distance = Math.hypot(p.x - freeze.x, p.y - freeze.y);
      factor *= 1 - Math.max(0, 1 - distance / freeze.radius) * 0.82;
    }
    return Math.max(0.08, factor);
  }

  private swirl(x: number, y: number, dx: number, dy: number, radius: number): void {
    for (const p of this.particles) {
      const px = p.x - x;
      const py = p.y - y;
      const distance = Math.max(1, Math.hypot(px, py));
      const falloff = Math.max(0, 1 - distance / radius);
      const tangentX = -py / distance;
      const tangentY = px / distance;
      p.vx += (dx * 0.55 + tangentX * 90) * falloff;
      p.vy += (dy * 0.55 + tangentY * 90) * falloff;
      p.heat = Math.min(1.9, p.heat + 0.45 * falloff);
    }
  }

  private addAnchor(x: number, y: number, strength: number, radius: number, ttl: number): void {
    this.anchors.push({ x, y, strength, radius, ttl });
    this.trimForces();
  }

  private ageForces(dt: number): void {
    for (const anchor of this.anchors) anchor.ttl -= dt;
    for (const freeze of this.freezes) freeze.ttl -= dt;
    for (let i = this.anchors.length - 1; i >= 0; i--) if (this.anchors[i].ttl <= 0) this.anchors.splice(i, 1);
    for (let i = this.freezes.length - 1; i >= 0; i--) if (this.freezes[i].ttl <= 0) this.freezes.splice(i, 1);
  }

  private trimForces(): void {
    while (this.anchors.length > 8) this.anchors.shift();
    while (this.freezes.length > 5) this.freezes.shift();
  }

  private wrapParticle(p: EchoParticle): void {
    const pad = 32;
    if (p.x < -pad) p.x = this.options.width + pad;
    if (p.x > this.options.width + pad) p.x = -pad;
    if (p.y < -pad) p.y = this.options.height + pad;
    if (p.y > this.options.height + pad) p.y = -pad;
  }

  private depositTrails(amount: number): void {
    const cols = this.trailField.columns;
    const rows = this.trailField.rows;
    for (const p of this.particles) {
      const echo = this.sampleEcho(p, this.options.echoDelay);
      this.splat(echo.x, echo.y, amount * 0.45, cols, rows);
      this.splat(p.x, p.y, amount * (0.55 + Math.min(0.65, p.heat * 0.35)), cols, rows);
    }
  }

  private splat(x: number, y: number, amount: number, cols: number, rows: number): void {
    const fx = Math.floor((x / Math.max(1, this.options.width)) * (cols - 1));
    const fy = Math.floor((y / Math.max(1, this.options.height)) * (rows - 1));
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = fx + ox;
        const cy = fy + oy;
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        const falloff = ox === 0 && oy === 0 ? 1 : 0.42;
        const next = Math.min(1, this.trailField.get(cx, cy) + amount * falloff * 0.026);
        this.trailField.set(cx, cy, next);
      }
    }
  }
}
