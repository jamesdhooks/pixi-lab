import type { GestureEvent, SettingsField, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

interface SystemsFieldDemoAIOptions {
  readonly fields: readonly SettingsField[];
  readonly liteMode?: boolean;
}

export class SystemsFieldDemoAI implements SimulationAI {
  private elapsedSinceReset = 0;
  private nextResetIn = 0;
  private nextGestureIn = 0.25;
  private pointerId = -8801;

  constructor(private readonly options: SystemsFieldDemoAIOptions) {}

  onActivate(ctx: SimAIContext): void {
    this.randomize(ctx);
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceReset += ctx.dt;
    this.nextGestureIn -= ctx.dt;
    if (this.elapsedSinceReset >= this.nextResetIn) {
      this.randomize(ctx);
      return [];
    }
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = this.options.liteMode ? 0.7 + Math.random() * 1.1 : 0.35 + Math.random() * 0.8;
    const x = ctx.width * (0.12 + Math.random() * 0.76);
    const y = ctx.height * (0.12 + Math.random() * 0.76);
    const dx = (-0.5 + Math.random()) * ctx.width * 0.42;
    const dy = (-0.5 + Math.random()) * ctx.height * 0.42;
    const roll = Math.random();
    if (roll < 0.34) return [{ kind: 'tap', x, y, timestamp: performance.now() }];
    if (roll < 0.58) return [{ kind: 'hold', x, y, durationMs: 650, timestamp: performance.now() }];
    if (roll < 0.86) return [{ kind: 'drag', id: this.pointerId, x, y, dx, dy, velocity: Math.hypot(dx, dy), timestamp: performance.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: dx * 1.7, dy: dy * 1.7, velocity: Math.hypot(dx, dy) * 1.7, timestamp: performance.now() }];
  }

  reset(): void {
    this.elapsedSinceReset = 0;
    this.nextResetIn = 0;
    this.nextGestureIn = 0.25;
    this.pointerId -= 1;
  }

  private randomize(ctx: SimAIContext): void {
    ctx.resetScene();
    const style = ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
    if (style) ctx.applyStyle(style);
    for (const field of this.options.fields) {
      if (field.key === 'timeScale') {
        ctx.applyNumericSetting(field.key, this.options.liteMode ? 0.9 : 0.85 + Math.random() * 0.7);
        continue;
      }
      if (field.key === 'resolution') {
        ctx.applyNumericSetting(field.key, this.options.liteMode ? 72 : randomNumber(field));
        continue;
      }
      if (field.type === 'number') ctx.applyNumericSetting(field.key, randomNumber(field));
      else if (field.type === 'boolean') ctx.applySetting(field.key, Math.random() > 0.5);
      else if (field.type === 'select' && field.options && field.options.length > 0) {
        const option = field.options[Math.floor(Math.random() * field.options.length)];
        if (option) ctx.applySetting(field.key, option.value);
      }
    }
    this.elapsedSinceReset = 0;
    this.nextResetIn = this.options.liteMode ? 12 + Math.random() * 8 : 18 + Math.random() * 14;
  }
}

function randomNumber(field: SettingsField): number {
  const min = typeof field.min === 'number' ? field.min : 0;
  const max = typeof field.max === 'number' ? field.max : min;
  const step = typeof field.step === 'number' && field.step > 0 ? field.step : 1;
  const raw = min + Math.random() * Math.max(0, max - min);
  const snapped = Math.max(min, Math.min(max, Math.round(raw / step) * step));
  const decimals = step < 1 ? step.toString().split('.')[1]?.length ?? 0 : 0;
  return Number(snapped.toFixed(Math.min(4, decimals)));
}
