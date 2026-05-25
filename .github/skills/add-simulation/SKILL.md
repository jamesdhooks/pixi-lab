# SKILL: Add a New Simulation

Use this skill when creating a new simulation in `packages/simulations`.

Simulations are `LabExperience` entries with `kind: 'simulation'`. They use the shared engine systems from `@hooksjam/pixi-lab-core`: `SimulationScene`, style manifests, shared gestures, director mode, stagnation recovery, seeded RNG, performance quality, and render infrastructure.

---

## Step 1 — Choose Name and IDs

Pick:
- kebab-case `id`, e.g. `mycelium-prism`
- PascalCase prefix, e.g. `MyceliumPrism`
- camelCase export name, e.g. `myceliumPrismDefinition`

---

## Step 2 — Create Folder Structure

```txt
packages/simulations/src/<id>/
  <id>.config.ts
  <id>.definition.ts
  <PascalId>Model.ts
  <PascalId>Scene.ts
  <PascalId>PreviewScene.ts
  styles/
    <style-id>.ts
  __tests__/
    <PascalId>Model.test.ts
```

Keep model/state logic separate from Pixi scene rendering when practical. This makes seeded reproducibility and stagnation tests cheap.

---

## Step 3 — Config

Create `<id>.config.ts` with `SettingsField[]` and defaults. Include controls for:
- primary simulation budget such as particle count, grid size, or emitter count
- style id
- debug overlay toggle
- important live tuning values from the master plan, such as glow strength, thresholds, bloom, palette speed, field scale, or particle count

---

## Step 4 — Model

Create `<PascalId>Model.ts` for deterministic simulation state.

Rules:
- use `SeededRng` from `@hooksjam/pixi-lab-core`
- use shared primitive types/systems where possible: `ScalarField`, `VectorField`, `TrailField`, `DensityField`, `TriangularGrid`, `SpringSystem`, `SimParticleSystem`
- expose `update(dt)`, gesture handlers, reset/seed behavior, and state stats needed by tests
- avoid unbounded growth
- avoid expensive all-pairs interactions unless the budget is tiny and documented

---

## Step 5 — Scene

Create `<PascalId>Scene.ts` extending `SimulationScene`.

Must implement:
- `getRenderLayers(): SimRenderLayers`
- `getStyleManifest(): SimStyleManifest`
- `setStyle(styleId: string)` if style affects scene state beyond shared manager
- `setQuality(quality: RenderQuality)`
- `detectStagnation(): StagnationReport`
- `stabilize(): void`
- `softReset(seed?: number): void`

Use shared gesture events from `consumeGestures()` and map them to the model behavior declared in the definition.

---

## Step 6 — Preview Scene

Create `<PascalId>PreviewScene.ts`.

Preview requirements:
- cap particle/grid/body budgets aggressively
- no audio
- deterministic seed
- Basic quality only unless the preview remains cheap

---

## Step 7 — Styles

Create at least two styles under `styles/`.

Each style exports a `SimStyle` with:
- `id`
- `name`
- `background`
- `palette`
- shared render `passes`
- `uniforms`
- optional `uniformSchema` for React tuning UI

Style differences should mostly be palettes, pass selection, and uniforms. Do not fork the simulation logic per style.

---

## Step 8 — Definition

Create `<id>.definition.ts` exporting a `SimulationDefinition`.

Required fields:
- `kind: 'simulation'`
- `styleManifest`
- `gestureMap`
- `directorEvents`
- `stagnationPolicy`
- `defaultSeed`
- `capabilities` with `interactive`, `ambient`, `gestures`, `directorMode`, `stagnationRecovery`, `debugOverlay`, `styleExport`, `proceduralTextures`, `renderTargetPool`, and **`demo: true`** as appropriate
- `factory` and `previewFactory`
- **`demoAiFactory`** — required when `capabilities.demo` is true; return a `SimulationAI` that generates plausible `GestureEvent[]` each frame to operate the simulation autonomously

---

## Step 9 — Registry

Register in `packages/simulations/src/index.ts`:

```typescript
import { <camelId>Definition } from './<id>/<id>.definition';
export { <camelId>Definition } from './<id>/<id>.definition';

export const SIMULATION_REGISTRY: readonly SimulationDefinition[] = [
  harmonicSandDefinition,
  <camelId>Definition,
] as const;
```

---

## Step 10 — Tests

Add tests for:
- deterministic initialization from same seed
- update advances the main state
- gestures produce expected state changes
- stagnation detection can return a positive report
- `stabilize()` injects useful energy or variation
- `softReset(seed)` reproduces state

---

## Step 11 — Demo and Tracking

Verify the simulation appears in the demo Gallery and launches.

Update `pixijs_simulation_tracking_system_v1.md`:
- set status
- tick validation checklist items
- add implementation notes
- list any deferred engine features honestly

---

## Quality Gates

```bash
pnpm --filter @hooksjam/pixi-lab-core typecheck
pnpm --filter @hooksjam/pixi-lab-simulations typecheck
pnpm --filter @hooksjam/pixi-lab-simulations build
pnpm test
pnpm --filter @hooksjam/pixi-lab-demo dev
```

---

## Do Not

- Do not import `pixi.js` or `planck` directly in simulation content.
- Do not attach filters to individual display objects.
- Do not create one Pixi object per field cell.
- Do not bypass `RenderTargetPool` for persistent render targets.
- Do not hardcode styles into simulation logic.
- Do not skip seeded reproducibility.
- Do not mark a simulation complete until Basic + Enhanced quality, styles, gestures, director mode, stagnation recovery, debug rendering, and tests are implemented.
