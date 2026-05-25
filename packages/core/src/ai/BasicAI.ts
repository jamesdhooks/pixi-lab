/**
 * packages/core/src/ai/BasicAI.ts
 *
 * Baseline heuristic AI. Performs random taps, occasional drags, and
 * holds at low cadence. Suitable for AI autoplay mode in most games.
 *
 * Games extend this and override actionWeights / buildActions.
 */
import type { AIController, AIContext } from './AIController.js';
import type { Intent } from '../types.js';

type ActionKind = 'tap' | 'drag' | 'hold_release';

interface WeightedAction {
  kind: ActionKind;
  weight: number;
}

export class BasicAI implements AIController {
  protected actionCooldown = 0;
  /** Min seconds between actions */
  protected minInterval = 0.3;
  /** Max seconds between actions */
  protected maxInterval = 1.2;
  protected nextInterval = 0.5;

  protected actions: WeightedAction[] = [
    { kind: 'tap', weight: 0.7 },
    { kind: 'drag', weight: 0.2 },
    { kind: 'hold_release', weight: 0.1 },
  ];

  private dragState: { x: number; y: number; id: number; remaining: number } | null = null;

  think(ctx: AIContext): Intent[] {
    this.actionCooldown -= ctx.dt;
    const intents: Intent[] = [];

    // Continue any in-progress drag
    if (this.dragState) {
      this.dragState.remaining -= ctx.dt;
      if (this.dragState.remaining <= 0) {
        intents.push({
          kind: 'drag_end',
          x: this.dragState.x,
          y: this.dragState.y,
        });
        this.dragState = null;
      } else {
        // Drift the drag target slightly
        this.dragState.x += (Math.random() - 0.5) * 20;
        this.dragState.y += (Math.random() - 0.5) * 20;
        this.dragState.x = Math.max(10, Math.min(ctx.width - 10, this.dragState.x));
        this.dragState.y = Math.max(10, Math.min(ctx.height - 10, this.dragState.y));
        intents.push({
          kind: 'drag_move',
          x: this.dragState.x,
          y: this.dragState.y,
        });
      }
    }

    if (this.actionCooldown > 0) return intents;

    const action = this.pickAction();
    this.actionCooldown = this.minInterval + Math.random() * (this.maxInterval - this.minInterval);

    const rx = Math.random() * ctx.width;
    const ry = Math.random() * ctx.height;

    if (action.kind === 'tap') {
      intents.push({ kind: 'tap', x: rx, y: ry });
    } else if (action.kind === 'drag') {
      this.dragState = {
        x: rx,
        y: ry,
        id: Date.now(),
        remaining: 0.5 + Math.random() * 1.0,
      };
      intents.push({ kind: 'drag_start', x: rx, y: ry });
    } else if (action.kind === 'hold_release') {
      intents.push({ kind: 'release', x: rx, y: ry });
    }

    return intents;
  }

  reset() {
    this.actionCooldown = 0;
    this.dragState = null;
  }

  protected pickAction(): WeightedAction {
    const total = this.actions.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * total;
    for (const a of this.actions) {
      r -= a.weight;
      if (r <= 0) return a;
    }
    return this.actions[0];
  }
}
