export type PegboardPhase = 'start' | 'play' | 'result';

export interface PegboardSettings {
  maxDrops: number;
  gravity: number;
  bounce: number;
}

export interface PegboardPeg {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: number;
}

export interface PegboardBin {
  id: string;
  x: number;
  width: number;
  value: number;
  score: number;
  label: string;
  color: number;
}

export interface PegboardBall {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  trail: readonly { x: number; y: number }[];
}

export interface PegboardCollectedBall extends PegboardBall {
  binId: string;
  scoreValue: number;
}

export interface PegboardResult {
  outcome: 'complete' | 'bust';
  finalScore: number;
  label: string;
}

export interface PegboardBoardBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface PegboardState {
  phase: PegboardPhase;
  width: number;
  height: number;
  board: PegboardBoardBounds;
  score: number;
  combo: number;
  dropsRemaining: number;
  settings: PegboardSettings;
  bucketHeight: number;
  pegs: readonly PegboardPeg[];
  bins: readonly PegboardBin[];
  activeBalls: readonly PegboardBall[];
  collectedBalls: readonly PegboardCollectedBall[];
  result: PegboardResult | null;
}

export type PegboardVisualEvent =
  | { kind: 'score'; ballId: string; binId: string; points: number; combo: number; x: number; y: number; color: number }
  | { kind: 'burst'; x: number; y: number; color: number; strength: number }
  | { kind: 'state'; phase: PegboardPhase };

export interface PegboardModelOptions {
  seed: number;
  width: number;
  height: number;
  maxDrops?: number;
  gravity?: number;
  bounce?: number;
}

interface MutableBall extends Omit<PegboardBall, 'trail'> {
  trail: { x: number; y: number }[];
}

const PEG_COLORS = [0x22d3ee, 0xa78bfa, 0xf472b6, 0xfbbf24, 0x34d399, 0x60a5fa];
const BIN_COLORS = [0x38bdf8, 0x818cf8, 0xc084fc, 0xf472b6, 0xf97316, 0xfacc15, 0x4ade80];
const BALL_COLORS = [0xff4d8d, 0x3ddcff, 0xc8ff3d, 0xff8a2a, 0xd8b4fe, 0xffffff];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cloneBall(ball: MutableBall): PegboardBall {
  return { ...ball, trail: ball.trail.map((point) => ({ ...point })) };
}

export class PegboardModel {
  private readonly rng: () => number;
  private readonly pegs: PegboardPeg[];
  private readonly bins: PegboardBin[];
  private settings: PegboardSettings;
  private readonly board: PegboardBoardBounds;
  private readonly bucketHeight: number;
  private readonly balls = new Map<string, MutableBall>();
  private readonly collectedBalls: PegboardCollectedBall[] = [];
  private readonly events: PegboardVisualEvent[] = [];
  private phase: PegboardPhase = 'start';
  private score = 0;
  private combo = 0;
  private dropsRemaining: number;
  private nextBall = 1;
  private result: PegboardResult | null = null;

  constructor(private readonly options: Required<PegboardModelOptions>) {
    this.rng = mulberry32(options.seed);
    this.settings = {
      maxDrops: options.maxDrops,
      gravity: options.gravity,
      bounce: options.bounce,
    };
    this.dropsRemaining = options.maxDrops;
    this.bucketHeight = this.createBucketHeight();
    this.board = this.createBoardBounds();
    this.pegs = this.createPegs();
    this.bins = this.createBins();
  }

  getState(): PegboardState {
    return {
      phase: this.phase,
      width: this.options.width,
      height: this.options.height,
      board: { ...this.board },
      score: this.score,
      combo: this.combo,
      dropsRemaining: this.dropsRemaining,
      settings: { ...this.settings },
      bucketHeight: this.bucketHeight,
      pegs: this.pegs.map((peg) => ({ ...peg })),
      bins: this.bins.map((bin) => ({ ...bin })),
      activeBalls: Array.from(this.balls.values(), cloneBall),
      collectedBalls: this.collectedBalls.map((ball) => ({ ...ball, trail: ball.trail.map((point) => ({ ...point })) })),
      result: this.result ? { ...this.result } : null,
    };
  }

  updateSettings(next: Partial<PegboardSettings>): void {
    const previousMaxDrops = this.settings.maxDrops;
    this.settings = {
      maxDrops: next.maxDrops ?? this.settings.maxDrops,
      gravity: next.gravity ?? this.settings.gravity,
      bounce: next.bounce ?? this.settings.bounce,
    };
    if (next.maxDrops !== undefined && this.phase === 'start' && this.balls.size === 0) {
      this.dropsRemaining = this.settings.maxDrops;
    } else if (next.maxDrops !== undefined && this.phase === 'play') {
      const usedDrops = Math.max(0, previousMaxDrops - this.dropsRemaining);
      this.dropsRemaining = Math.max(0, this.settings.maxDrops - usedDrops);
      this.maybeFinish();
    }
  }

