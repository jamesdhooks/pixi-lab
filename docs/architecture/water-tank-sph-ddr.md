# Water Tank SPH double-density-relaxation path

The Water Tank scene uses an original raw WebGL2 particle-liquid implementation inspired by Eric Arnebäck's `gl-water2d` project:

https://github.com/Erkaman/gl-water2d

The reference implementation uses a spatial hash, particle neighbors, viscosity impulses, density and near-density accumulation, and Double Density Relaxation. Pixi Lab's current stable path adapts those ideas into the project raw WebGL scene contract:

- CPU particle arrays own the authoritative simulation state.
- A typed-array spatial hash replaces object/`Map` neighbor buckets for the hot broadphase.
- The solver applies persistent double-density-relaxation displacement, viscosity impulses, gravity, bounds, and capsule-like obstacle contacts.
- The live particle state is uploaded into a WebGL float texture for rendering.
- The render pass turns the density field into particle, surface, or glass styles.

This is not a verbatim port of the source. It preserves the reference model's useful concepts while keeping Pixi Lab's preview mode, demo AI, settings drawer, palette/style UI, debug stats, and raw renderer lifecycle.

The scene should report `gpuSimulated: false` and `gpuRendered: true` until a GPU-authoritative neighbor-grid solver is both implemented and proven visually stable. Do not expose GPU-resident-list settings unless the active solver actually consumes them.

The intended future GPU path should move the typed-array broadphase and pressure/viscosity passes into texture passes behind an internal comparison switch. It should not replace the stable CPU path until it matches the reference behavior and exposes spatial-completeness/overflow telemetry.

Attribution note: `gl-water2d` is MIT licensed. If future work copies upstream source directly, preserve the upstream copyright/license notice beside that copied source.
