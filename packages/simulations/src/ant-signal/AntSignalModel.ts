import { ScalarField, SeededRng, TrailField } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, SimParticle, StagnationReport } from '@hooksjam/pixi-lab-core';

export interface AntSignalModelOptions {
  seed: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  antCount: number;
  foodCount: number;
  pheromoneDecay: number;
}

export interface AntSignalStats {
  antCount: number;
  foodCount: number;
  carryingCount: number;
  trailMax: number;
  trailTotal: number;
  trailVariance: number;
  foodSignalMax: number;
  nestSignalMax: number;
}

interface AntAgent {
  x: number;
  y: number;
  vx: number;
  vy: number;
  carrying: boolean;
  wander: number;
}

interface FoodSource {
  x: number;
  y: number;
  amount: number;
}

export class AntSignalModel {
  readonly pheromoneField: TrailField;
  readonly foodSignalField: ScalarField;
  readonly nestSignalField: ScalarField;
  private readonly ants: AntAgent[] = [];
  private readonly foodSources: FoodSource[] = [];
  private rng: SeededRng;
  private stagnantMs = 0;

  constructor(private readonly options: AntSignalModelOptions) {
    this.pheromoneField = new TrailField(options.columns, options.rows);
    this.foodSignalField = new ScalarField(options.columns, options.rows);
    this.nestSignalField = new ScalarField(options.columns, options.rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  reset(seed = this.options.seed): void {
    this.rng = new SeededRng(seed);
    this.stagnantMs = 0;
    this.ants.length = 0;
    this.foodSources.length = 0;
    this.pheromoneField.fill(0);
    this.foodSignalField.fill(0);
    this.nestSignalField.fill(0);
    const cx = this.options.width * 0.5;
    const cy = this.options.height * 0.5;
    for (let i = 0; i < this.options.antCount; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(3, Math.min(this.options.width, this.options.height) * 0.08);
      this.ants.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, vx: Math.cos(angle) * 42, vy: Math.sin(angle) * 42, carrying: false, wander: this.rng.range(0, Math.PI * 2) });
    }
    for (let i = 0; i < this.options.foodCount; i++) this.addFood(this.rng.range(0.12, 0.88) * this.options.width, this.rng.range(0.12, 0.88) * this.options.height, this.rng.range(0.55, 1));
    this.injectNestSignal(cx, cy, 1);
  }

  update(dt: number): void {
    const frameScale = Math.max(1, dt * 60);
    this.pheromoneField.fade(Math.pow(this.options.pheromoneDecay, frameScale));
    this.foodSignalField.fill(0);
    this.nestSignalField.fill(0);
    for (const food of this.foodSources) this.injectFoodSignal(food.x, food.y, food.amount);
    this.injectNestSignal(this.options.width * 0.5, this.options.height * 0.5, 1);

    for (const ant of this.ants) {
      const targetField = ant.carrying ? this.nestSignalField : this.foodSignalField;
      const nx = ant.x / Math.max(1, this.options.width);
      const ny = ant.y / Math.max(1, this.options.height);
      const gradient = targetField.gradientNormalized(nx, ny);
      ant.wander += this.rng.range(-0.42, 0.42) * dt * 9;
      ant.vx += gradient.x * 260 * dt + Math.cos(ant.wander) * 26 * dt;
      ant.vy += gradient.y * 260 * dt + Math.sin(ant.wander) * 26 * dt;
      const speed = Math.max(18, Math.hypot(ant.vx, ant.vy));
      const desiredSpeed = ant.carrying ? 70 : 88;
      ant.vx = (ant.vx / speed) * Math.min(desiredSpeed, speed + 18 * dt);
      ant.vy = (ant.vy / speed) * Math.min(desiredSpeed, speed + 18 * dt);
      ant.x += ant.vx * dt;
      ant.y += ant.vy * dt;
      this.keepInBounds(ant);
      this.depositTrail(ant.x, ant.y, ant.carrying ? 0.075 : 0.04);
      this.handleFoodPickupAndReturn(ant);
    }
    for (let i = this.foodSources.length - 1; i >= 0; i--) if (this.foodSources[i].amount <= 0.04) this.foodSources.splice(i, 1);
    if (this.foodSources.length < Math.max(1, Math.floor(this.options.foodCount / 2)) && this.rng.next() < dt * 0.18) this.addFood(this.rng.range(0.1, 0.9) * this.options.width, this.rng.range(0.1, 0.9) * this.options.height, 0.7);
  }

  handleGesture(event: GestureEvent): void {
    if (event.kind === 'tap') this.addFood(event.x, event.y, 1);
    if (event.kind === 'hold') {
      this.addFood(event.x, event.y, 0.75);
      this.paintTrail(event.x - 18, event.y - 18, event.x + 18, event.y + 18, 0.8);
    }
    if (event.kind === 'drag') this.paintTrail(event.x - (event.dx ?? 0), event.y - (event.dy ?? 0), event.x, event.y, 0.55);
    if (event.kind === 'fast_swipe') this.wipeTrail(event.x, event.y, Math.max(35, Math.hypot(event.dx ?? 0, event.dy ?? 0) * 0.35));
  }

  detectStagnation(dt: number): StagnationReport {
    const stats = this.stats();
    const stagnant = stats.antCount === 0 || stats.foodCount === 0 || stats.trailMax < 0.01 || stats.trailVariance < 0.000002;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return { stagnant: this.stagnantMs >= 1200, reason: stagnant ? 'colony lost food signals or pheromone variation' : undefined, severity: stagnant ? Math.min(1, this.stagnantMs / 3600) : 0, observedForMs: this.stagnantMs };
  }

