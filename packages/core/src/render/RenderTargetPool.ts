import { RenderTexture, type Renderer } from 'pixi.js';

export type RenderTargetLifetime = 'transient' | 'persistent';

export interface RenderTargetRequest {
  id?: string;
  width: number;
  height: number;
  lifetime?: RenderTargetLifetime;
  resolution?: number;
}

export interface RenderTargetStats {
  transient: number;
  persistent: number;
  acquired: number;
}

interface PooledTarget {
  id: string;
  texture: RenderTexture;
  lifetime: RenderTargetLifetime;
  acquired: boolean;
}

export class RenderTargetPool {
  private targets = new Map<string, PooledTarget>();
  private transientCounter = 0;

  constructor(private readonly renderer: Renderer) {}

  acquire(request: RenderTargetRequest): RenderTexture {
    const lifetime = request.lifetime ?? 'transient';
    const id = request.id ?? `transient-${this.transientCounter++}`;
    const existing = this.targets.get(id);
    if (existing) {
      existing.acquired = true;
      return existing.texture;
    }

    const texture = RenderTexture.create({
      width: Math.max(1, Math.floor(request.width)),
      height: Math.max(1, Math.floor(request.height)),
      resolution: request.resolution ?? 1,
    });
    this.targets.set(id, { id, texture, lifetime, acquired: true });
    return texture;
  }

  release(texture: RenderTexture): void {
    for (const target of this.targets.values()) {
      if (target.texture === texture) {
        target.acquired = false;
        if (target.lifetime === 'transient') {
          target.texture.destroy(true);
          this.targets.delete(target.id);
        }
        return;
      }
    }
  }

  resizePersistent(width: number, height: number): void {
    const persistent = [...this.targets.values()].filter((target) => target.lifetime === 'persistent');
    for (const target of persistent) {
      target.texture.destroy(true);
      const texture = RenderTexture.create({ width: Math.max(1, width), height: Math.max(1, height) });
      this.targets.set(target.id, { ...target, texture });
    }
  }

  clearTransients(): void {
    for (const [id, target] of this.targets) {
      if (target.lifetime === 'transient') {
        target.texture.destroy(true);
        this.targets.delete(id);
      }
    }
  }

  stats(): RenderTargetStats {
    let transient = 0;
    let persistent = 0;
    let acquired = 0;
    for (const target of this.targets.values()) {
      if (target.lifetime === 'transient') transient++;
      if (target.lifetime === 'persistent') persistent++;
      if (target.acquired) acquired++;
    }
    return { transient, persistent, acquired };
  }

  destroy(): void {
    for (const target of this.targets.values()) {
      target.texture.destroy(true);
    }
    this.targets.clear();
    void this.renderer;
  }
}
