import type { RenderQuality, StyleExportSnapshot } from '../types';

export class StyleExporter {
  static export(snapshot: StyleExportSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }

  static snapshot(input: {
    experienceId: string;
    styleId: string;
    seed: number;
    quality: RenderQuality;
    uniforms: Record<string, number | string | boolean>;
  }): StyleExportSnapshot {
    return { ...input };
  }
}
