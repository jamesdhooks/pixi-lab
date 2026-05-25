import { BaseEffectEmitter } from '../EffectEmitter.js';

export class ArcSparkEmitter extends BaseEffectEmitter {
  readonly kind = 'arcSpark' as const;
}
