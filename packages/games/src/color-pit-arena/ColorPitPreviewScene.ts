import { ColorPitScene } from './ColorPitScene';

export class ColorPitPreviewScene extends ColorPitScene {
  override readonly name = 'ColorPitPreview';
  constructor() { super(true); this.setQuality('basic'); }
}
