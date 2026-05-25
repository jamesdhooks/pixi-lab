import type { Vec2 } from '../../types.js';

export interface SpringNode {
  position: Vec2;
  previous: Vec2;
  pinned?: boolean;
}

export interface SpringEdge {
  a: number;
  b: number;
  restLength: number;
  stiffness: number;
}

export class SpringSystem {
  readonly nodes: SpringNode[] = [];
  readonly edges: SpringEdge[] = [];

  step(iterations = 2): void {
    for (let iteration = 0; iteration < iterations; iteration++) {
      for (const edge of this.edges) {
        const a = this.nodes[edge.a];
        const b = this.nodes[edge.b];
        if (!a || !b) continue;
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const distance = Math.max(0.0001, Math.hypot(dx, dy));
        const correction = ((distance - edge.restLength) / distance) * edge.stiffness * 0.5;
        if (!a.pinned) {
          a.position.x += dx * correction;
          a.position.y += dy * correction;
        }
        if (!b.pinned) {
          b.position.x -= dx * correction;
          b.position.y -= dy * correction;
        }
      }
    }
  }
}
