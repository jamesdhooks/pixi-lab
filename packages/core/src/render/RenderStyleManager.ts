import type { RenderQuality, SimStyle, SimStyleManifest } from '../types';

export class RenderStyleManager {
  private manifest: SimStyleManifest | null = null;
  private styleId: string | null = null;
  private quality: RenderQuality = 'basic';

  setManifest(manifest: SimStyleManifest): void {
    this.manifest = manifest;
    this.styleId = manifest.defaultStyleId;
  }

  getManifest(): SimStyleManifest | null {
    return this.manifest;
  }

  setStyle(styleId: string): void {
    if (!this.manifest?.styles.some((style) => style.id === styleId)) {
      throw new Error(`Unknown style id: ${styleId}`);
    }
    this.styleId = styleId;
  }

  getStyle(): SimStyle | null {
    if (!this.manifest) return null;
    return this.manifest.styles.find((style) => style.id === this.styleId) ?? this.manifest.styles[0] ?? null;
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
  }

  getQuality(): RenderQuality {
    return this.quality;
  }

  snapshot() {
    const style = this.getStyle();
    return {
      styleId: style?.id ?? 'none',
      quality: this.quality,
      uniforms: style?.uniforms ?? {},
    };
  }
}
