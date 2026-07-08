import { Container, Graphics, Text } from 'pixi.js';
import { Scene, type GameContext, type Input, type RenderQuality } from '@hooksjam/pixi-lab-core';
import { PEGBOARD_DEFAULTS } from './pegboard.config';
import { createPegboardModel, type PegboardModel, type PegboardSettings, type PegboardState, type PegboardVisualEvent } from './PegboardModel';

interface FloatingText {
  text: Text;
  life: number;
  vy: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  life: number;
  maxLife: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class PegboardScene extends Scene {
  readonly name: string = 'PegboardPachinko';
  private root = new Container();
  private boardLayer = new Graphics();
  private glowLayer = new Graphics();
  private trailLayer = new Graphics();
  private ballLayer = new Graphics();
  private overlayLayer = new Graphics();
  private bucketLabelLayer = new Container();
  private model: PegboardModel | null = null;
  private state: PegboardState | null = null;
  private floatingTexts: FloatingText[] = [];
  private sparks: Spark[] = [];
  private dirty = true;
  private boardDirty = true;
  private quality: RenderQuality = 'basic';
  private previewElapsed = 0;
  private previewDropElapsed = 0;
  private previewDropIndex = 0;
  private appliedSettings: PegboardSettings = { maxDrops: PEGBOARD_DEFAULTS.maxDrops, gravity: PEGBOARD_DEFAULTS.gravity, bounce: PEGBOARD_DEFAULTS.bounce };

  constructor(private readonly preview = false) {
    super();
  }

  onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;
    this.quality = ctx.quality;
    ctx.systems.pixi.stage.addChild(this.root);
    this.root.addChild(this.glowLayer, this.boardLayer, this.trailLayer, this.ballLayer, this.overlayLayer, this.bucketLabelLayer);
    this.createModel(ctx.width, ctx.height);
  }

  onExit(): void {
    this.root.removeFromParent();
    this.root.destroy({ children: true });
    this.floatingTexts = [];
    this.sparks = [];
    this.model = null;
    this.state = null;
  }

  override resize(width: number, height: number): void {
    this.createModel(width, height);
  }

  override reset(): void {
    this.model?.restart();
    this.previewDropElapsed = 0;
    this.previewDropIndex = 0;
    if (this.preview) this.seedPreviewDrops();
    this.previewElapsed = 0;
    this.handleEvents();
    this.refreshState();
  }

