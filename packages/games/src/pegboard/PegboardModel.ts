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
  multiplier: number;
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
  pegs: readonly PegboardPeg[];
  bins: readonly PegboardBin[];
  activeBalls: readonly PegboardBall[];
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
  private readonly settings: PegboardSettings;
  private readonly board: PegboardBoardBounds;
  private readonly balls = new Map<string, MutableBall>();
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
      pegs: this.pegs.map((peg) => ({ ...peg })),
      bins: this.bins.map((bin) => ({ ...bin })),
      activeBalls: Array.from(this.balls.values(), cloneBall),
      result: this.result ? { ...this.result } : null,
    };
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
      if (ball.y >= this.board.bottom) {
        const bin = this.findBin(ball.x);
        this.resolveBall(ball.id, bin.id);
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
    const points = bin.multiplier * 10 * this.combo;
    this.score += points;
    this.bins[binIndex] = { ...bin, score: bin.score + points };
    this.balls.delete(ballId);
    this.events.push({ kind: 'score', ballId, binId, points, combo: this.combo, x: ball.x, y: ball.y, color: bin.color });
    this.events.push({ kind: 'burst', x: ball.x, y: ball.y, color: ball.color, strength: bin.multiplier });
    this.maybeFinish();
    return { points, totalScore: this.score, combo: this.combo };
  }

  restart(): void {
    this.balls.clear();
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
    const top = clamp(this.options.height * 0.12, 72, 128);
    const bottom = this.options.height - clamp(this.options.height * 0.08, 44, 82);
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

  private createPegs(): PegboardPeg[] {
    const pegs: PegboardPeg[] = [];
    const rows = clamp(Math.floor(this.board.height / 48), 7, 14);
    const columns = clamp(Math.floor(this.board.width / 68), 8, 18);
    const top = this.board.top + this.board.height * 0.12;
    const bottom = this.board.top + this.board.height * 0.68;
    const rowGap = rows <= 1 ? 0 : (bottom - top) / (rows - 1);
    const radius = clamp(Math.min(this.board.width / columns, rowGap || 48) * 0.13, 5, 10);
    const usableWidth = this.board.width * 0.84;
    const center = (this.board.left + this.board.right) / 2;
    const spacing = usableWidth / columns;
    for (let row = 0; row < rows; row += 1) {
      const rowShift = row % 2 === 0 ? -spacing * 0.25 : spacing * 0.25;
      const rowLeft = center - ((columns - 1) * spacing) / 2 + rowShift;
      for (let col = 0; col < columns; col += 1) {
        pegs.push({
          id: `peg-${row}-${col}`,
          x: rowLeft + col * spacing,
          y: top + row * rowGap,
          radius,
          color: PEG_COLORS[(row + col) % PEG_COLORS.length],
        });
      }
    }
    return pegs;
  }

  private createBins(): PegboardBin[] {
    const multipliers = [1, 2, 4, 8, 4, 2, 1];
    const width = this.board.width / multipliers.length;
    return multipliers.map((multiplier, index) => ({
      id: `bin-${index}`,
      x: this.board.left + width * index,
      width,
      multiplier,
      score: 0,
      label: `${multiplier}×`,
      color: BIN_COLORS[index % BIN_COLORS.length],
    }));
  }

  private findBin(x: number): PegboardBin {
    return this.bins.find((bin) => x >= bin.x && x < bin.x + bin.width) ?? this.bins[this.bins.length - 1];
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
      const speed = Math.max(90, Math.hypot(ball.vx, ball.vy) * this.settings.bounce);
      ball.x = peg.x + nx * min;
      ball.y = peg.y + ny * min;
      ball.vx = nx * speed + (this.rng() - 0.5) * 65;
      ball.vy = Math.abs(ny * speed) + 35;
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
    maxDrops: options.maxDrops ?? 12,
    gravity: options.gravity ?? 720,
    bounce: options.bounce ?? 0.86,
  });
}
