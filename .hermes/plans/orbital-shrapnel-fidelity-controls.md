# Orbital Shrapnel high-fidelity WebGL plan

## Source references

Reference commit: `218eebcb711b4ff764a6e785d061d76e9bce17af` (`reference (sims) webgl fidelity examples`).

Reference labs inspected:

- `reference/orbital_shrapnel_field_fidelity_lab_fixed.html`
- `reference/harmonic_sand_plate_fidelity_lab.html`

## Extracted Orbital Shrapnel controls

### Keep in normal UI

These are direct-feel controls that affect the user's current interaction or obvious visual result:

- `style` — Ice Ring / Solar Debris / Black Hole Lens.
- `shape` — soft triangular shards, round dust, spark crosses, hard triangle, hard circle, hard square.
- `gravity` — central gravity.
- `tangent` — orbital tangent bias.
- `damping` — velocity damping.
- `maxSpeed` — velocity clamp; ref default `2.30`, range `0.25..8`, step `0.05`.
- `timeScale` — slow/freeze/accelerate simulation.
- `swish` — pointer swish force.
- `well` / `wellRadius` / `pointerVortex` — hold gravity-well feel.
- `shockStrength` / `shockSpeed` / `meteorCount` — event/director controls.
- `particleSizePx` / `speedSize` — debris size/readability.
- `trail` / `blur` — trail persistence/diffusion.
- `particleBrightness` / `glow` / `exposure` / `chroma` / `stars` — visible scene look.

### Move to Advanced under settings cog

These are performance, allocation, and low-level compositing controls:

- `particleSize` — GPU state texture size; particle count = width × height. Reference tiers: `64²` through `8192²`, including extreme/brutal/severe/danger tiers. Must be guarded by memory/device checks.
- `precision` — `RGBA32F` stable vs `RGBA16F` lower bandwidth.
- `renderFraction` — draw only a fraction of simulated particles.
- `simSubsteps` — simulation substeps/frame.
- `motionBlurSamples` — 1..32.
- `streakLength` — velocity streak length.
- `trailFadePasses` — trail diffusion passes.
- `bloomSamples` — 0..48.
- `bloomRadius` — 1..24.
- `dprCap` — 0.75..3.
- `trailScale` — trail buffer scale.
- `bodyCount` / `bodyStrength` / `bodyRadius` / `bodySpeed` — extra gravity bodies; visually interesting but stress-prone and should be advanced until defaults are tuned.
- `boundaryPull` / `planetRadius` / `planetBounce` — simulation boundary/collider tuning.
- `trailAlpha` / `liveAlpha` — draw/composite internals.

## Extracted Harmonic Sand controls

The current Harmonic Sand Plate version already has the right core feel; use the reference as an advanced fidelity catalog, not as a rewrite target.

### Candidate normal UI controls

- `styleMode` — Chladni Gold / Laser Plate / Ghost Frequency / Black Sand Neon.
- `modeN` / `modeM` — primary standing wave modes.
- `secondaryN` / `secondaryM` / `secondaryMix` — secondary mode blend.
- `waveAmplitude`, `frequency`, `sweepAmount`, `sweepSpeed`, `timeScale`.
- `nodeAttraction`, `jitter`, `grainDrag`.
- `pointerRadius`, `pointerForce`, `holdAmplify`, `directorSweep`.
- `waveVisibility`, `contourBands`, `nodeLineSharpness` if exposed as visual composition controls.

### Candidate advanced controls

- `particleSize`, `statePrecision`, `renderFraction`, `simSubsteps`.
- `motionBlurSamples`, `trailScale`, `trailBlurPasses`, `dprCap`.
- `grainShape`, `grainSize`, `trailPersistence`, `trailDiffusion`, `trailAlpha`, `liveAlpha`, `streakLength`.
- `bloomSamples`, `bloomRadius`, `exposure`, `chroma`.
- `plateTiltX`, `plateTiltY`, `boundaryBounce`.

## Architecture enhancement needed

Current `SettingsField` supports `visibleModes`, `visibleEngineConfigurations`, and `visibleQualities`, but not control grouping. `SettingsDrawer` renders all experience fields under a single `Experience` heading. To support James's desired split cleanly:

1. Extend `SettingsField` with optional metadata:
   - `section?: 'normal' | 'advanced' | string`
   - `risk?: 'safe' | 'heavy' | 'extreme'`
   - `requiresConfirmation?: boolean`