  stabilize(): void {
    this.addFood(this.options.width * 0.22, this.options.height * 0.28, 1);
    this.addFood(this.options.width * 0.78, this.options.height * 0.72, 1);
    this.paintTrail(this.options.width * 0.5, this.options.height * 0.5, this.options.width * 0.22, this.options.height * 0.28, 0.9);
    for (const ant of this.ants.slice(0, Math.min(18, this.ants.length))) {
      const angle = this.rng.range(0, Math.PI * 2);
      ant.vx += Math.cos(angle) * 46;
      ant.vy += Math.sin(angle) * 46;
    }
    this.stagnantMs = 0;
  }

  stats(): AntSignalStats {
    const trail = this.pheromoneField.stats();
    const food = this.foodSignalField.stats();
    const nest = this.nestSignalField.stats();
    let total = 0;
    for (let i = 0; i < this.pheromoneField.values.length; i++) total += this.pheromoneField.values[i];
    return { antCount: this.ants.length, foodCount: this.foodSources.length, carryingCount: this.ants.filter((ant) => ant.carrying).length, trailMax: trail.max, trailTotal: total, trailVariance: trail.variance, foodSignalMax: food.max, nestSignalMax: nest.max };
  }

  snapshot(): Array<{ x: number; y: number; carrying: boolean; trailMax: number; foodCount: number }> {
    const trailMax = Number(this.pheromoneField.stats().max.toFixed(3));
    return this.ants.slice(0, 12).map((ant) => ({ x: Number(ant.x.toFixed(2)), y: Number(ant.y.toFixed(2)), carrying: ant.carrying, trailMax, foodCount: this.foodSources.length }));
  }

  renderParticles(): SimParticle[] {
    return this.ants.map((ant) => ({ position: { x: ant.x, y: ant.y }, velocity: { x: ant.vx, y: ant.vy }, size: ant.carrying ? 4.2 : 2.8, color: ant.carrying ? 0xfff08a : 0xffffff, alpha: ant.carrying ? 0.9 : 0.55 }));
  }

  drainForTest(): void {
    this.foodSources.length = 0;
    this.pheromoneField.fill(0);
    this.foodSignalField.fill(0);
    this.nestSignalField.fill(0);
    this.stagnantMs = 0;
  }

  private addFood(x: number, y: number, amount: number): void {
    const source = { x: Math.max(0, Math.min(this.options.width, x)), y: Math.max(0, Math.min(this.options.height, y)), amount };
    this.foodSources.push(source);
    this.injectFoodSignal(source.x, source.y, source.amount);
    while (this.foodSources.length > this.options.foodCount + 8) this.foodSources.shift();
  }

  private handleFoodPickupAndReturn(ant: AntAgent): void {
    if (!ant.carrying) {
      for (const food of this.foodSources) {
        if (Math.hypot(ant.x - food.x, ant.y - food.y) < 18 && food.amount > 0.04) {
          ant.carrying = true;
          food.amount -= 0.08;
          ant.vx *= -0.65;
          ant.vy *= -0.65;
          return;
        }
      }
    }
    if (ant.carrying && Math.hypot(ant.x - this.options.width * 0.5, ant.y - this.options.height * 0.5) < 26) {
      ant.carrying = false;
      ant.vx *= -0.7;
      ant.vy *= -0.7;
    }
  }

  private paintTrail(x0: number, y0: number, x1: number, y1: number, amount: number): void {
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      this.depositTrail(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, amount);
    }
  }

  private wipeTrail(x: number, y: number, radius: number): void {
    const cx = Math.round((x / Math.max(1, this.options.width)) * (this.options.columns - 1));
    const cy = Math.round((y / Math.max(1, this.options.height)) * (this.options.rows - 1));
    const gridRadius = Math.max(2, Math.round((radius / Math.max(1, this.options.width)) * this.options.columns));
    for (let oy = -gridRadius; oy <= gridRadius; oy++) for (let ox = -gridRadius; ox <= gridRadius; ox++) {
      if (Math.hypot(ox, oy) <= gridRadius) this.pheromoneField.set(cx + ox, cy + oy, this.pheromoneField.get(cx + ox, cy + oy) * 0.18);
    }
  }

  private depositTrail(x: number, y: number, amount: number): void {
    const gx = Math.round((x / Math.max(1, this.options.width)) * (this.options.columns - 1));
    const gy = Math.round((y / Math.max(1, this.options.height)) * (this.options.rows - 1));
    this.pheromoneField.set(gx, gy, Math.min(1, this.pheromoneField.get(gx, gy) + amount));
  }

  private injectFoodSignal(x: number, y: number, amount: number): void {
    this.injectSignal(this.foodSignalField, x, y, amount, 4);
  }

  private injectNestSignal(x: number, y: number, amount: number): void {
    this.injectSignal(this.nestSignalField, x, y, amount, 5);
  }

  private injectSignal(field: ScalarField, x: number, y: number, amount: number, radius: number): void {
    const gx = Math.round((x / Math.max(1, this.options.width)) * (this.options.columns - 1));
    const gy = Math.round((y / Math.max(1, this.options.height)) * (this.options.rows - 1));
    for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
      const distance = Math.hypot(ox, oy);
      if (distance <= radius) field.set(gx + ox, gy + oy, Math.min(1, field.get(gx + ox, gy + oy) + amount * (1 - distance / (radius + 0.1))));
    }
  }

  private keepInBounds(ant: AntAgent): void {
    if (ant.x < 0 || ant.x > this.options.width) ant.vx *= -0.9;
    if (ant.y < 0 || ant.y > this.options.height) ant.vy *= -0.9;
    ant.x = Math.max(0, Math.min(this.options.width, ant.x));
    ant.y = Math.max(0, Math.min(this.options.height, ant.y));
  }
}
