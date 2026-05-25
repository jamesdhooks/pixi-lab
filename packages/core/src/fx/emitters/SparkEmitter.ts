import { BaseEffectEmitter } from '../EffectEmitter';

export class SparkEmitter extends BaseEffectEmitter {
  readonly kind = 'spark' as const;
}
