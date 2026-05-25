import { BaseEffectEmitter } from '../EffectEmitter';

export class FireflyEmitter extends BaseEffectEmitter {
  readonly kind = 'firefly' as const;
}
