import { PegboardScene } from './PegboardScene';

export class PegboardPreviewScene extends PegboardScene {
  override readonly name = 'PegboardPreview';

  constructor() {
    super(true);
    this.setQuality('basic');
  }
}
