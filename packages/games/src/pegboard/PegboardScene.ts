import { Container, Graphics, Text } from 'pixi.js';
import { Scene, type GameContext, type Input, type RenderQuality } from '@hooksjam/pixi-lab-core';
import { PEGBOARD_DEFAULTS } from './pegboard.config';
import { createPegboardModel, type PegboardModel, type PegboardState, type PegboardVisualEvent } from './PegboardModel';

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

export class PegboardScene extends Scene {
  readonly name: string = 'PegboardPachinko';
  private root = new Container();
  private boardLayer = new Graphics();
  private glowLayer = new Graphics();
  private trailLayer = new Graphics();
  private ballLayer = new Graphics();
  private overlayLayer = new Graphics();
  private titleText = new Text({ text: '', style: { fill: 0xffffff, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 34, fontWeight: '800', align: 'center' } });
  private subtitleText = new Text({ text: '', style: { fill: 0xa5b4fc, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 17, align: 'center' } });
  private scoreText = new Text({ text: '', style: { fill: 0xffffff, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, fontWeight: '700' } });
  private stateText = new Text({ text: '', style: { fill: 0xfde68a, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: '700', align: 'right' } });
  private model: PegboardModel | null = null;
  private state: PegboardState | null = null;
  private floatingTexts: FloatingText[] = [];
  private sparks: Spark[] = [];
  private dirty = true;
  private quality: RenderQuality = 'basic';

  constructor(private readonly preview = false) {
    super();
  }

  onEnter(ctx: GameContext, input: Input): void {
    this.ctx = ctx;
    this.input = input;
    this.quality = ctx.quality;
    ctx.systems.pixi.stage.addChild(this.root);
    this.root.addChild(this.glowLayer, this.boardLayer, this.trailLayer, this.ballLayer, this.overlayLayer, this.titleText, this.subtitleText, this.scoreText, this.stateText);
    this.configureText(ctx.width, ctx.height);
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
    this.configureText(width, height);
    this.createModel(width, height);
  }

  override reset(): void {
    this.model?.restart();
    this.handleEvents();
    this.refreshState();
  }

