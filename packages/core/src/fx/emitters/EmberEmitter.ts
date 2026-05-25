import { BaseEffectEmitter } from '../EffectEmitter';

export class EmberEmitter extends BaseEffectEmitter {
  readonly kind = 'ember' as const;
}
