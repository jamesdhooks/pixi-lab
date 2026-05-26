import { ScalarField, SeededRng, SpringSystem } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport, Vec2 } from '@hooksjam/pixi-lab-core';

export interface CellularOceanModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  cellCount: number;
  membranePoints: number;
  membraneTension: number;
  viscosity: number;
  pulseStrength: number;
  driftStrength: number;
}

export interface CellularOceanStats {
  cellCount: number;
  nodeCount: number;
  edgeCount: number;
  meanSpeed: number;
  meanRadiusError: number;
  fieldVariance: number;
  fieldMax: number;
}

interface CellState {
  center: Vec2;
  velocity: Vec2;
  radius: number;
  firstNode: number;
  nodeCount: number;
  phase: number;
  hue: number;
}

interface NodeState {
  cellIndex: number;
  angle: number;
  velocity: Vec2;
}

export class CellularOceanModel {
  readonly densityField: ScalarField;
  readonly springs = new SpringSystem();
  private readonly cells: CellState[] = [];
  private readonly nodes: NodeState[] = [];
  private rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;

  constructor(private readonly options: CellularOceanModelOptions) {
    this.densityField = new ScalarField(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.time = 0;
    this.stagnantMs = 0;
    this.springs.nodes.length = 0;
    this.springs.edges.length = 0;
    this.cells.length = 0;
    this.nodes.length = 0;
    this.buildCells();
    this.projectField();
  }

  update(dt: number): void {
    this.time += dt;
    this.driftCells(dt);
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.nodes[i];
      if (!node || !state) continue;
      const cell = this.cells[state.cellIndex];
      if (!cell) continue;
      const targetX = cell.center.x + Math.cos(state.angle) * cell.radius;
      const targetY = cell.center.y + Math.sin(state.angle) * cell.radius;
      const pulse = Math.sin(this.time * 1.7 + cell.phase + state.angle * 3) * this.options.driftStrength * 8;
      state.velocity.x += (targetX - node.position.x) * this.options.membraneTension * dt;
      state.velocity.y += (targetY - node.position.y) * this.options.membraneTension * dt;
      state.velocity.x += Math.cos(state.angle + cell.phase) * pulse * dt;
      state.velocity.y += Math.sin(state.angle + cell.phase) * pulse * dt;
      node.previous.x = node.position.x;
      node.previous.y = node.position.y;
      node.position.x += state.velocity.x * dt;
      node.position.y += state.velocity.y * dt;
      state.velocity.x *= this.options.viscosity;
      state.velocity.y *= this.options.viscosity;
      this.constrain(node.position);
    }
    this.resolveCellRepulsion(dt);
    this.springs.step(3);
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.nodes[i];
      if (!node || !state) continue;
      state.velocity.x += (node.position.x - node.previous.x) * 0.22;
      state.velocity.y += (node.position.y - node.previous.y) * 0.22;
    }
    this.projectField();
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') this.pulse(event.x, event.y, this.options.pulseStrength, 1);
    if (event.kind === 'hold') this.pulse(event.x, event.y, this.options.pulseStrength * 1.3, -1);
    if (event.kind === 'drag') this.shear(event.x, event.y, event.dx ?? 0, event.dy ?? 0);
    if (event.kind === 'fast_swipe') this.pulse(event.x, event.y, this.options.pulseStrength * 1.8, 1);
    this.projectField();
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.meanSpeed < 0.22 && stats.fieldVariance < 0.002;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs >= 1400,
      reason: stagnant ? 'cell membranes settled into a uniform low-motion ocean' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 4400) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    this.pulse(this.options.width * this.rng.range(0.2, 0.8), this.options.height * this.rng.range(0.2, 0.8), this.options.pulseStrength * 1.9, this.rng.next() > 0.5 ? 1 : -1);
    this.stagnantMs = 0;
  }

  setMembraneTension(v: number): void {
    this.options.membraneTension = v;
    for (const edge of this.springs.edges) edge.stiffness = v;
  }
  setViscosity(v: number): void { this.options.viscosity = v; }
  setPulseStrength(v: number): void { this.options.pulseStrength = v; }
  setDriftStrength(v: number): void { this.options.driftStrength = v; }

  stats(): CellularOceanStats {
    let speed = 0;
    let radiusError = 0;
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.nodes[i];
      const cell = state ? this.cells[state.cellIndex] : undefined;
      if (!node || !state || !cell) continue;
      speed += Math.hypot(state.velocity.x, state.velocity.y);
      radiusError += Math.abs(Math.hypot(node.position.x - cell.center.x, node.position.y - cell.center.y) - cell.radius);
    }
    const field = this.densityField.stats();
    return {
      cellCount: this.cells.length,
      nodeCount: this.springs.nodes.length,
      edgeCount: this.springs.edges.length,
      meanSpeed: speed / Math.max(1, this.springs.nodes.length),
      meanRadiusError: radiusError / Math.max(1, this.springs.nodes.length),
      fieldVariance: field.variance,
      fieldMax: field.max,
    };
  }

  snapshot(): Array<{ x: number; y: number; vx: number; vy: number }> {
    return this.cells.map((cell) => ({
      x: Number(cell.center.x.toFixed(2)),
      y: Number(cell.center.y.toFixed(2)),
      vx: Number(cell.velocity.x.toFixed(2)),
      vy: Number(cell.velocity.y.toFixed(2)),
    }));
  }

  renderParticles(): SimParticle[] {
    return this.springs.nodes.map((node, i) => {
      const state = this.nodes[i];
      const speed = Math.min(1, Math.hypot(state?.velocity.x ?? 0, state?.velocity.y ?? 0) / 70);
      return {
        position: { x: node.position.x, y: node.position.y },
        velocity: { x: state?.velocity.x ?? 0, y: state?.velocity.y ?? 0 },
        size: 2.6 + speed * 5,
        color: speed > 0.55 ? 0xffffff : 0x6fffe7,
        alpha: 0.48 + speed * 0.45,
      };
    });
  }

  freezeForTest(): void {
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.nodes[i];
      const cell = state ? this.cells[state.cellIndex] : undefined;
      if (!node || !state || !cell) continue;
      node.position.x = cell.center.x + Math.cos(state.angle) * cell.radius;
      node.position.y = cell.center.y + Math.sin(state.angle) * cell.radius;
      node.previous.x = node.position.x;
      node.previous.y = node.position.y;
      state.velocity.x = 0;
      state.velocity.y = 0;
    }
    for (const cell of this.cells) {
      cell.velocity.x = 0;
      cell.velocity.y = 0;
    }
    this.densityField.fill(0);
  }

  private buildCells(): void {
    const count = Math.max(1, Math.floor(this.options.cellCount));
    const points = Math.max(6, Math.floor(this.options.membranePoints));
    const baseRadius = Math.min(this.options.width, this.options.height) / Math.max(8, Math.sqrt(count) * 5.6);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + this.rng.range(-0.25, 0.25);
      const orbit = Math.min(this.options.width, this.options.height) * this.rng.range(0.08, 0.34);
      const center = {
        x: this.options.width * 0.5 + Math.cos(angle) * orbit,
        y: this.options.height * 0.5 + Math.sin(angle) * orbit,
      };
      const cell: CellState = {
        center,
        velocity: { x: this.rng.range(-12, 12), y: this.rng.range(-12, 12) },
        radius: baseRadius * this.rng.range(0.76, 1.28),
        firstNode: this.springs.nodes.length,
        nodeCount: points,
        phase: this.rng.range(0, Math.PI * 2),
        hue: this.rng.next(),
      };
      this.cells.push(cell);
      for (let p = 0; p < points; p++) {
        const theta = (Math.PI * 2 * p) / points;
        const x = center.x + Math.cos(theta) * cell.radius * this.rng.range(0.92, 1.08);
        const y = center.y + Math.sin(theta) * cell.radius * this.rng.range(0.92, 1.08);
        this.springs.nodes.push({ position: { x, y }, previous: { x, y } });
        this.nodes.push({ cellIndex: i, angle: theta, velocity: { x: this.rng.range(-5, 5), y: this.rng.range(-5, 5) } });
      }
      for (let p = 0; p < points; p++) {
        this.addEdge(cell.firstNode + p, cell.firstNode + ((p + 1) % points));
        this.addEdge(cell.firstNode + p, cell.firstNode + ((p + 2) % points));
      }
    }
  }

  private addEdge(a: number, b: number): void {
    const na = this.springs.nodes[a];
    const nb = this.springs.nodes[b];
    if (!na || !nb) return;
    this.springs.edges.push({ a, b, restLength: Math.hypot(nb.position.x - na.position.x, nb.position.y - na.position.y), stiffness: this.options.membraneTension });
  }

  private driftCells(dt: number): void {
    for (const cell of this.cells) {
      cell.velocity.x += Math.cos(this.time * 0.37 + cell.phase) * this.options.driftStrength * 7 * dt;
      cell.velocity.y += Math.sin(this.time * 0.29 + cell.phase * 1.3) * this.options.driftStrength * 7 * dt;
      cell.center.x += cell.velocity.x * dt;
      cell.center.y += cell.velocity.y * dt;
      cell.velocity.x *= 0.992;
      cell.velocity.y *= 0.992;
      if (cell.center.x < cell.radius || cell.center.x > this.options.width - cell.radius) cell.velocity.x *= -0.72;
      if (cell.center.y < cell.radius || cell.center.y > this.options.height - cell.radius) cell.velocity.y *= -0.72;
      cell.center.x = Math.max(cell.radius, Math.min(this.options.width - cell.radius, cell.center.x));
      cell.center.y = Math.max(cell.radius, Math.min(this.options.height - cell.radius, cell.center.y));
    }
  }

  private resolveCellRepulsion(dt: number): void {
    for (let a = 0; a < this.cells.length; a++) {
      for (let b = a + 1; b < this.cells.length; b++) {
        const ca = this.cells[a];
        const cb = this.cells[b];
        if (!ca || !cb) continue;
        const dx = cb.center.x - ca.center.x;
        const dy = cb.center.y - ca.center.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const target = (ca.radius + cb.radius) * 1.45;
        if (distance >= target) continue;
        const force = (target - distance) / target * 28 * dt;
        ca.velocity.x -= (dx / distance) * force;
        ca.velocity.y -= (dy / distance) * force;
        cb.velocity.x += (dx / distance) * force;
        cb.velocity.y += (dy / distance) * force;
      }
    }
  }

  private pulse(x: number, y: number, strength: number, direction: number): void {
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.nodes[i];
      if (!node || !state) continue;
      const dx = node.position.x - x;
      const dy = node.position.y - y;
      const distance = Math.max(8, Math.hypot(dx, dy));
      const influence = Math.max(0, 1 - distance / 220) * strength * direction;
      state.velocity.x += (dx / distance) * influence;
      state.velocity.y += (dy / distance) * influence;
    }
  }

  private shear(x: number, y: number, dx: number, dy: number): void {
    for (let i = 0; i < this.springs.nodes.length; i++) {
      const node = this.springs.nodes[i];
      const state = this.nodes[i];
      if (!node || !state) continue;
      const distance = Math.hypot(node.position.x - x, node.position.y - y);
      const influence = Math.max(0, 1 - distance / 170);
      state.velocity.x += dx * influence * 0.55;
      state.velocity.y += dy * influence * 0.55;
    }
  }

  private projectField(): void {
    this.densityField.fill(0);
    for (const cell of this.cells) this.deposit(cell.center.x, cell.center.y, cell.radius * 1.4, 0.25 + cell.hue * 0.18);
    for (const node of this.springs.nodes) this.deposit(node.position.x, node.position.y, 18, 0.7);
    for (let i = 0; i < this.densityField.values.length; i++) this.densityField.values[i] = Math.min(1, this.densityField.values[i]);
  }

  private deposit(x: number, y: number, radius: number, amount: number): void {
    const gx = x / Math.max(1, this.options.width) * (this.densityField.columns - 1);
    const gy = y / Math.max(1, this.options.height) * (this.densityField.rows - 1);
    const gr = Math.max(1, radius / Math.max(1, this.options.width) * this.densityField.columns);
    const minX = Math.max(0, Math.floor(gx - gr));
    const maxX = Math.min(this.densityField.columns - 1, Math.ceil(gx + gr));
    const minY = Math.max(0, Math.floor(gy - gr));
    const maxY = Math.min(this.densityField.rows - 1, Math.ceil(gy + gr));
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const distance = Math.hypot(xx - gx, yy - gy);
        const influence = Math.max(0, 1 - distance / gr);
        if (influence <= 0) continue;
        const index = yy * this.densityField.columns + xx;
        this.densityField.values[index] += influence * amount;
      }
    }
  }

  private constrain(position: Vec2): void {
    position.x = Math.max(0, Math.min(this.options.width, position.x));
    position.y = Math.max(0, Math.min(this.options.height, position.y));
  }
}
