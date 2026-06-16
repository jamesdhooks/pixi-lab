import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number]> = [
  [360, 64, 0.75, 0.72, 0.946, 0.75],
  [520, 96, 1.35, 1, 0.964, 1.1],
  [760, 128, 2.1, 1.45, 0.978, 1.8],
  [280, 80, 2.8, 0.55, 0.934, 2.35],
  [960, 160, 1.15, 1.9, 0.986, 0.55],
];

export class CosmicInkOceanDemoAI implements SimulationAI {
  private nextGestureIn = 0.2;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.nextGestureIn = 0.2;
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx);
      return [];
    }
    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.35 + Math.random() * 0.85;
    const x = ctx.width * (0.14 + Math.random() * 0.72);
    const y = ctx.height * (0.16 + Math.random() * 0.68);
    const roll = Math.random();
    if (roll < 0.34) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.52) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.86) return [{ kind: 'drag', x, y, dx: -220 + Math.random() * 440, dy: -160 + Math.random() * 320, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -520 + Math.random() * 1040, dy: -360 + Math.random() * 720, velocity: 3.1, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    const [particleCount, resolution, turbulence, flowSpeed, inkDiffusion, vortexStrength] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('particleCount', particleCount);
    applyNumericSetting('resolution', resolution);
    applyNumericSetting('turbulence', turbulence);
    applyNumericSetting('flowSpeed', flowSpeed);
    applyNumericSetting('inkDiffusion', inkDiffusion);
    applyNumericSetting('vortexStrength', vortexStrength);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