  dropBall(normalizedX: number): PegboardBall {
    if (this.phase === 'result' || this.dropsRemaining <= 0) {
      throw new Error('No pegboard drops remaining');
    }
    const radius = Math.max(10, Math.min(18, this.options.width * 0.018));
    const x = clamp(normalizedX, 0, 1) * this.options.width;
    const ball: MutableBall = {
      id: `ball-${this.nextBall++}`,
      x: clamp(x, this.board.left + radius, this.board.right - radius),
      y: this.board.top + radius,
      vx: (this.rng() - 0.5) * 80,
      vy: 40 + this.rng() * 40,
      radius,
      color: BALL_COLORS[(this.nextBall + Math.floor(this.rng() * BALL_COLORS.length)) % BALL_COLORS.length],
      trail: [],
    };
    this.balls.set(ball.id, ball);
    this.dropsRemaining -= 1;
    this.setPhase('play');
    return cloneBall(ball);
  }

  step(dt: number): void {
    if (this.phase !== 'play') return;
    const seconds = clamp(dt, 0, 1 / 20);
    for (const ball of Array.from(this.balls.values())) {
      ball.vy += this.settings.gravity * seconds;
      ball.x += ball.vx * seconds;
      ball.y += ball.vy * seconds;
      ball.trail = [...ball.trail, { x: ball.x, y: ball.y }].slice(-12);
      this.collideWalls(ball);
      this.collidePegs(ball);
      this.collideBuckets(ball);
      const scoringBin = this.findContainingBin(ball);
      if (scoringBin) {
        this.resolveBall(ball.id, scoringBin.id);
      }
    }
    this.maybeFinish();
  }

  resolveBall(ballId: string, binId: string) {
    const ball = this.balls.get(ballId);
    if (!ball) {
      throw new Error(`Unknown ball ${ballId}`);
    }
    const binIndex = this.bins.findIndex((candidate) => candidate.id === binId);
    if (binIndex < 0) {
      throw new Error(`Unknown bin ${binId}`);
    }
    const bin = this.bins[binIndex];
    this.combo += 1;
    const points = bin.value * this.combo;
    this.score += points;
    this.bins[binIndex] = { ...bin, score: bin.score + points };
    this.balls.delete(ballId);
    const existingInBin = this.collectedBalls.filter((candidate) => candidate.binId === binId).length;
    const columns = Math.max(1, Math.floor(bin.width / (ball.radius * 2.3)));
    const column = existingInBin % columns;
    const row = Math.floor(existingInBin / columns);
    const spacingX = bin.width / columns;
    const collectedX = clamp(bin.x + spacingX * (column + 0.5), bin.x + ball.radius, bin.x + bin.width - ball.radius);
    const collectedY = clamp(this.board.bottom + this.bucketHeight - ball.radius - row * ball.radius * 1.65, this.board.bottom + ball.radius, this.board.bottom + this.bucketHeight - ball.radius);
    this.collectedBalls.push({
      ...cloneBall(ball),
      x: collectedX,
      y: collectedY,
      vx: 0,
      vy: 0,
      trail: [],
      binId,
      scoreValue: points,
    });
    this.events.push({ kind: 'score', ballId, binId, points, combo: this.combo, x: collectedX, y: collectedY, color: bin.color });
    this.events.push({ kind: 'burst', x: collectedX, y: collectedY, color: ball.color, strength: Math.max(1, bin.value / 25) });
    this.maybeFinish();
    return { points, totalScore: this.score, combo: this.combo };
  }

  restart(): void {
    this.balls.clear();
    this.collectedBalls.splice(0, this.collectedBalls.length);
    for (let i = 0; i < this.bins.length; i += 1) {
      this.bins[i] = { ...this.bins[i], score: 0 };
    }
    this.score = 0;
    this.combo = 0;
    this.dropsRemaining = this.settings.maxDrops;
    this.result = null;
    this.nextBall = 1;
    this.setPhase('start');
  }

  drainEvents(): PegboardVisualEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private setPhase(phase: PegboardPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.events.push({ kind: 'state', phase });
  }

  private maybeFinish(): void {
    if (this.dropsRemaining > 0 || this.balls.size > 0 || this.phase !== 'play') return;
    this.result = {
      outcome: this.score > 0 ? 'complete' : 'bust',
      finalScore: this.score,
      label: this.score >= 500 ? 'Jackpot Cascade' : this.score >= 250 ? 'Neon Sweep' : this.score > 0 ? 'Clean Drop' : 'Try Again',
    };
    this.setPhase('result');
  }

