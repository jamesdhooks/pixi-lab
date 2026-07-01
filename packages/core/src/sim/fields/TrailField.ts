import { ScalarField } from './ScalarField.js';

export class TrailField extends ScalarField {
  fade(amount: number): void {
    const factor = Math.max(0, Math.min(1, amount));
    for (let i = 0; i < this.values.length; i++) {
      this.values[i] *= factor;
    }
  }
}
