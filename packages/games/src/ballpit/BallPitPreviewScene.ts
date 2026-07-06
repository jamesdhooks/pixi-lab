import { BallPitRawWebGL2Scene } from './BallPitRawWebGL2Scene';

export class BallPitPreviewScene extends BallPitRawWebGL2Scene {
  override readonly name = 'BallPitPreview';

  constructor() {
    super(true);
    this.setQuality('raw');
  }
}