  private createBoardBounds(): PegboardBoardBounds {
    const horizontalMargin = clamp(this.options.width * 0.06, 28, 88);
    const top = clamp(this.options.height * 0.08, 48, 92);
    const bottomMargin = clamp(this.options.height * 0.055, 28, 56);
    const bottom = this.options.height - bottomMargin - this.bucketHeight;
    const left = horizontalMargin;
    const right = this.options.width - horizontalMargin;
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  private createBucketHeight(): number {
    return clamp(this.options.height * 0.2, 116, 190);
  }

  private createPegs(): PegboardPeg[] {
    const pegs: PegboardPeg[] = [];
    const rows = clamp(Math.floor(this.board.height / 38), 7, 14);
    const columns = clamp(Math.floor(this.board.width / 68), 8, 18);
    const top = this.board.top + this.board.height * 0.2;
    const bottom = this.board.top + this.board.height * 0.93;
    const rowGap = rows <= 1 ? 0 : (bottom - top) / (rows - 1);
    const radius = clamp(Math.min(this.board.width / columns, rowGap || 48) * 0.13, 5, 10);
    const usableWidth = this.board.width * 0.92;
    const center = (this.board.left + this.board.right) / 2;
    const spacing = columns <= 1 ? usableWidth : usableWidth / (columns - 1);
    for (let row = 0; row < rows; row += 1) {
      const rowShift = row % 2 === 0 ? -spacing * 0.25 : spacing * 0.25;
      const rowLeft = center - ((columns - 1) * spacing) / 2 + rowShift;
      for (let col = 0; col < columns; col += 1) {
        pegs.push({
          id: `peg-${row}-${col}`,
          x: clamp(rowLeft + col * spacing, this.board.left + radius, this.board.right - radius),
          y: top + row * rowGap,
          radius,
          color: PEG_COLORS[(row + col) % PEG_COLORS.length],
        });
      }
    }
    return pegs;
  }

  private createBins(): PegboardBin[] {
    const values = [0, 25, 10, 50, 25, 100, 25, 50, 10, 25, 0];
    const width = this.board.width / values.length;
    return values.map((value, index) => ({
      id: `bin-${index}`,
      x: this.board.left + width * index,
      width,
      value,
      score: 0,
      label: value === 0 ? 'Nothing' : `${value}`,
      color: value === 0 ? 0x64748b : BIN_COLORS[index % BIN_COLORS.length],
    }));
  }

  private findBin(x: number): PegboardBin {
    return this.bins.find((bin) => x >= bin.x && x < bin.x + bin.width) ?? this.bins[this.bins.length - 1];
  }

  private findContainingBin(ball: MutableBall): PegboardBin | null {
    const bucketTop = this.board.bottom;
    const bucketBottom = bucketTop + this.bucketHeight;
    return this.bins.find((bin) => (
      ball.x - ball.radius >= bin.x
      && ball.x + ball.radius <= bin.x + bin.width
      && ball.y - ball.radius >= bucketTop + Math.min(8, ball.radius * 0.4)
      && ball.y + ball.radius <= bucketBottom
    )) ?? null;
  }

  private collideWalls(ball: MutableBall): void {
    if (ball.x < this.board.left + ball.radius) {
      ball.x = this.board.left + ball.radius;
      ball.vx = Math.abs(ball.vx) * this.settings.bounce;
    }
    if (ball.x > this.board.right - ball.radius) {
      ball.x = this.board.right - ball.radius;
      ball.vx = -Math.abs(ball.vx) * this.settings.bounce;
    }
  }

  private collideBuckets(ball: MutableBall): void {
    const bucketTop = this.board.bottom;
    const bucketBottom = bucketTop + this.bucketHeight;
    if (ball.y + ball.radius < bucketTop || ball.y - ball.radius > bucketBottom) return;

    const bin = this.findBin(ball.x);
    const wallBounce = Math.max(0.18, this.settings.bounce * 0.42);
    if (ball.x - ball.radius < bin.x) {
      ball.x = bin.x + ball.radius;
      ball.vx = Math.abs(ball.vx) * wallBounce;
    }
    if (ball.x + ball.radius > bin.x + bin.width) {
      ball.x = bin.x + bin.width - ball.radius;
      ball.vx = -Math.abs(ball.vx) * wallBounce;
    }
    if (ball.y + ball.radius > bucketBottom) {
      ball.y = bucketBottom - ball.radius;
      ball.vy = -Math.abs(ball.vy) * wallBounce;
      ball.vx *= 0.72;
    }
  }

  private collidePegs(ball: MutableBall): void {
    for (const peg of this.pegs) {
      const dx = ball.x - peg.x;
      const dy = ball.y - peg.y;
      const min = ball.radius + peg.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 0 || distSq > min * min) continue;
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const speed = Math.max(110, Math.hypot(ball.vx, ball.vy));
      const incomingDot = ball.vx * nx + ball.vy * ny;
      let reflectedVx = ball.vx;
      let reflectedVy = ball.vy;
      if (incomingDot < 0) {
        reflectedVx = ball.vx - 2 * incomingDot * nx;
        reflectedVy = ball.vy - 2 * incomingDot * ny;
      }
      ball.x = peg.x + nx * min;
      ball.y = peg.y + ny * min;
      ball.vx = reflectedVx * this.settings.bounce + (this.rng() - 0.5) * 38;
      ball.vy = clamp(reflectedVy * this.settings.bounce + 24, -speed * 0.45, speed * 1.25);
      this.events.push({ kind: 'burst', x: peg.x, y: peg.y, color: peg.color, strength: 0.5 });
      break;
    }
  }
}

export function createPegboardModel(options: PegboardModelOptions): PegboardModel {
  return new PegboardModel({
    seed: options.seed,
    width: options.width,
    height: options.height,
    maxDrops: options.maxDrops ?? 30,
    gravity: options.gravity ?? 720,
    bounce: options.bounce ?? 0.86,
  });
}
