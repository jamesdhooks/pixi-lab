import { BaseEffectEmitter } from '../EffectEmitter.js';

export class EmberEmitter extends BaseEffectEmitter {
  readonly kind = 'ember' as const;
}
