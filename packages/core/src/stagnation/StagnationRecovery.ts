import type { StagnationReport } from '../types';

export interface StagnationAware {
  detectStagnation(): StagnationReport;
  stabilize(): void;
}

export class StagnationRecovery {
  private elapsedMs = 0;

  constructor(private readonly intervalMs = 2500) {}

  update(dt: number, scene: StagnationAware): StagnationReport | null {
    this.elapsedMs += dt * 1000;
    if (this.elapsedMs < this.intervalMs) return null;
    this.elapsedMs = 0;
    const report = scene.detectStagnation();
    if (report.stagnant) {
      scene.stabilize();
      return report;
    }
    return null;
  }

  reset(): void {
    this.elapsedMs = 0;
  }
}
