import { BaseEffectEmitter } from '../EffectEmitter.js';

export class SparkEmitter extends BaseEffectEmitter {
  readonly kind = 'spark' as const;
}
