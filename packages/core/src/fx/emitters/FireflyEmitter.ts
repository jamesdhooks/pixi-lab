import { BaseEffectEmitter } from '../EffectEmitter.js';

export class FireflyEmitter extends BaseEffectEmitter {
  readonly kind = 'firefly' as const;
}
