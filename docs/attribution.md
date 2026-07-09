# Attribution

These scenes are inspired by or adapted from the references below. Unless a section explicitly says otherwise, Pixi Lab is not a one-to-one source port: each scene includes original creative choices, controls, rendering approaches, simulation tuning, palettes, preview/demo behavior, and integration into the Pixi Lab engine.

## Lava Lamp

The Lava Lamp visual direction was inspired by:

- Project: [WebGL Lava Lamp](https://github.com/brybrant/lava-lamp)
- Author: Matt Bryant
- Demo: [brybrant.github.io/lava-lamp](https://brybrant.github.io/lava-lamp/)
- Repository: [brybrant/lava-lamp](https://github.com/brybrant/lava-lamp)
- License: [GPL-3.0](https://github.com/brybrant/lava-lamp/blob/master/LICENSE)

The adapted ideas include the shaded lava-lamp visual direction, palette direction, and animated wax motion. The implementation in this repository uses Pixi Lab's raw WebGL2 `RawParticleMetaballScene` architecture, thermal particle model, shared liquid-surface renderer, custom settings, and demo automation.

## gl-water2d

The Water Tank SPH-style particle fluid path was inspired by:

- Project: [gl-water2d](https://github.com/Erkaman/gl-water2d)
- Author: Eric Arnebäck
- Repository: [Erkaman/gl-water2d](https://github.com/Erkaman/gl-water2d)
- License: [MIT](https://github.com/Erkaman/gl-water2d/blob/master/LICENSE)

The adapted ideas include spatially local particle interaction, density and near-density accumulation, viscosity impulses, Double Density Relaxation, capsule-style obstacle thinking, and particle-fluid rendering structure. The implementation in this repository is an original CPU SPH-style simulation with raw WebGL texture rendering, custom tools, palettes, and demo behavior integrated into the `@hooksjam/pixi-lab` scene model, not copied source code.

## WebGL Fluid Simulation

The Fluid Tank post-processing pipeline was inspired by and adapted from:

- Project: [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
- Author: Pavel Dobryakov
- Repository: [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
- License: [MIT](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/LICENSE)

The adapted ideas include dye-gradient surface shading, bloom prefilter/blur/composite staging, and sunray-style radial light accumulation. The implementation in this repository adds Pixi Lab-specific scene styles, palettes, input controls, demo automation, and raw WebGL2 renderer integration.

MIT License notice for the upstream project:

Copyright (c) 2017 Pavel Dobryakov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## GPU Fluid Experiments

Particle Fluid is inspired by and adapts the velocity-field execution model, particle motion palette, and HTML5 demo reference from:

- Project: [GPU Fluid Experiments](https://github.com/haxiomic/GPU-Fluid-Experiments)
- Author: [Haxiomic](https://github.com/haxiomic)
- Demo: [HTML5 WebGL Fluid Experiment](https://haxiomic.github.io/GPU-Fluid-Experiments/html5/)
- Repository: [haxiomic/GPU-Fluid-Experiments](https://github.com/haxiomic/GPU-Fluid-Experiments)
- License: [GPL-3.0](https://github.com/haxiomic/GPU-Fluid-Experiments/blob/master/LICENSE.txt)

No source code from the GPL project is vendored or copied into this repository. The Pixi Lab scene uses its own raw WebGL2 particle solver, settings, palettes, preview behavior, creative tuning, and demo automation.

## Splash

Splash MPM is an original Pixi Lab 2D particle-grid fluid implementation inspired by:

- Project: [Splash](https://github.com/matsuoka-601/Splash)
- Author: [matsuoka-601](https://github.com/matsuoka-601)
- Demo: [splash-fluid.netlify.app](https://splash-fluid.netlify.app/)
- Repository: [matsuoka-601/Splash](https://github.com/matsuoka-601/Splash)
- License: [MIT](https://github.com/matsuoka-601/Splash/blob/main/LICENSE)

The adapted ideas include MLS-MPM-style particle/grid transfer, APIC-like affine velocity transfer, a single-substep real-time bias, density-grid rendering, and a smoothed screen-space fluid surface. The implementation in this repository is a new 2D raw WebGL2 scene with Pixi Lab-specific controls, styles, palettes, and liquid-renderer augmentation; it does not copy the upstream WebGPU/WGSL source.