  override setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.dirty = true;
  }

  override fixedUpdate(dt: number): void {
    if (!this.model || !this.state) return;
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
    this.model.step(dt);
    this.handleEvents();
    this.refreshState();
  }

  override update(dt: number): void {
    const sparkle = Number(this.ctx.systems.settings.get('sparkleIntensity') ?? PEGBOARD_DEFAULTS.sparkleIntensity);
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
    if (this.sparks.length > 0 || this.floatingTexts.length > 0 || sparkle !== 0) {
      this.dirty = true;
    }
  }

  override render(): void {
    if (!this.state || !this.dirty) return;
    this.drawBoard(this.state);
    this.drawBalls(this.state);
    this.drawOverlay(this.state);
    this.dirty = false;
  }

  override shouldRender(): boolean {
    return this.dirty || this.sparks.length > 0 || this.floatingTexts.length > 0 || Boolean(this.state?.activeBalls.length);
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

  private createModel(width: number, height: number): void {
    const settings = this.ctx.systems.settings;
    const maxDrops = this.preview ? 5 : Number(settings.get('maxDrops') ?? PEGBOARD_DEFAULTS.maxDrops);
    const gravity = Number(settings.get('gravity') ?? PEGBOARD_DEFAULTS.gravity);
    const bounce = Number(settings.get('bounce') ?? PEGBOARD_DEFAULTS.bounce);
    this.model = createPegboardModel({ seed: this.ctx.seed, width, height, maxDrops, gravity, bounce });
    if (this.preview) {
      this.model.dropBall(0.5);
      this.model.dropBall(0.33);
      this.model.dropBall(0.67);
    }
    this.handleEvents();
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
      const text = new Text({ text: `+${event.points}`, style: { fill: event.color, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 24, fontWeight: '900', stroke: { color: 0x020617, width: 4 } } });
      text.anchor.set(0.5);
      text.position.set(event.x, event.y - 18);
      this.root.addChild(text);
      this.floatingTexts.push({ text, life: 1.1, vy: -42 });
      this.ctx.emit({ kind: 'score_update', value: event.points, payload: { binId: event.binId, combo: event.combo } });
    }
    if (event.kind === 'burst') {
      const count = Math.round((this.preview ? 4 : 10) * Number(this.ctx.systems.settings.get('sparkleIntensity') ?? PEGBOARD_DEFAULTS.sparkleIntensity));
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / Math.max(1, count);
        const speed = 55 + event.strength * 35 + (i % 3) * 18;
        this.sparks.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 25, color: event.color, life: 0.55 + event.strength * 0.12, maxLife: 0.7 + event.strength * 0.12 });
      }
    }
    this.dirty = true;
  }

  private configureText(width: number, height: number): void {
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(width / 2, height * 0.1);
    this.subtitleText.anchor.set(0.5);
    this.subtitleText.position.set(width / 2, height * 0.145);
    this.scoreText.position.set(24, 20);
    this.stateText.anchor.set(1, 0);
    this.stateText.position.set(width - 24, 22);
  }

  private drawBoard(state: PegboardState): void {
    const { width, height } = state;
    this.boardLayer.clear();
    this.glowLayer.clear();
    this.boardLayer.rect(0, 0, width, height);
    this.boardLayer.fill({ color: 0x050816 });
    for (let i = 0; i < 18; i += 1) {
      const alpha = 0.04 + (i % 3) * 0.012;
      this.glowLayer.circle(width * ((i * 73) % 100) / 100, height * ((i * 41) % 100) / 100, 80 + (i % 5) * 30);
      this.glowLayer.fill({ color: [0x22d3ee, 0xa78bfa, 0xf472b6][i % 3], alpha });
    }
    this.boardLayer.roundRect(width * 0.06, height * 0.16, width * 0.88, height * 0.72, 28);
    this.boardLayer.stroke({ color: 0x334155, width: 4, alpha: 0.8 });
    this.boardLayer.fill({ color: 0x0f172a, alpha: 0.35 });
    for (const peg of state.pegs) {
      this.boardLayer.circle(peg.x, peg.y, peg.radius + 5);
      this.boardLayer.fill({ color: peg.color, alpha: 0.16 });
      this.boardLayer.circle(peg.x, peg.y, peg.radius);
      this.boardLayer.fill({ color: peg.color, alpha: 0.95 });
    }
    for (const bin of state.bins) {
      const y = height * 0.84;
      this.boardLayer.roundRect(bin.x + 3, y, bin.width - 6, height * 0.1, 12);
      this.boardLayer.fill({ color: bin.color, alpha: 0.2 });
      this.boardLayer.stroke({ color: bin.color, width: 2, alpha: 0.75 });
      this.boardLayer.rect(bin.x + 3, y + height * 0.075, bin.width - 6, height * 0.025);
      this.boardLayer.fill({ color: bin.color, alpha: 0.36 });
    }
  }

  private drawBalls(state: PegboardState): void {
    this.trailLayer.clear();
    this.ballLayer.clear();
    for (const ball of state.activeBalls) {
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
    this.titleText.text = state.phase === 'result' ? (state.result?.label ?? 'Round Complete') : 'Pegboard Pachinko';
    this.subtitleText.text = state.phase === 'start'
      ? 'Tap the glowing drop zone to start. Chase the 8× jackpot bin.'
      : state.phase === 'play'
        ? 'Drop balls, stack combos, and light up the bins.'
        : 'Result locked. Use Reset to restart the board.';
    this.scoreText.text = `Score ${state.score}  ·  Combo ${state.combo}×`;
    this.stateText.text = state.phase === 'start' ? 'START' : state.phase === 'play' ? `${state.dropsRemaining} DROPS LEFT` : 'RESULT · RESET TO RESTART';
    if (state.phase === 'start') {
      this.overlayLayer.roundRect(state.width * 0.35, state.height * 0.055, state.width * 0.3, state.height * 0.05, 18);
      this.overlayLayer.stroke({ color: 0x22d3ee, width: 2, alpha: 0.75 });
      this.overlayLayer.fill({ color: 0x0ea5e9, alpha: 0.08 });
    }
    if (state.phase === 'result') {
      this.overlayLayer.roundRect(state.width * 0.24, state.height * 0.28, state.width * 0.52, state.height * 0.21, 26);
      this.overlayLayer.fill({ color: 0x020617, alpha: 0.72 });
      this.overlayLayer.stroke({ color: 0xf472b6, width: 3, alpha: 0.8 });
    }
  }
}
