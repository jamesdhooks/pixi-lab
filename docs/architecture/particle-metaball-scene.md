# Raw Particle Metaball Scene

`RawParticleMetaballScene` is the shared raw WebGL scene used by the Lava Lamp and Water Tank simulations.

## Purpose

Use this scene for simulations that share dense particle state, raw WebGL rendering, and compact pointer/tool contracts. Water Tank uses the particle-density path directly; Lava Lamp uses the same scene lifecycle with a fullscreen raymarch shader for the visible wax.

Good fits:

- Thermal wax blobs with clumping and buoyancy.
- Lightweight particle water with fixed circular/line obstacles.
- Future particle soups where circle particles remain the simulation primitive.

Poor fits:

- Pressure-accurate SPH fluids that need full GPU texture-state integration.
- Rigid bodies with angular inertia.
- Topological grids such as mycelium, cellular automata, or reaction diffusion.

## Current architecture

- Simulation integration: CPU spatial grid.
- Particle upload: CPU to GPU dynamic float buffer.
- Rendering: raw WebGL2 point sprites with metaball/density-style fragment shading, or a preset-specific fullscreen raymarch shader.
- Debug stats must identify this honestly as `gpuRendered: true` and `gpuSimulated: false`.

This is still GPU-accelerated in the expensive visual composition path, but it is not a full GPU simulation backend yet.

## Lava Lamp Attribution

The Lava Lamp visual direction is inspired by Matt Bryant's WebGL Lava Lamp project:

- Repository: https://github.com/brybrant/lava-lamp
- Demo: https://brybrant.github.io/lava-lamp/

Bryant's project credits its fragment shader as being based on Arrangemonk's Shadertoy raymarch lava lamp shader. The pixi-lab implementation adapts that raymarch structure into this repo's raw WebGL2 scene lifecycle, while the shared scene continues to own settings, input, preview, and debug stats.

## Shared behavior

The shared scene owns:

- Particle buffers.
- Obstacle buffers.
- Pointer coordinate handling.
- Preview-safe seeding.
- Mode-aware interaction feedback.
- Spatial-grid pair solving.
- Raw WebGL shader setup.
- Debug stats.

Scene definitions own:

- Palette manifests.
- User-facing settings fields.
- Demo AI behavior.
- Input mode labels.
- Simulation metadata and caveats.

## Settings contract

Do not expose generic `renderScale` in scene settings. Point/metaball scale is renderer-owned and derived from render style.

Use scene-specific controls instead:

- Lava Lamp: thermal motion, clumping, surface tension, thermal contrast.
- Water Tank: particle size, viscosity, tank layout, pour/build/interact controls.

Input-tool-specific controls belong under `section: 'Input Mode'` and must use `visibleModes`.

## Demo contract

Preview tiles and demo mode should use the same definition-level `demoAiFactory`.

Lava Lamp demo AI should demonstrate:

- Paired hot/cold thermal input.
- Circulation.
- Visible clumping/rising/falling behavior.

Water Tank demo AI should demonstrate:

- Pouring.
- Reset-time randomized tank layouts.
- Water colliding with static obstacles.

## Future GPU path

If this scene moves to full GPU simulation, prefer extending a texture-state backend rather than replacing scene definitions.

The public contract should remain:

- Same simulation IDs.
- Same palette manifests.
- Same input modes.
- Same settings semantics where possible.
- More accurate debug stats when `gpuSimulated` becomes true.
