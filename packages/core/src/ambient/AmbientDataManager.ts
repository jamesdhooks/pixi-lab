import type { AmbientDataAdapter, AmbientDataSnapshot, AmbientDataSource } from '../types';

export class AmbientDataManager {
  private readonly adapters = new Map<AmbientDataSource, AmbientDataAdapter>();

  register(adapter: AmbientDataAdapter): void {
    this.adapters.set(adapter.source, adapter);
  }

  get(source: AmbientDataSource): AmbientDataSnapshot {
    const adapter = this.adapters.get(source);
    if (adapter) return adapter.getSnapshot();
    return this.synthetic(source);
  }

  getAll(sources: readonly AmbientDataSource[]): AmbientDataSnapshot[] {
    return sources.map((source) => this.get(source));
  }

  clear(): void {
    this.adapters.clear();
  }

  private synthetic(source: AmbientDataSource): AmbientDataSnapshot {
    const now = Date.now();
    const phase = (now % 60_000) / 60_000;
    return {
      source,
      timestamp: now,
      values: {
        synthetic: true,
        phase,
        intensity: 0.35 + Math.sin(phase * Math.PI * 2) * 0.15,
      },
    };
  }
}
