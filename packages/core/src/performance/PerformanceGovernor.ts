import type { RenderQuality } from '../types';

export interface PerformanceGovernorOptions {
  targetFps?: number;
  onQualityChange?: (quality: RenderQuality) => void;
}

export class PerformanceGovernor {
  private quality: RenderQuality = 'basic';
  private frameSamples: number[] = [];

  constructor(private readonly options: PerformanceGovernorOptions = {}) {}

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.options.onQualityChange?.(quality);
  }

  getQuality(): RenderQuality {
    return this.quality;
  }

  update(dt: number): RenderQuality | null {
    if (dt <= 0) return null;
    this.frameSamples.push(1 / dt);
    if (this.frameSamples.length < 90) return null;

    const average = this.frameSamples.reduce((sum, fps) => sum + fps, 0) / this.frameSamples.length;
    this.frameSamples = [];
    const target = this.options.targetFps ?? 50;
    if (average >= target) return null;

    const next = this.quality === 'enhanced' ? 'basic' : 'basic';
    if (next !== this.quality) {
      this.setQuality(next);
      return next;
    }
    return null;
  }
}
