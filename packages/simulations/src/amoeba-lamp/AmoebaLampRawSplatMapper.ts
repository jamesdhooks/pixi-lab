export interface AmoebaRawSourceParticle {
  readonly x: number;
  readonly y: number;
}

export interface AmoebaRawSplatMapOptions {
  readonly width: number;
  readonly height: number;
  readonly textureWidth: number;
  readonly textureHeight: number;
  readonly densityRadius: number;
  readonly maxSplats?: number;
}

export interface AmoebaRawFieldSplat {
  readonly x: number;
  readonly y: number;
  readonly texelX: number;
  readonly texelY: number;
  readonly radius: number;
  readonly density: number;
  readonly heat: number;
}

export function mapAmoebaParticlesToRawSplats(
  particles: readonly AmoebaRawSourceParticle[],
  options: AmoebaRawSplatMapOptions,
): AmoebaRawFieldSplat[] {
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);
  const textureWidth = Math.max(1, Math.floor(options.textureWidth));
  const textureHeight = Math.max(1, Math.floor(options.textureHeight));
  const maxSplats = Math.max(0, Math.floor(options.maxSplats ?? particles.length));
  const radius = roundTo(Math.max(0.5, options.densityRadius) * (textureWidth / 40), 3);

  return particles.slice(0, maxSplats).map((particle) => {
    const x = roundTo(clamp01(particle.x / width), 4);
    const y = roundTo(clamp01(particle.y / height), 4);
    return {
      x,
      y,
      texelX: Math.min(textureWidth - 1, Math.max(0, Math.round(x * textureWidth))),
      texelY: Math.min(textureHeight - 1, Math.max(0, Math.round(y * textureHeight))),
      radius,
      density: 1,
      heat: roundTo(Math.min(1, Math.max(0.15, 0.15 + y * 1.32)), 3),
    };
  });
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
