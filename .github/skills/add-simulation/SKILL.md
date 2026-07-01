# SKILL: Add a New Simulation

Use this skill when creating a new simulation in `packages/simulations`.

Simulations are `LabExperience` entries with `kind: 'simulation'`. They use the shared engine systems from `@hooksjam/pixi-lab-core`: `SimulationScene`, style manifests, shared gestures, director mode, stagnation recovery, seeded RNG, performance quality, and render infrastructure.

Before scaffolding, choose the simulation's primary renderer family:

| Primitive | Renderer |
|---|---|
| scalar/wave/heat field | `FieldPaletteRenderer` |
| metaballs/blobs/density membranes | `DensityMetaballRenderer` |
| pheromones/echoes/scars/orbital dust | `TrailFeedbackRenderer` |
| triangular grids/crystals/fungal lattices | `MeshLatticeRenderer` |
| plasma branches/discharges/streaks | `ArcLineRenderer` |
| agents/debris/sparks/nuclei | `ParticlePointRenderer` |

Do not scaffold new simulations around `SimulationCanvasLayer.renderField()` unless the concept is explicitly a field visualization. `resolution` controls model/data resolution; visual smoothness should come from the chosen renderer.

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

If the simulation has a grid, field, or trail dimension, expose it with `key: 'resolution'`, `label: 'Resolution'`, `type: 'number'`, `min: 32`, `max: 512`, and `step: 32`. Do not use `gridColumns`, `fieldColumns`, `trailColumns`, or `fieldResolution` as settings keys.

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

### ⚠️ Live settings polling — REQUIRED

**Sliders do nothing if you only read settings in `onEnter()`.** The settings system is write-only from the UI: the scene must poll for changes every tick. Follow the `HarmonicSandScene` pattern exactly:

1. **Model**: add a public setter for each `SettingsField` of type `number` that mutates `this.options.<key>` in place.
   For params that require a structural rebuild (grid dimensions, particle budgets), the scene handles the rebuild instead.

2. **Scene**: add a `private last<Key> = 0` tracking field per configurable setting.
   In `onEnter()`, initialise every `last*` field from `this.modelOptions` after the model is constructed.
   In `update()`, poll each setting **before** advancing the simulation:

```ts
// Compact live-applicable example (surfaceTension etc.)
const newSurfaceTension = (settings.get('surfaceTension') as number | undefined)
  ?? (MY_DEFAULTS.surfaceTension as number);
if (newSurfaceTension !== this.lastSurfaceTension) {
  this.lastSurfaceTension = newSurfaceTension;
  this.model.setSurfaceTension(newSurfaceTension);
  this.modelOptions = { ...this.modelOptions, surfaceTension: newSurfaceTension };
}

// Structural example (resolution) — rebuild model
const newColumns = (settings.get('resolution') as number | undefined)
  ?? (MY_DEFAULTS.resolution as number);
if (newColumns !== this.lastGridColumns) {
  this.lastGridColumns = newColumns;
  this.modelOptions = {
    ...this.modelOptions,
    columns: newColumns,
    rows: Math.max(12, Math.round(newColumns * this.ctx_.height / Math.max(1, this.ctx_.width))),
    seed: this.modelOptions.seed + 1,
  };
  this.model = new MyModel(this.modelOptions);
}
```

Keep `this.modelOptions` in sync with every live change so that `resize()` and `reset()` pick up the current values when they spread `...this.modelOptions`.

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
- **`demoAiFactory`** — required when `capabilities.demo` is true; return a `SimulationAI` that:
  - Implements **`onActivate(ctx)`** to immediately apply an initial style + settings on first launch
  - Implements **`think(ctx)`** with a periodic **overhaul loop** (every 18–35 s) that calls `ctx.resetScene()`, `ctx.applyStyle()`, and `ctx.applyNumericSetting()` for every `SettingsField` key
  - Implements **`reset()`** to reset all elapsed timers (including the overhaul timer back to 0 to trigger overhaul on next tick)
  - Generates continuous `GestureEvent[]` between overhuals to keep the simulation active
  - Defines `PARAM_PRESETS` constant arrays covering the full range of each numeric setting

  > A DemoAI that only generates gestures and never calls `applyStyle`/`applyNumericSetting` is **incomplete** — the demo will never cycle through the slider range or showcase different styles.

  **Canonical pattern** (mirror `HarmonicSandDemoAI.ts` and `AmoebaLampDemoAI.ts`):

  ```ts
  const PARAM_PRESETS: Array<[number, ...]> = [/* one tuple per mood */];

  export class MySimDemoAI implements SimulationAI {
    private elapsedSinceOverhaul = 0;
    private nextOverhaulIn = 0; // 0 triggers overhaul on first tick

    onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

    reset(): void { this.elapsedSinceOverhaul = 0; this.nextOverhaulIn = 0; /* reset other timers */ }

    think(ctx: SimAIContext): GestureEvent[] {
      this.elapsedSinceOverhaul += ctx.dt;
      if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) { this.doOverhaul(ctx); return []; }
      // ... generate gestures ...
    }

    private doOverhaul(ctx: SimAIContext): void {
      ctx.resetScene();
      ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
      const [param1, param2] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
      ctx.applyNumericSetting('param1Key', param1);
      ctx.applyNumericSetting('param2Key', param2);
      this.nextOverhaulIn = 20 + Math.random() * 15; // 20–35 s
      this.elapsedSinceOverhaul = 0;
    }
  }
  ```

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

Run from a built workspace because package exports point at `dist`:

```bash
pnpm build
pnpm --recursive typecheck
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
