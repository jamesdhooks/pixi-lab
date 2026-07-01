import { BaseEffectEmitter } from '../EffectEmitter.js';

export class SmokeEmitter extends BaseEffectEmitter {
  readonly kind = 'smoke' as const;
}