2. Update `SettingsDrawer` to render:
   - `Experience` for normal fields.
   - Collapsed `Advanced` panel under the cog for advanced fields.
   - Optional warning labels for high-allocation controls.
3. Add runtime guard utilities for raw WebGL simulations:
   - Estimate state texture bytes using particle texture size, precision, ping-pong buffers, trail buffers, bloom buffers, and DPR.
   - Cap default extreme options by device profile.
   - Fail gracefully to the previous safe setting when allocation fails.
4. Keep `visibleEngineConfigurations: ['raw']` on WebGL-only controls so Pixi/basic profiles stay terse.

## Scene adaptation assessment

### Highest priority raw/high-performance candidates

- `orbital-shrapnel`: already raw-capable and maps directly to GPU particle state, trails, bloom, and high-count controls. Best first target.
- `harmonic-sand`: already raw-capable and close to the reference; add guarded advanced fidelity controls later, preserving current core behavior.
- `fluid-tank`: already raw-capable; benefits from GPU-only dye/velocity controls and runtime safety, but current priority is interaction semantics.
- `amoeba-lamp`: already raw-capable; candidate for state-texture fidelity tiers and advanced field/particle density controls.

### Good second-wave candidates

- `proto-galaxy-forge`: particle/field/glow scene; likely strong fit for GPU particle state and bloom pipeline.
- `cosmic-ink-ocean`: particle/field behavior; likely fit for GPU advection/feedback rendering.
- `electro-osmotic-amoeba`: particle/field behavior; likely fit after common field-kernel abstraction exists.
- `chromatic-avalanche-bowl`: particle/glow scene; candidate for GPU particle density and trails.
- `time-echo`: particle/trail scene; candidate for trail buffer and motion-blur architecture.
- `plasma-branch` and `turing-skin`: trail/field scenes; candidate for feedback buffer architecture.

### Lower priority / needs design first

- `alien-vascular-tree`, `cellular-ocean`, `crystal-plasma`, `jelly-web`, `living-voronoi-tissue`, `mycelium-lattice`, `mycelium-prism`, `neon-river-delta`, `oil-water-universe`, `prism-pool`: mostly field/mesh/procedural visual systems. They may benefit from shared post-processing, DPR guards, and feedback buffers, but do not map as directly to the high-count GPU particle architecture.
- `ant-signal`: trail/field system; likely needs agent-specific rules before raw conversion.

## First Orbital Shrapnel implementation slice

Goal: add the first safe, visible fidelity improvement without destabilizing all settings/UI.

### Slice: GPU particle/fidelity preset foundation

1. Add a typed raw fidelity config adapter for Orbital Shrapnel:
   - `particleTextureSize`
   - `statePrecision`
   - `renderFraction`
   - `simSubsteps`
   - `motionBlurSamples`
   - `trailBufferScale`
   - `bloomSamples`
   - `bloomRadius`
   - `dprCap`
2. Keep normal defaults conservative:
   - Default particle texture at current safe tier or reference `192²` if compatible.
   - Hide extreme tiers in `Advanced` until allocation guards land.
3. Implement allocation guard:
   - Estimate GPU memory before reallocating particle state/trail buffers.
   - Attempt allocation in a try/catch and revert to prior texture size on failure.
   - Surface a compact warning in debug stats.
4. Update Orbital raw renderer:
   - Rebuild particle state textures on `particleTextureSize` or precision changes.
   - Respect `renderFraction` in draw count.
   - Support `simSubsteps` in update loop.
   - Add initial `motionBlurSamples`/`streakLength` rendering hook, even if first pass maps samples conservatively.
5. Update UI metadata after field grouping lands:
   - Normal: look/feel, physics, pointer/event controls.
   - Advanced: particle texture, precision, render fraction, substeps, DPR, bloom/trail buffer internals.
6. Verification:
   - `pnpm typecheck`
   - `pnpm build`
   - Manual smoke in raw Orbital Shrapnel: default, 256², 512², high render fraction, low render fraction, allocation failure fallback.

## Notes

- Do not import all extreme reference tiers at once without guardrails. `4096²+` can be severe/absurd/dangerous and should require a warning or hidden dev flag.
- Keep Harmonic Sand's current behavior as the baseline; borrow controls selectively.
- Fluid Tank semantics are separate: `Stir` must be velocity-only, `Inject` must add dye/color.
