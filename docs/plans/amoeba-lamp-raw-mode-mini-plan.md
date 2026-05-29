# Amoeba Lamp RAW Mode Mini-Plan

Date: 2026-05-29  
Branch: `neocloud/pixi-lab-continuous-implementation`  
Parent roadmap: `docs/plans/raw-mode-gpu-field-roadmap.md`

## Purpose

Define the first true non-fluid RAW MODE slice before advertising `raw` on `amoeba-lamp`. This plan is intentionally scene-owned and narrow: raw should prove stateful GPU field simulation for a density/metaball organism without introducing a generic GPU Field Engine yet.

## Current-code evidence

Inspected on 2026-05-29:

- `packages/simulations/src/amoeba-lamp/AmoebaLampScene.ts`
  - Current qualities remain `['basic', 'enhanced']` in both the style manifest and definition.
  - `basic` uses `FieldPaletteRenderer` as a grid-resolution fallback for `model.densityField`.
  - `enhanced` uses `DensityMetaballRenderer` plus `ParticlePointRenderer`.
  - Live settings already poll `resolution`, `particleBudget`, `blobCount`, `densityRadius`, `surfaceTension`, and `buoyancy`.
- `packages/simulations/src/amoeba-lamp/AmoebaLampModel.ts`
  - Deterministic CPU model already owns blob particles, `densityField`, and `heatField`.
  - `particleSnapshot()` exposes raw particle coordinates for upload-friendly tests/helpers.
  - `densityField` and `heatField` are rebuilt every update from particles, giving a clean fallback state source.
- `packages/simulations/src/amoeba-lamp/amoeba-lamp.definition.ts`
  - `qualityModes` is still `['basic', 'enhanced']`; this must remain true until the raw adapter exists and passes browser QA.
- Compared with Tier 1 alternatives:
  - `ant-signal` has excellent pheromone-road semantics, but a true raw route needs agent sampling/depositing against a pheromone texture and a CPU fallback bridge.
  - `orbital-shrapnel` has a strong GPU-particle future, but the first valid slice requires particle texture lifecycle and trail feedback ownership together.
  - Amoeba Lamp can start narrower by using CPU particles as deterministic sources while making density/heat ping-pong textures the hero state.

## Raw adapter scope

Create a scene-owned adapter, tentatively:

```txt
packages/simulations/src/amoeba-lamp/AmoebaLampRawRenderer.ts
```

The adapter should not be exported from core and should not become a generic engine yet.

### State textures / fields

Raw mode should own these GPU resources:

1. `densityA` / `densityB` ping-pong texture
   - Stores persistent organism density.
   - Receives particle splats each frame.
   - Decays and diffuses slowly to create a living membrane instead of a one-frame particle cloud.
2. `heatA` / `heatB` ping-pong texture
   - Stores heat/plume energy from particles and gestures.
   - Diffuses upward/subtly over time and modulates membrane color/refraction.
3. Optional `normal`/gradient pass in the same adapter or a small helper once needed
   - Derived from density for fake normals and edge lighting.
4. Composite pass
   - Threshold/smoothstep density into a soft membrane.
   - Use density gradient for fake lighting.
   - Add edge glow from density threshold band.
   - Use heat for palette shift and inner glow.

The CPU model remains authoritative for blob behavior in the first slice; raw mode uses particles as hidden field sources, not as the hero visible layer. This still satisfies RAW MODE because the rendered organism is produced from persistent GPU field state, not direct CPU dot rendering.

## Quality modes advertised

Keep current advertised modes until implementation is complete:

```ts
qualityModes: ['basic', 'enhanced']
amoebaLampStyleManifest.capabilities.qualities: ['basic', 'enhanced']
```

Only after the raw adapter is implemented and browser-smoked:

```ts
qualityModes: ['basic', 'enhanced', 'raw']
amoebaLampStyleManifest.capabilities.qualities: ['basic', 'enhanced', 'raw']
```

`basic` and `enhanced` must keep their existing Pixi-native renderers and must not depend on raw resources.

## Preview behavior

`AmoebaLampPreviewScene` remains cheap/basic. Do not instantiate the raw adapter in preview tiles.

## Fallback behavior

If raw WebGL/RenderTexture setup fails at runtime:

1. Destroy any partially-created raw resources owned by the adapter.
2. Fall back inside `AmoebaLampScene` to the existing enhanced `DensityMetaballRenderer` path when possible, otherwise the existing basic `FieldPaletteRenderer` path.
3. Set `detectStagnation()` to a non-crashing report that explains raw setup failed.
4. Do not persist a downgraded quality globally; `raw` remains a user-selected quality and unsupported experiences remain sanitized by `GameLauncher`.

## Focused tests before implementation

Use TDD for pure helpers before renderer wiring:

1. Particle-to-splat mapper
   - Input: `particleSnapshot()`, heat/density radius, scene dimensions, texture dimensions.
   - Assert bounded normalized splats and heat weights.
2. Raw quality selection helper if introduced
   - Assert `raw` selects the raw adapter only for `AmoebaLampScene`, while `basic`/`enhanced` preserve current renderer families.
3. Resource ownership helper if introduced
   - Assert shared Pixi textures are not destroyed when a generated texture fallback is not owned.

Do not test private Pixi internals; keep tests around pure mapper/state-selection logic.

## Browser QA route

After implementation, smoke these routes:

```txt
/pixi-lab/ then launch Amoeba Lamp with basic
/pixi-lab/ then launch Amoeba Lamp with enhanced
/pixi-lab/ then launch Amoeba Lamp with raw
/pixi-lab/?quality=raw then launch a non-raw experience to confirm raw is sanitized away
```

Expected visual distinction:

- `basic`: existing field fallback, one Pixi canvas.
- `enhanced`: existing density metaball plus particle highlights, one Pixi canvas.
- `raw`: scene-owned stateful density/heat field membrane. It may create a scene-owned raw WebGL canvas only if the adapter cannot use the shared Pixi app safely, but the preferred first attempt is a Pixi-owned shader/render-texture adapter through the current `GameApp` Pixi app.

## Validation commands

Minimum code-slice validation after implementation:

```bash
export PATH=/home/hermes/.local/bin:/home/hermes/.hermes/node/bin:$PATH
pnpm test -- packages/simulations/src/amoeba-lamp/__tests__/<new-helper>.test.ts
pnpm --filter @hooksjam/pixi-lab-core build
pnpm --filter @hooksjam/pixi-lab-simulations typecheck
pnpm --filter @hooksjam/pixi-lab-demo typecheck
```

Run browser smoke only after the adapter is wired and `raw` is advertised.

## 2026-05-29 helper slice note

Implemented the first TDD helper for the raw adapter: `packages/simulations/src/amoeba-lamp/AmoebaLampRawSplatMapper.ts`. It maps deterministic CPU particle snapshots into bounded normalized density/heat splats with texture-space centers, deterministic upload budgeting, and explicit radius/heat values for future density/heat ping-pong injection. The RED run failed because the mapper module did not exist; the GREEN run passed `AmoebaLampRawSplatMapper.test.ts`. `raw` remains unadvertised for Amoeba Lamp until the actual scene-owned adapter is implemented and browser-smoked.

## Non-goals for the first raw slice

- Do not extract a generic GPU Field Engine.
- Do not move raw renderer internals into `@hooksjam/pixi-lab-core`.
- Do not make CPU particles the main raw visual; they are density/heat sources.
- Do not enable raw in previews.
- Do not advertise `raw` until adapter implementation, tests, typechecks, and browser QA pass.
