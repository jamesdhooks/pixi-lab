# Orbital Shrapnel RAW Mode Mini-Plan

Date: 2026-06-01  
Branch: `neocloud/pixi-lab-continuous-implementation`  
Parent roadmap: `docs/plans/raw-mode-gpu-field-roadmap.md`

## Purpose

Define a measured RAW MODE path for `orbital-shrapnel` after Amoeba Lamp proved the first non-fluid Pixi-owned raw field route. Orbital should not advertise `raw` until it has an implemented and browser-smoked raw route. The first slices should stay pure and testable: budget planning, particle-state packing, trail-field persistence, then a scene-owned renderer.

## Current-code evidence

Inspected on 2026-06-01:

- `OrbitalShrapnelModel` owns deterministic debris particles with position, velocity, heat, size, and spin; public render paths currently expose particles through `renderParticles()` and a bounded `TrailField`.
- `OrbitalShrapnelScene` advertises only `basic`/`enhanced` in the style manifest.
- `basic` uses `FieldPaletteRenderer` against the CPU trail field; `enhanced` uses `TrailFeedbackRenderer` plus `ParticlePointRenderer`.
- Live settings already cover particle count, trail resolution, planet radius, gravity, and trail fade.

## Raw adapter scope

A future scene-owned raw adapter should represent:

1. Particle state texture: debris position, velocity, heat/life metadata.
2. Trail feedback texture: persistent debris glow around central gravity wells.
3. Composite pass: trail bloom, heat tinting, and planet-lens contrast.

Keep this adapter package-local under `packages/simulations/src/orbital-shrapnel/`. Do not promote generic GPU particle helpers until Orbital plus at least one later scene prove the shared boundary.

## Quality modes advertised

Current advertised modes remain:

```ts
qualityModes: ['basic', 'enhanced']
```

Only add `raw` after renderer implementation, registry coverage, and browser QA. Preview factories must remain basic/Pixi-safe; do not create raw WebGL previews.

## Fallback behavior

If future raw setup fails, destroy any owned raw resources and fall back to the existing enhanced path (`TrailFeedbackRenderer` + particles). Do not persist downgraded quality globally.

## Focused tests before renderer wiring

1. Raw texture/budget planner for particle-state and trail textures.
2. Particle-state upload packer carrying position, velocity, heat, and size.
3. Trail upload/composite helpers for bounded persistent feedback.
4. Resource ownership helper if generated texture fallbacks are introduced.

## 2026-06-01 texture-plan helper slice note

Added `OrbitalShrapnelRawTexturePlan` as the first pure raw-adapter helper. It plans bounded particle-state texture capacity and aspect-preserving trail texture dimensions across `basic`, `enhanced`, and future `raw`, with tests proving raw-sized uploads do not leak into non-raw qualities. This is helper-only: `orbital-shrapnel` still advertises only `basic`/`enhanced`, and browser QA is deferred until a selectable renderer exists.

## 2026-06-09 selectable raw fidelity slice note

Orbital Shrapnel now exposes the Pixi-owned `raw` quality route after adding the bounded raw trail texture/composite renderer. The first fidelity follow-up keeps the raw route scene-owned while adding high-density visual controls from the WebGL reference pass:

- Normal/main settings: `particleCount`, `resolution`, `gravity`, `planetRadius`, `trailFade`, `debrisSize`, and `trailGamma`.
- Advanced cog / WebGL-high settings: `rawParticleTextureSize`, `rawTrailTextureWidth`, `rawMaxSpeed`, `bloomStrength`, and `streakStrength`.
- Raw rendering now composites the trail texture plus sampled additive debris/streak layers so extreme particle tiers keep visible high-fidelity motion cues without drawing every particle as individual Pixi geometry.
- Focused registry/helper tests and the simulations typecheck verify the settings/default alignment and raw adapter helper behavior.

Keep the next Orbital slice focused on GPU-style state fidelity, not broad engine extraction: add a pure particle-state packer or trail feedback persistence helper before extracting shared particle/field abstractions.

## Validation commands

```bash
export PATH=/home/hermes/.local/bin:/home/hermes/.hermes/node/bin:$PATH
pnpm exec vitest run packages/simulations/src/orbital-shrapnel/__tests__/OrbitalShrapnelRawTexturePlan.test.ts
pnpm --filter @hooksjam/pixi-lab-simulations typecheck
pnpm --filter @hooksjam/pixi-lab-demo typecheck
```
