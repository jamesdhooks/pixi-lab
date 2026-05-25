import { BaseEffectEmitter } from '../EffectEmitter';

export class FireworkEmitter extends BaseEffectEmitter {
  readonly kind = 'firework' as const;
}
