import { BaseEffectEmitter } from '../EffectEmitter.js';

export class FireworkEmitter extends BaseEffectEmitter {
  readonly kind = 'firework' as const;
}
