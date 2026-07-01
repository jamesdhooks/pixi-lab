import type { BurstEffect, BurstEffectKind } from '../types.js';
import type { BurstEmitterSystem } from './BurstEmitterSystem.js';

export interface EffectEmitter {
  readonly kind: BurstEffectKind;
  emit(system: BurstEmitterSystem, effect: Omit<BurstEffect, 'kind'>): void;
}

export abstract class BaseEffectEmitter implements EffectEmitter {
  abstract readonly kind: BurstEffectKind;

  emit(system: BurstEmitterSystem, effect: Omit<BurstEffect, 'kind'>): void {
    system.emit({ ...effect, kind: this.kind });
  }
}
