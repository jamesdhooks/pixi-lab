---
applyTo: packages/simulations/**/*.ts
---

# Simulations Package Instructions

## Purpose
`packages/simulations` contains ambient and interactive simulation content built on the shared pixi-lab engine. Simulations are content, not engine infrastructure.

## Structure

Each simulation lives in its own folder:

```txt
packages/simulations/src/
  <simulation-id>/
    <simulation-id>.config.ts
    <simulation-id>.definition.ts
    <SimulationName>Scene.ts
    <SimulationName>PreviewScene.ts
    styles/
      <style-id>.ts
    __tests__/
      <SimulationName>Scene.test.ts
```

## Rules

1. Import engine types and helpers only from `@hooksjam/pixi-lab-core`.
2. Extend `SimulationScene` for full simulations.
3. Every simulation definition must use `kind: 'simulation'`.
4. Every simulation must expose a `SimStyleManifest` with at least two style presets.
5. Every simulation must support Basic and Enhanced quality before being marked complete.
6. Every simulation must implement seeded reproducibility through `SeededRng`.
7. Every simulation must implement `detectStagnation`, `stabilize`, and `softReset`.
8. Every simulation must map shared gestures through the definition's `gestureMap`.
9. Every simulation must declare director events for ambient idle behavior.
10. Use shared fields, render-target pools, style manifests, and shader pass abstractions where possible.
11. Every simulation MUST export a `demoAiFactory` in its definition that returns a `SimulationAI` for automated demo operation. Set `capabilities.demo: true` when this is present. The DemoAI **must** implement `onActivate()`, define `PARAM_PRESETS` covering the full slider range, and run a periodic overhaul loop in `think()` that calls `ctx.resetScene()`, `ctx.applyStyle()`, and `ctx.applyNumericSetting()` for every `SettingsField` key. A DemoAI that only generates gestures and never cycles settings or styles is incomplete. See `AmoebaLampDemoAI.ts` and `HarmonicSandDemoAI.ts` as canonical examples.
12. **Configuration UI rule** — simulation-specific configurators (style picker, parameter sliders) must be horizontally centered on screen. Only utility controls (quality selector, reset, settings, hide-UI, demo) belong in the top-right corner.
13. **Live settings polling rule** — `onEnter()` reads settings once at startup. To make sliders reactive, the scene **must** poll every `SettingsField` in `update()` each tick, compare against a cached `last*` field, and call a model setter (or rebuild the model) when the value changes. Never assume settings values are stable after `onEnter()`. See `HarmonicSandScene.update()` as the canonical example.
14. **Resolution setting rule** — every simulation that has a grid, field, or trail column dimension **must** expose it as a `SettingsField` with `key: 'resolution'`, `label: 'Resolution'`, `type: 'number'`, `min: 32`, `max: 512`, `step: 32`. No other key names (`fieldColumns`, `gridColumns`, `trailColumns`, `fieldResolution`, etc.) are permitted. The internal model option that receives this value may keep its own field name (e.g. `columns`, `trailColumns`) — only the *settings key* must be `'resolution'`. DemoAI overhauls must call `applyNumericSetting('resolution', value)` accordingly.
15. **Renderer family rule** — choose the renderer that matches the simulation primitive before writing scene code. Use `FieldPaletteRenderer` only for intentional scalar/wave/heat-field visualization; use `DensityMetaballRenderer` for blobs/metaballs; `TrailFeedbackRenderer` for pheromones, echoes, scars, orbital dust, and other persistent trails; `MeshLatticeRenderer` for triangular grids/crystals/fungal lattices; `ArcLineRenderer` for plasma branches, discharges, and streaks; and `ParticlePointRenderer` for agent/debris overlays. Do not default to `SimulationCanvasLayer.renderField()` as a lowest-common-denominator renderer.

## Do Not

- Do not attach Pixi filters to individual particles or cells.
- Do not create one Pixi display object per scalar-field cell.
- Do not hardcode style behavior into simulation logic.
- Do not bypass `RenderTargetPool` for persistent or transient render targets.
- Do not allow unbounded particle, branch, trail, or cell growth.
- Do not add simulation-specific global state.
- Do not use raw DOM APIs for debug visualization.
- Do not import `pixi.js` or `planck` directly in simulation content.
- Do not use `resolution` as a visual smoothness escape hatch; renderer quality should come from the appropriate core renderer family.

## Validation

Before marking a simulation complete:

```bash
pnpm --filter @hooksjam/pixi-lab-simulations typecheck
pnpm --filter @hooksjam/pixi-lab-simulations build
pnpm test
```

Then update `pixijs_simulation_tracking_system_v1.md` with status, checklist ticks, and implementation notes.
