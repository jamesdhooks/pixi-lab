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

## Do Not

- Do not attach Pixi filters to individual particles or cells.
- Do not create one Pixi display object per scalar-field cell.
- Do not hardcode style behavior into simulation logic.
- Do not bypass `RenderTargetPool` for persistent or transient render targets.
- Do not allow unbounded particle, branch, trail, or cell growth.
- Do not add simulation-specific global state.
- Do not use raw DOM APIs for debug visualization.
- Do not import `pixi.js` or `planck` directly in simulation content.

## Validation

Before marking a simulation complete:

```bash
pnpm --filter @hooksjam/pixi-lab-simulations typecheck
pnpm --filter @hooksjam/pixi-lab-simulations build
pnpm test
```

Then update `pixijs_simulation_tracking_system_v1.md` with status, checklist ticks, and implementation notes.
