import { ScalarField, SeededRng, SpringSystem } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport, Vec2 } from '@hooksjam/pixi-lab-core';

export interface JellyWebModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  ringCount: number;
  spokeCount: number;
  springTension: number;
  damping: number;
  pulseStrength: number;
  resonance: number;
}

export interface JellyWebStats {
  nodeCount: number;
  edgeCount: number;
  meanSpeed: number;
  meanDisplacement: number;
  fieldVariance: number;
  fieldMax: number;
}

interface WebNodeState {
  anchor: Vec2;
  velocity: Vec2;
  phase: number;
  ring: number;
}

export class JellyWebModel {
  readonly resonanceField: ScalarField;
  readonly springs = new SpringSystem();
  private readonly states: WebNodeState[] = [];
  private rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;

  constructor(private readonly options: JellyWebModelOptions) {
    this.resonanceField = new ScalarField(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.stagnantMs = 0;
    this.springs.nodes.length = 0;
    this.springs.edges.length = 0;
    this.states.length = 0;
    this.buildWeb();
    this.projectField();
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.states[i];
      if (!node || !state || node.pinned) continue;
      const wobble = Math.sin(this.time * this.options.resonance + state.phase) * (10 + state.ring * 1.5);
      const dx = state.anchor.x - node.position.x;
      const dy = state.anchor.y - node.position.y;
      state.velocity.x += dx * this.options.springTension * dt;
      state.velocity.y += dy * this.options.springTension * dt;
      state.velocity.x += Math.cos(state.phase + this.time * 0.73) * wobble * dt;
      state.velocity.y += Math.sin(state.phase * 1.17 + this.time * 0.91) * wobble * dt;
      node.previous.x = node.position.x;
      node.previous.y = node.position.y;
      node.position.x += state.velocity.x * dt;
      node.position.y += state.velocity.y * dt;
      state.velocity.x *= this.options.damping;
      state.velocity.y *= this.options.damping;
      this.constrain(node.position);
    }
    this.springs.step(3);
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.states[i];
      if (!node || !state) continue;
      state.velocity.x += (node.position.x - node.previous.x) * 0.25;
      state.velocity.y += (node.position.y - node.previous.y) * 0.25;
    }
    this.projectField();
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') this.pulse(event.x, event.y, this.options.pulseStrength, 1);
    if (event.kind === 'hold') this.pulse(event.x, event.y, this.options.pulseStrength * 1.35, -1);
    if (event.kind === 'drag') this.drag(event.x, event.y, event.dx ?? 0, event.dy ?? 0);
    if (event.kind === 'fast_swipe') this.pulse(event.x, event.y, this.options.pulseStrength * 1.8, 1);
    this.projectField();
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.meanSpeed < 0.35 && stats.meanDisplacement < 1.2;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1200,
      reason: stagnant ? 'spring web settled into a low-energy resting shape' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4200) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    const cx = this.options.width * this.rng.range(0.25, 0.75);
    const cy = this.options.height * this.rng.range(0.25, 0.75);
    this.pulse(cx, cy, this.options.pulseStrength * 1.75, this.rng.next() > 0.5 ? 1 : -1);
    this.stagnantMs = 0;
  }

  setSpringTension(v: number): void {
    this.options.springTension = v;
    for (let i = 0; i < this.springs.edges.length; i++) this.springs.edges[i].stiffness = v;
  }
  setDamping(v: number): void { this.options.damping = v; }
  setPulseStrength(v: number): void { this.options.pulseStrength = v; }
  setResonance(v: number): void { this.options.resonance = v; }

  stats(): JellyWebStats {
    let speed = 0;
    let displacement = 0;
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.states[i];
      if (!node || !state) continue;
      speed += Math.hypot(state.velocity.x, state.velocity.y);
      displacement += Math.hypot(node.position.x - state.anchor.x, node.position.y - state.anchor.y);
    }
    const field = this.resonanceField.stats();
    return {
      nodeCount: this.springs.nodes.length,
      edgeCount: this.springs.edges.length,
      meanSpeed: speed / Math.max(1, this.springs.nodes.length),
      meanDisplacement: displacement / Math.max(1, this.springs.nodes.length),
      fieldVariance: field.variance,
      fieldMax: field.max,
    };
  }

  snapshot(): Array<{ x: number; y: number; vx: number; vy: number }> {
    return this.springs.nodes.map((node, i) => ({
      x: Number(node.position.x.toFixed(2)),
      y: Number(node.position.y.toFixed(2)),
      vx: Number((this.states[i]?.velocity.x ?? 0).toFixed(2)),
      vy: Number((this.states[i]?.velocity.y ?? 0).toFixed(2)),
    }));
  }

  nodeSnapshot(): Array<{ x: number; y: number }> {
    return this.springs.nodes.map((node) => ({ x: node.position.x, y: node.position.y }));
  }

  renderParticles(): SimParticle[] {
    return this.springs.nodes.map((node, i) => {
      const state = this.states[i];
      const energy = Math.min(1, Math.hypot(state?.velocity.x ?? 0, state?.velocity.y ?? 0) / 80);
      return {
        position: { x: node.position.x, y: node.position.y },
        velocity: { x: state?.velocity.x ?? 0, y: state?.velocity.y ?? 0 },
        size: 3 + (state?.ring ?? 0) * 0.38 + energy * 4,
        color: energy > 0.55 ? 0xffffff : 0x77f7ff,
        alpha: 0.54 + energy * 0.42,
      };
    });
  }

  freezeForTest(): void {
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.states[i];
      if (!node || !state) continue;
      node.position.x = state.anchor.x;
      node.position.y = state.anchor.y;
      node.previous.x = state.anchor.x;
      node.previous.y = state.anchor.y;
      state.velocity.x = 0;
      state.velocity.y = 0;
    }
    this.projectField();
  }

  private buildWeb(): void {
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    const maxRadius = Math.min(this.options.width, this.options.height) * 0.42;
    const rings = Math.max(2, Math.floor(this.options.ringCount));
    const spokes = Math.max(6, Math.floor(this.options.spokeCount));
    for (let ring = 0; ring <= rings; ring++) {
      const radius = ring === 0 ? 0 : (maxRadius * ring) / rings;
      const count = ring === 0 ? 1 : spokes;
      for (let s = 0; s < count; s++) {
        const angle = ring === 0 ? 0 : (Math.PI * 2 * s) / spokes;
        const jitter = ring === 0 ? 0 : this.rng.range(-2.5, 2.5);
        const x = cx + Math.cos(angle) * (radius + jitter);
        const y = cy + Math.sin(angle) * (radius + jitter);
        const pinned = ring === rings && s % 2 === 0;
        this.springs.nodes.push({ position: { x, y }, previous: { x, y }, pinned });
        this.states.push({ anchor: { x, y }, velocity: { x: this.rng.range(-6, 6), y: this.rng.range(-6, 6) }, phase: this.rng.range(0, Math.PI * 2), ring });
      }
    }
    const index = (ring: number, spoke: number) => ring === 0 ? 0 : 1 + (ring - 1) * spokes + ((spoke + spokes) % spokes);
    for (let ring = 1; ring <= rings; ring++) {
      for (let s = 0; s < spokes; s++) {
        this.addEdge(index(ring, s), index(ring, s + 1));
        this.addEdge(index(ring, s), index(ring - 1, s));
        if (ring > 1 && s % 2 === 0) this.addEdge(index(ring, s), index(ring - 1, s + 1));
      }
    }
  }

  private addEdge(a: number, b: number): void {
    if (a === b) return;
    const na = this.springs.nodes[a];
    const nb = this.springs.nodes[b];
    if (!na || !nb) return;
    const restLength = Math.hypot(nb.position.x - na.position.x, nb.position.y - na.position.y);
    this.springs.edges.push({ a, b, restLength, stiffness: this.options.springTension });
  }

  private pulse(x: number, y: number, strength: number, polarity: number): void {
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.states[i];
      if (!node || !state) continue;
      const dx = node.position.x - x;
      const dy = node.position.y - y;
      const dist = Math.max(8, Math.hypot(dx, dy));
      const falloff = Math.max(0, 1 - dist / 240);
      state.velocity.x += (dx / dist) * strength * falloff * polarity;
      state.velocity.y += (dy / dist) * strength * falloff * polarity;
    }
  }

  private drag(x: number, y: number, dx: number, dy: number): void {
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.states[i];
      if (!node || !state) continue;
      const dist = Math.hypot(node.position.x - x, node.position.y - y);
      const falloff = Math.max(0, 1 - dist / 210);
      state.velocity.x += dx * 1.65 * falloff;
      state.velocity.y += dy * 1.65 * falloff;
    }
  }

  private projectField(): void {
    this.resonanceField.fill(0);
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.states[i];
      if (!node || !state) continue;
      const energy = 0.22 + Math.min(1, Math.hypot(state.velocity.x, state.velocity.y) / 90);
      this.paint(node.position.x, node.position.y, energy, 3.2 + state.ring * 0.28);
    }
    for (let i = 0; i < this.springs.edges.length; i++) {
      const edge = this.springs.edges[i];
      const a = this.springs.nodes[edge.a];
      const b = this.springs.nodes[edge.b];
      if (!a || !b) continue;
      for (let s = 1; s < 4; s++) {
        const t = s / 4;
        this.paint(a.position.x + (b.position.x - a.position.x) * t, a.position.y + (b.position.y - a.position.y) * t, 0.18, 2.1);
      }
    }
  }

  private paint(x: number, y: number, amount: number, radius: number): void {
    const gx = (x / Math.max(1, this.options.width)) * (this.options.columns - 1);
    const gy = (y / Math.max(1, this.options.height)) * (this.options.rows - 1);
    const r = Math.max(1, radius);
    const minX = Math.max(0, Math.floor(gx - r));
    const maxX = Math.min(this.options.columns - 1, Math.ceil(gx + r));
    const minY = Math.max(0, Math.floor(gy - r));
    const maxY = Math.min(this.options.rows - 1, Math.ceil(gy + r));
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const dist = Math.hypot(xx - gx, yy - gy);
        const falloff = Math.max(0, 1 - dist / r);
        this.resonanceField.set(xx, yy, this.resonanceField.get(xx, yy) + amount * falloff);
      }
    }
  }

  private constrain(position: Vec2): void {
    position.x = Math.max(0, Math.min(this.options.width, position.x));
    position.y = Math.max(0, Math.min(this.options.height, position.y));
  }
}