  override setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.boardDirty = true;
    this.dirty = true;
  }

  override fixedUpdate(dt: number): void {
    if (!this.model || !this.state) return;
    if (this.preview) {
      this.previewElapsed += dt;
      this.previewDropElapsed += dt;
      if (this.previewElapsed >= 8) {
        this.reset();
        return;
      }
      this.dropPreviewBalls();
    }
    this.applyLiveSettings();
    for (const id of this.input.snapshot.justDown) {
      const pointer = this.input.snapshot.pointers.get(id);
      if (pointer) {
        this.dropAt(pointer.x);
      }
    }
    for (const pointer of this.input.snapshot.pointers.values()) {
      if (pointer.type === 'move' && this.state.phase === 'start') {
        this.dropAt(pointer.x);
        break;
      }
    }
    const nextState = this.model.getState();
    const hasActiveMotion = nextState.activeBalls.length > 0 || this.sparks.length > 0 || this.floatingTexts.length > 0;
    if (!hasActiveMotion) {
      this.state = nextState;
      return;
    }
    this.model.step(dt);
    this.handleEvents();
    this.refreshState();
  }

  override update(dt: number): void {
    const hadEffects = this.sparks.length > 0 || this.floatingTexts.length > 0;
    for (const spark of this.sparks) {
      spark.life -= dt;
      spark.vy += 180 * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
    }
    this.sparks = this.sparks.filter((spark) => spark.life > 0).slice(-(this.preview ? 60 : 180));
    for (const floating of this.floatingTexts) {
      floating.life -= dt;
      floating.text.y += floating.vy * dt;
      floating.text.alpha = Math.max(0, floating.life / 1.1);
    }
    for (const floating of this.floatingTexts.filter((entry) => entry.life <= 0)) {
      floating.text.removeFromParent();
      floating.text.destroy();
    }
    this.floatingTexts = this.floatingTexts.filter((entry) => entry.life > 0);
    if (hadEffects || this.sparks.length > 0 || this.floatingTexts.length > 0) {
      this.dirty = true;
    }
  }

  override render(): void {
    if (!this.state || (!this.dirty && !this.boardDirty)) return;
    if (this.boardDirty) {
      this.drawBoard(this.state);
      this.boardDirty = false;
    }
    if (this.dirty) {
      this.drawBalls(this.state);
      this.drawOverlay(this.state);
      this.dirty = false;
    }
  }

  override shouldRender(): boolean {
    return this.boardDirty || this.dirty || this.sparks.length > 0 || this.floatingTexts.length > 0 || Boolean(this.state?.activeBalls.length);
  }

  override getDebugStats(): Record<string, string | number | boolean | null> | null {
    if (!this.state) return null;
    return {
      gameState: this.state.phase,
      score: this.state.score,
      dropsRemaining: this.state.dropsRemaining,
      activeBalls: this.state.activeBalls.length,
      quality: this.quality,
    };
  }

  private readRuleSettings() {
    const settings = this.ctx.systems.settings;
    return {
      maxDrops: this.preview ? 32 : Number(settings.get('maxDrops') ?? PEGBOARD_DEFAULTS.maxDrops),
      gravity: this.preview ? 390 : Number(settings.get('gravity') ?? PEGBOARD_DEFAULTS.gravity),
      bounce: this.preview ? 0.48 : Number(settings.get('bounce') ?? PEGBOARD_DEFAULTS.bounce),
    };
  }

  private createModel(width: number, height: number): void {
    this.appliedSettings = this.readRuleSettings();
    this.model = createPegboardModel({ seed: this.ctx.seed, width, height, preview: this.preview, ...this.appliedSettings });
    this.previewElapsed = 0;
    this.previewDropElapsed = 0;
    this.previewDropIndex = 0;
    this.boardDirty = true;
    if (this.preview) this.seedPreviewDrops();
    this.handleEvents();
    this.refreshState();
  }

  private seedPreviewDrops(): void {
    this.dropPreviewBall();
  }

  private dropPreviewBalls(): void {
    const state = this.model?.getState();
    if (!state || state.phase === 'result') return;
    const cadenceSeconds = 0.78;
    const maxActiveBalls = 3;
    while (this.previewDropElapsed >= cadenceSeconds && state.dropsRemaining > 0 && state.activeBalls.length < maxActiveBalls) {
      this.previewDropElapsed -= cadenceSeconds;
      this.dropPreviewBall();
      const next = this.model?.getState();
      if (!next || next.activeBalls.length >= maxActiveBalls || next.dropsRemaining <= 0) break;
    }
  }

  private dropPreviewBall(): void {
    if (!this.model) return;
    const lanes = [0.5, 0.36, 0.64, 0.44, 0.56, 0.28, 0.72];
    try {
      this.model.dropBall(lanes[this.previewDropIndex % lanes.length]);
      this.previewDropIndex += 1;
    } catch {
      // Preview resets periodically, so exhausting the round just idles briefly.
    }
  }

  private applyLiveSettings(): void {
    if (!this.model) return;
    const next = this.readRuleSettings();
    if (
      next.maxDrops === this.appliedSettings.maxDrops
      && next.gravity === this.appliedSettings.gravity
      && next.bounce === this.appliedSettings.bounce
    ) return;
    this.model.updateSettings(next);
    this.appliedSettings = next;
    this.refreshState();
  }

  private refreshState(): void {
    this.state = this.model?.getState() ?? null;
    if (this.state) {
      this.ctx.emit({ kind: 'score_update', value: this.state.score, payload: { combo: this.state.combo, dropsRemaining: this.state.dropsRemaining, phase: this.state.phase } });
      if (this.state.phase === 'result') {
        this.ctx.emit({ kind: 'game_over', value: this.state.score, payload: { outcome: this.state.result?.outcome ?? 'complete', label: this.state.result?.label ?? 'Round Complete' } });
      }
    }
    this.dirty = true;
  }

  private dropAt(x: number): void {
    if (!this.model || !this.state || this.state.phase === 'result' || this.state.dropsRemaining <= 0) return;
    this.model.dropBall(x / Math.max(1, this.state.width));
    this.handleEvents();
  }

  private handleEvents(): void {
    const events = this.model?.drainEvents() ?? [];
    for (const event of events) {
      this.applyVisualEvent(event);
    }
  }

  private applyVisualEvent(event: PegboardVisualEvent): void {
    if (event.kind === 'score') {
      if (this.preview) {
        this.ctx.emit({ kind: 'score_update', value: this.state?.score, payload: { binId: event.binId, bucketValue: event.points, scoreDelta: event.scoreDelta, combo: event.combo } });
        this.dirty = true;
        return;
      }
      const text = new Text({ text: `+${event.points}`, style: { fill: event.color, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 24, fontWeight: '900', stroke: { color: 0x020617, width: 4 } } });
      text.anchor.set(0.5);
      text.position.set(event.x, event.y - 18);
      this.root.addChild(text);
      this.floatingTexts.push({ text, life: 1.1, vy: -42 });
      this.ctx.emit({ kind: 'score_update', value: this.state?.score, payload: { binId: event.binId, bucketValue: event.points, scoreDelta: event.scoreDelta, combo: event.combo } });
    }
    if (event.kind === 'burst') {
      if (this.preview) {
        this.dirty = true;
        return;
      }
      const count = Math.round((this.preview ? 4 : 10) * Number(this.ctx.systems.settings.get('sparkleIntensity') ?? PEGBOARD_DEFAULTS.sparkleIntensity));
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / Math.max(1, count);
        const speed = 55 + event.strength * 35 + (i % 3) * 18;
        this.sparks.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 25, color: event.color, life: 0.55 + event.strength * 0.12, maxLife: 0.7 + event.strength * 0.12 });
      }
    }
    this.dirty = true;
  }

  private drawBoard(state: PegboardState): void {
    const { width, height, board } = state;
    this.boardLayer.clear();
    this.glowLayer.clear();
    this.bucketLabelLayer.removeChildren().forEach((child) => child.destroy());
    this.boardLayer.rect(0, 0, width, height);
    this.boardLayer.fill({ color: 0x050816 });
    for (let i = 0; i < 18; i += 1) {
      const alpha = 0.04 + (i % 3) * 0.012;
      this.glowLayer.circle(width * ((i * 73) % 100) / 100, height * ((i * 41) % 100) / 100, 80 + (i % 5) * 30);
      this.glowLayer.fill({ color: [0x22d3ee, 0xa78bfa, 0xf472b6][i % 3], alpha });
    }
    const arenaRadius = this.preview ? 0 : 28;
    this.boardLayer.moveTo(board.left, board.bottom);
    this.boardLayer.lineTo(board.left, board.top + arenaRadius);
    this.boardLayer.quadraticCurveTo(board.left, board.top, board.left + arenaRadius, board.top);
    this.boardLayer.lineTo(board.right - arenaRadius, board.top);
    this.boardLayer.quadraticCurveTo(board.right, board.top, board.right, board.top + arenaRadius);
    this.boardLayer.lineTo(board.right, board.bottom);
    this.boardLayer.lineTo(board.left, board.bottom);
    this.boardLayer.fill({ color: 0x0f172a, alpha: 0.35 });
    this.boardLayer.moveTo(board.left, board.bottom);
    this.boardLayer.lineTo(board.left, board.top + arenaRadius);
    this.boardLayer.quadraticCurveTo(board.left, board.top, board.left + arenaRadius, board.top);
    this.boardLayer.lineTo(board.right - arenaRadius, board.top);
    this.boardLayer.quadraticCurveTo(board.right, board.top, board.right, board.top + arenaRadius);
    this.boardLayer.lineTo(board.right, board.bottom);
    this.boardLayer.stroke({ color: 0x334155, width: 4, alpha: 0.8 });
    for (const peg of state.pegs) {
      this.boardLayer.circle(peg.x, peg.y, peg.radius + 5);
      this.boardLayer.fill({ color: peg.color, alpha: 0.16 });
      this.boardLayer.circle(peg.x, peg.y, peg.radius);
      this.boardLayer.fill({ color: peg.color, alpha: 0.95 });
    }
    for (const bin of state.bins) {
      const y = state.board.bottom;
      const bucketHeight = state.bucketHeight;
      const bucketX = bin.x;
      const bucketWidth = bin.width;
      const isEdgeBucket = bin === state.bins[0] || bin === state.bins[state.bins.length - 1];
      this.boardLayer.rect(bucketX, y, bucketWidth, bucketHeight);
      this.boardLayer.fill({ color: bin.color, alpha: 0.18 });
      if (!this.preview && bin !== state.bins[0]) {
        this.boardLayer.moveTo(bucketX, y + 3);
        this.boardLayer.lineTo(bucketX, y + bucketHeight - 3);
        this.boardLayer.stroke({ color: 0xffffff, width: 1.5, alpha: 0.22 });
      }
      const outerRadius = isEdgeBucket ? Math.min(18, bucketWidth * 0.28, bucketHeight * 0.22) : 0;
      if (bin === state.bins[0]) {
        this.boardLayer.moveTo(bucketX, y);
        this.boardLayer.lineTo(bucketX, y + bucketHeight - outerRadius);
        this.boardLayer.quadraticCurveTo(bucketX, y + bucketHeight, bucketX + outerRadius, y + bucketHeight);
        this.boardLayer.lineTo(bucketX + bucketWidth, y + bucketHeight);
        this.boardLayer.lineTo(bucketX + bucketWidth, y);
      } else if (bin === state.bins[state.bins.length - 1]) {
        this.boardLayer.moveTo(bucketX, y);
        this.boardLayer.lineTo(bucketX, y + bucketHeight);
        this.boardLayer.lineTo(bucketX + bucketWidth - outerRadius, y + bucketHeight);
        this.boardLayer.quadraticCurveTo(bucketX + bucketWidth, y + bucketHeight, bucketX + bucketWidth, y + bucketHeight - outerRadius);
        this.boardLayer.lineTo(bucketX + bucketWidth, y);
      } else {
        this.boardLayer.moveTo(bucketX, y);
        this.boardLayer.lineTo(bucketX, y + bucketHeight);
        this.boardLayer.lineTo(bucketX + bucketWidth, y + bucketHeight);
        this.boardLayer.lineTo(bucketX + bucketWidth, y);
      }
      this.boardLayer.stroke({ color: bin.color, width: 3, alpha: 0.78 });
      if (this.preview) continue;
      const label = new Text({
        text: bin.label,
        style: {
          fill: 0xffffff,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: clamp(bin.width * 0.18, 16, 28),
          fontWeight: '900',
          stroke: { color: 0x020617, width: 4 },
        },
      });
      label.anchor.set(0.5);
      label.position.set(bin.x + bin.width / 2, y + Math.max(34, bucketHeight * 0.4));
      this.bucketLabelLayer.addChild(label);
    }
  }

  private drawBalls(state: PegboardState): void {
    this.trailLayer.clear();
    this.ballLayer.clear();
    const visibleBalls = [...state.collectedBalls, ...state.activeBalls];
    for (const ball of visibleBalls) {
      for (let i = 1; i < ball.trail.length; i += 1) {
        const from = ball.trail[i - 1];
        const to = ball.trail[i];
        this.trailLayer.moveTo(from.x, from.y);
        this.trailLayer.lineTo(to.x, to.y);
        this.trailLayer.stroke({ color: ball.color, width: Math.max(1, ball.radius * 0.3), alpha: i / ball.trail.length * 0.25 });
      }
      this.ballLayer.circle(ball.x, ball.y, ball.radius + 8);
      this.ballLayer.fill({ color: ball.color, alpha: 0.18 });
      this.ballLayer.circle(ball.x, ball.y, ball.radius);
      this.ballLayer.fill({ color: ball.color, alpha: 1 });
      this.ballLayer.circle(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.35, ball.radius * 0.28);
      this.ballLayer.fill({ color: 0xffffff, alpha: 0.55 });
    }
    for (const spark of this.sparks) {
      const alpha = Math.max(0, spark.life / spark.maxLife);
      this.ballLayer.circle(spark.x, spark.y, 2 + alpha * 3);
      this.ballLayer.fill({ color: spark.color, alpha });
    }
  }

  private drawOverlay(state: PegboardState): void {
    this.overlayLayer.clear();
    if (state.phase === 'result') {
      this.overlayLayer.roundRect(state.board.left + state.board.width * 0.18, state.board.top + state.board.height * 0.28, state.board.width * 0.64, state.board.height * 0.22, 24);
      this.overlayLayer.fill({ color: 0x020617, alpha: 0.58 });
      this.overlayLayer.stroke({ color: 0xf472b6, width: 3, alpha: 0.8 });
    }
  }
}
