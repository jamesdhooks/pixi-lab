import { BaseEffectEmitter } from '../EffectEmitter';

export class ConfettiEmitter extends BaseEffectEmitter {
  readonly kind = 'confetti' as const;
}
