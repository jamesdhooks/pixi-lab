import { BaseEffectEmitter } from '../EffectEmitter.js';

export class ConfettiEmitter extends BaseEffectEmitter {
  readonly kind = 'confetti' as const;
}
