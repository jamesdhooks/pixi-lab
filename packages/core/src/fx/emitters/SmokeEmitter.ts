import { BaseEffectEmitter } from '../EffectEmitter';

export class SmokeEmitter extends BaseEffectEmitter {
  readonly kind = 'smoke' as const;
}
