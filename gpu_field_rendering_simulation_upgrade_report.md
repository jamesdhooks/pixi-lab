# GPU Field Rendering and Simulation Upgrade Report

## Context

This report evaluates whether the PixiJS/WebGL fluid-rendering approach used in the recent bounded fluid demo can be generalized to other simulation types in the provided simulation catalogue. The short answer is yes: the core technique is not limited to fluids. The reusable idea is to keep the simulation cheap, but render it as high-quality continuous fields using GPU textures, feedback buffers, gradients, fake normals, contours, bloom, and compositing.

The catalogue currently includes many simulations that run on particles plus a low-resolution grid render layer. That architecture is often computationally reasonable, but it can look visually poor when the low-resolution grid is rendered literally. The strongest recommendation is not necessarily to increase simulation resolution. Instead, the simulation should produce data fields that are then rendered through higher-quality GPU visualization passes.

---

# The Big Principle

Right now, many catalogue items appear to follow this pipeline:

```text
particles / low-res grid
        ↓
draw particles or draw blocky cells
        ↓
looks cheap
```

The better architecture is:

```text
particles / agents / grid / graph
        ↓
splat or solve into GPU fields
        ↓
post-process into a continuous visual surface
        ↓
fake lighting, normals, contours, glow, trails, refraction
        ↓
looks rich
```

The fluid technique generalizes into several adjacent techniques:

```text
fluid advection        → move colour, charge, heat, nutrients, smoke, trails
reaction-diffusion     → skin, mold, oil/water, chemistry, growth fronts
metaball/SDF fields    → blobs, cells, membranes, soft organisms
height fields          → water, ripples, erosion, caustics, sand ridges
trail feedback buffers → ants, shrapnel, plasma scars, temporal ghosts
field-guided particles → particles become sources/samplers, not the final look
graph + field render   → branches/webs/crystals rendered with glow/stress fields
```

Several catalogue items are direct field candidates. For example:

- **Mycelium Prism** uses a triangular grid, nutrient field, and active frontier.
- **Amoeba Lamp / Metaball Biosoup** uses blob particles, a density field, and a heat field.
- **Electro-Osmotic Amoeba** uses density and charge fields.
- **Harmonic Sand Plate** uses particles plus a wave field.

These are exactly the kinds of systems that benefit from a GPU field-composite renderer rather than a visible low-resolution grid.

---

# The Most Important Rendering Upgrade

The single biggest upgrade is this:

> Treat the simulation grid as **data**, not as pixels.

A 128×128 simulation can look awful if you draw 128×128 squares. But the same 128×128 simulation can look beautiful if you render it through:

```text
bilinear sampling
gradient-based normals
palette mapping
threshold contours
edge glow
temporal accumulation
blue-noise dithering
bloom
distortion/refraction
```

For example, instead of rendering nutrient cells as little triangles, render a smooth nutrient scalar field. Compute its gradient:

```text
normal-ish vector = ∇nutrient
```

Then use that gradient for lighting, glow edges, vein highlights, and contour bands. The simulation is still cheap, but the output looks continuous.

---

# Recommended Shared Renderer Architecture

I would build one reusable **FieldRenderer** layer that every simulation can use.

Conceptually:

```js
class FieldRenderer {
  scalarA;      // density, nutrient, charge, heat, pheromone, etc.
  scalarB;      // ping-pong target
  vectorA;      // optional velocity / flow field
  vectorB;
  trailA;       // persistent feedback buffer
  trailB;
  material;     // optional labels / domains / regions
  normal;       // derived gradient/normal pass

  splat();
  diffuse();
  advect();
  decay();
  blur();
  computeGradient();
  shadeScalar();
  shadeMetaballs();
  shadeContours();
  shadeRefraction();
  compositeBloom();
}
```

Each simulation still owns its behavior, but when it wants to become visible, it writes into one or more fields:

```text
particles       → splat density / heat / light into a texture
agents          → deposit pheromone / trail / influence into a texture
grid cells      → upload scalar state into a texture
graph edges     → render into a trail/glow buffer
velocity field  → advect dye, trails, nutrients, charge, smoke
```

Then the renderer turns those fields into something high-fidelity.

---

# Best Candidates for the Fluid-Style Treatment

## 1. Cosmic Ink Ocean — Direct Fluid Upgrade

This is the most obvious reuse of the fluid demo. The catalogue already describes it as turbulence, vortices, dye advection, particles, vector fields, and trails, with a trail feedback composite.

I would not keep this as “fake fluid only.” I would make it a lighter version of the fluid renderer:

```text
velocity field
dye field
curl/vorticity pass
trail feedback
distortion composite
palette map
```

Particles can exist, but only as tracers or input sources. The beauty should come from the advected dye/trail field.

**Best visual upgrade:** full-screen dye advection + feedback trails + bloom.

**Interaction:** drag injects directional velocity; hold creates a contained vortex.

**Likely result:** very close to the iPad fluid-art feel, but with more cosmic/smoke styling.

---

## 2. Amoeba Lamp / Metaball Biosoup — Density-Field Metaballs

This one should absolutely move away from visible particles. The catalogue already calls for blob particles, density field, heat field, metaball density pass, and membrane composite.

Recommended architecture:

```text
blob particles
    ↓ splat into density field
density field
    ↓ threshold / smoothstep
membrane mask
    ↓ gradient normals
fake 3D blobby surface
```

You do not render the particles. You render the **implicit surface** formed by their density.

Shader idea:

```glsl
float d = texture(density, uv).r;

float body = smoothstep(0.45, 0.55, d);
float edge = smoothstep(0.40, 0.55, d) - smoothstep(0.55, 0.70, d);

vec2 grad = vec2(
  sample(density, uv + x) - sample(density, uv - x),
  sample(density, uv + y) - sample(density, uv - y)
);

vec3 normal = normalize(vec3(-grad.x, -grad.y, 0.25));
```

Then use `normal` for fake lighting. That gives the “living lava lamp organism” look without needing high particle counts.

**Best visual upgrade:** metaball surface + fake normals + membrane glow + heat refraction.

---

## 3. Oil-Water Universe — Phase-Field Rendering

This is a very strong candidate. The catalogue describes immiscible domains, phase separation, boundary tension, a material grid, concentration field, and edge/metaball boundaries.

This should use a **phase field** rather than particles.

Represent oil/water as a scalar:

```text
c = -1.0  → water
c =  1.0  → oil
c =  0.0  → boundary
```

Then simulate:

```text
diffusion
phase separation
boundary smoothing
optional advection by velocity
```

Render:

```text
material palette from c
boundary glow at abs(c) near 0
fake normals from gradient(c)
oil-slick hue from gradient angle / thickness
```

This could look much better than a grid even at low resolution because the boundaries become smooth implicit curves.

**Best visual upgrade:** phase-field domains with glowing boundaries and oil-slick interference palette.

---

## 4. Turing Skin — Reaction-Diffusion Shader Sim

This one almost begs for a GPU texture solver. The catalogue has it as reaction-diffusion/morphogenesis with low-resolution chemical fields, scalar visualization, contour bands, and palette mapping.

Reaction-diffusion is usually a ping-pong texture simulation:

```text
chemical A texture
chemical B texture
diffusion + reaction step
swap
```

Rendering should not show cells. It should show:

```text
chemical concentration
palette ramp
contour lines
embossed normal from gradient
subtle temporal parameter drift
```

This can look extremely high-end with very little CPU.

**Best visual upgrade:** full-screen reaction-diffusion field with palette mapping, contours, and fake skin normals.

---

## 5. Ant Signal Civilization — Pheromone Field Feedback

The catalogue defines this as agents plus pheromone field, trail field composite, bloom, and trail feedback.

This should stay agent-based, but the visible layer should be a **pheromone texture**, not individual ant dots.

Architecture:

```text
ants move on CPU or GPU
ants sample pheromone texture
ants deposit into pheromone texture
pheromone diffuses / decays
renderer shades pheromone roads
```

The ants can be tiny, subtle glints. The hero visual is the trail network.

Render pheromones as:

```text
low value  → transparent
medium     → soft glowing path
high       → hot neon vein
gradient   → directional shimmer
```

**Best visual upgrade:** glowing road networks rendered from a feedback buffer.

---

## 6. Mycelium Prism — Nutrient/Growth Field Composite

Mycelium Prism uses a triangular grid, nutrient field, active frontier, grid mesh, pulse trail layer, palette map, edge glow, bloom, and contour bands.

This is a perfect example of where the simulation grid should not be the final image.

Keep the triangular growth logic, but render into fields:

```text
strain ID field
nutrient field
age/decay field
vein activity field
pulse trail field
```

Then shade it like:

```text
veins = threshold(activity)
glow = blur(veins)
decay = dark mottled texture
nutrient = contour/palette background
strain boundaries = edge glow
```

The triangular grid can remain as a subtle structural hint, but not as chunky cells.

**Best visual upgrade:** active-frontier growth drawn as smooth neon veins over a nutrient heatmap.

---

## 7. Prism Pool — Height-Field Refraction

This one is explicitly field-based: density/height field, refractive composite, fake normals, chromatic split.

This is not a fluid simulation in the Navier-Stokes sense. It is more like a **ripple height-field renderer**:

```text
height texture
velocity/previous height texture
wave equation step
normal = gradient(height)
distort background by normal
add caustic highlights
```

This can look excellent with very cheap simulation.

**Best visual upgrade:** background refraction + chromatic split + caustic shimmer from height-field gradients.

---

## 8. Neon River Delta — Height/Sediment Field

The catalogue defines this as erosion, sediment deposition, downhill flow, height field, sediment field, terrain composite, contour bands, and bloom rivers.

This one should use multiple scalar fields:

```text
height
water
sediment
flow direction
erosion/deposition
```

Even if the physics is simplified, the rendering can be beautiful:

```text
terrain normals from height gradient
water mask from water field
river glow from flow speed
sediment colour from sediment amount
contour bands from height
```

**Best visual upgrade:** make the low-resolution terrain look high-resolution through normal reconstruction, contours, and glowing river masks.

---

## 9. Plasma Branch Terrarium — Frontier + Scar Field

This one has charge grid, arc mesh, scar trail, line mesh + glow composite, and frontier propagation.

Do not use a fluid solver here. Use a **growth/frontier simulation plus feedback buffers**.

Architecture:

```text
charge field
frontier list
arc mesh
scar field / burn texture
glow blur
```

Every discharge writes into a scar buffer. That buffer decays slowly and influences future arcs.

Render:

```text
thin hot line
wide blurred glow
persistent scar
charge-field background
shockwave ring on discharge
```

**Best visual upgrade:** decaying scar texture + multi-pass glow around arc mesh.

---

## 10. Crystal Plasma Storm — Triangular Field but High-End Shading

The catalogue calls this an electric crystal growth/fracture system on a triangular grid with stress field, crystal mesh, discharge overlays, facet lighting, cracks, and bloom.

This should not be smoothed into a fluid. The triangular structure is part of the identity.

But you can use adjacent field techniques:

```text
stress field
crack mask
charge field
facet normal field
glow/discharge overlay
```

Render each triangle as a facet with lighting based on crystal orientation/stress, then use a crack mask and charge glow.

**Best visual upgrade:** keep hard geometry, but add stress-field lighting, glowing cracks, and discharge feedback.

---

# Mid-Tier Candidates

These can benefit, but the simulation/render split needs more care.

## Jelly Web Resonator

This is springs, nodes, line mesh, stress propagation, line renderer, pulse overlays, glow, stress palette, and trails.

Keep the spring mesh. Do not turn it into a fluid. But render stress into a trail/glow field:

```text
spring stress → line colour/thickness
node velocity → pulse particles
stress waves → blurred trail buffer
```

The field layer makes the web feel energetic without increasing node count.

---

## Cellular Ocean

This uses spring-ring cells, nutrient particles, membrane shading, fake normals, contours, and bloom, with a note to avoid true fluid simulation.

That note is correct. I would not make this a real fluid. I would render each cell as an implicit membrane:

```text
cell rings / particles
    ↓
signed distance or density mask
    ↓
membrane normal + thickness shading
```

Nutrients can be a scalar field. Cells sample the nutrient field; the renderer shades membranes and nuclei.

---

## Living Voronoi Tissue

This has Voronoi seeds, pressure field, Voronoi visualization, membrane glow, and contour shading.

This should use a shader Voronoi pass:

```text
site positions
nearest-site field
second-nearest distance
boundary = second - first
pressure = colour/thickness/glow
```

Low site count is fine if the shader makes the boundaries beautiful.

---

## Alien Vascular Tree

This is a branch graph with nutrient field, line mesh rendering, pulse glow, and thickness shading.

Keep it graph-based. Add a nutrient scalar field and render branches with:

```text
signed-distance line tubes
flow pulse texture
blurred glow buffer
branch thickness from nutrient/age
```

---

## Chromatic Avalanche Bowl

This uses particles, density buckets, particle + dust composite, glow ridges, and dust bloom.

This is another “particles drive fields” case:

```text
granular particles
    ↓
splat density/velocity/dust into fields
    ↓
render ridges, dust clouds, compaction maps
```

Do not render every grain as the main image unless you have a very specific sand aesthetic. Render mass/ridge/dust fields.

---

# Particle-Heavy Systems That Still Benefit

## Orbital Shrapnel Field

This one uses particles, velocity, trail field, custom triangle mesh, trail buffer, trail feedback, bloom, shockwaves, and chromatic edges.

Here the particles are essential. But the expensive/beautiful part should be the trail buffer.

Architecture:

```text
instanced triangle particles
trail feedback texture
velocity streak pass
shockwave postprocess
bloom
```

Each debris triangle writes motion into a trail field. The field gives you dust, arcs, and orbital streaks. The particles supply crisp geometry.

---

## Proto-Galaxy Forge

This uses particles, gravity wells, particle mesh + trails, bloom, lens distortion, and avoids all-pairs gravity.

Same idea:

```text
particles = stars
trail field = accretion glow
density field = galactic arms
gravity wells = force sources
```

A density/trail field can make a few thousand particles look like a million-star nebula.

---

## Time Echo Particles

This has particles, history buffers, echo trail composites, chromatic aberration, and shockwaves.

This should use temporal feedback aggressively:

```text
current particle pass
previous frame trail buffer
older echo buffers
chromatic time offsets
shockwave displacement
```

This is not a fluid problem; it is a **history-buffer rendering** problem.

---

# Ranking: Best ROI Upgrades

If I were prioritizing which demos to upgrade first, I would do:

| Priority | Simulation | Best technique | Why |
|---:|---|---|---|
| 1 | **Cosmic Ink Ocean** | Fluid-style dye/vector field | Direct reuse of the Pixi fluid work |
| 2 | **Amoeba Lamp / Metaball Biosoup** | Metaball density + membrane shader | Huge visual payoff from density fields |
| 3 | **Oil-Water Universe** | Phase-field domains | Perfect for smooth boundaries and edge glow |
| 4 | **Turing Skin** | Reaction-diffusion texture solver | Cheap, procedural, highly aesthetic |
| 5 | **Ant Signal Civilization** | Pheromone feedback field | Turns low-res trails into glowing emergent networks |
| 6 | **Prism Pool** | Height-field refraction | Simple sim, beautiful shader output |
| 7 | **Mycelium Prism** | Growth field + vein/glow composite | Strong catalogue fit; hides triangular grid ugliness |
| 8 | **Plasma Branch Terrarium** | Frontier + scar feedback | High visual drama, modest physics |
| 9 | **Neon River Delta** | Height/sediment fields | Good but needs more careful UX |
| 10 | **Orbital / Galaxy / Time Echo** | Particle-to-trail field composite | Still particle-based, but can look much richer |

---

# Reusable Rendering Pipelines to Define

Instead of writing twenty bespoke renderers, I would create maybe **six visual engines** and map the catalogue onto them.

## 1. Field Advection Engine

For:

```text
Cosmic Ink Ocean
Oil-Water Universe
Amoeba heat fields
Mycelium nutrient smearing
Ant pheromone diffusion
```

Core passes:

```text
splat input
advect by velocity
diffuse
decay
curl/noise optional
shade field
```

This is the closest sibling to the fluid demo.

---

## 2. Metaball / Implicit Surface Engine

For:

```text
Amoeba Lamp
Electro-Osmotic Amoeba
Cellular Ocean
Oil-Water boundaries
```

Core passes:

```text
splat particles to density
blur / smooth density
threshold into body mask
compute gradient normals
edge glow
membrane composite
```

This hides particle ugliness extremely well.

---

## 3. Reaction-Diffusion / Cellular Field Engine

For:

```text
Turing Skin
Oil-Water Universe
Mycelium texture growth
Crystal surface patina
```

Core passes:

```text
chemical A/B ping-pong
laplacian convolution
reaction step
parameter drift
palette/contour render
```

This produces complex biological patterns from very simple state.

---

## 4. Height Field / Normal Engine

For:

```text
Prism Pool
Neon River Delta
Harmonic Sand Plate
Chromatic Avalanche Bowl
```

Core passes:

```text
height update
velocity/previous height
gradient normal
lighting/refraction
contour bands
caustics/glow
```

Great for anything with ripples, terrain, erosion, ridges, or resonance.

---

## 5. Trail Feedback Engine

For:

```text
Orbital Shrapnel Field
Ant Signal Civilization
Time Echo Particles
Proto-Galaxy Forge
Plasma Branch Terrarium
Alien Vascular Tree
```

Core passes:

```text
draw agents/lines into trail texture
decay
blur/diffuse
warp/distort
composite with bloom
```

This is the most broadly reusable visual trick in the catalogue.

---

## 6. Graph/Mesh + Field Hybrid Engine

For:

```text
Jelly Web Resonator
Alien Vascular Tree
Plasma Branch Terrarium
Crystal Plasma Storm
Living Voronoi Tissue
```

Core structure:

```text
real geometry for crisp structure
field buffer for glow/stress/scars/pulses
postprocess composite for richness
```

This keeps the identity of webs, branches, crystals, and arcs while avoiding flat line rendering.

---

# How to Avoid “Low-Resolution Grid Looks Garbage”

The low-resolution grid can stay. The mistake is displaying it literally.

Use this stack:

```text
1. Sim state texture, maybe 128–512 px
2. High-res full-screen render pass
3. Sample sim texture smoothly
4. Compute gradients from neighbouring samples
5. Use gradient for normals / edge detection
6. Apply palette map
7. Add contour bands selectively
8. Add bloom/glow from thresholded masks
9. Add subtle noise/dither to hide interpolation
10. Add temporal feedback for continuity
```

The result is that a low-resolution simulation becomes a high-resolution rendered surface.

For example:

```glsl
float field = texture(simTexture, uv).r;

float gx = texture(simTexture, uv + vec2(px, 0)).r
         - texture(simTexture, uv - vec2(px, 0)).r;

float gy = texture(simTexture, uv + vec2(0, py)).r
         - texture(simTexture, uv - vec2(0, py)).r;

vec2 grad = vec2(gx, gy);

float edge = length(grad);
float contour = smoothstep(0.02, 0.025, abs(fract(field * 12.0) - 0.5));

vec3 color = palette(field);
color += edge * glowColor;
color *= fakeLightingFromGradient(grad);
color += contour * contourColor;
```

That single pattern is useful across nutrients, chemicals, pressure, charge, height, pheromone, heat, density, stress, and material concentration.

---

# Practical Recommendation

I would not try to make every catalogue item into a fluid simulation. I would build a shared **GPU field/composite layer** and let each simulation plug into it.

The API could look like this:

```js
renderer.splatScalar("nutrient", x, y, amount, radius);
renderer.splatVector("velocity", x, y, dx, dy, radius);
renderer.drawTrail("pheromone", agentPositions);
renderer.drawLines("veins", branchSegments);
renderer.advect("dye", "velocity");
renderer.diffuse("charge", amount);
renderer.decay("trail", halfLife);
renderer.renderPreset("neon-membrane");
```

Then each simulation can be small and cheap:

```text
Ants decide where to walk.
Renderer makes their pheromones gorgeous.

Amoeba particles move around.
Renderer turns them into glowing membranes.

Mycelium frontier grows on a triangular grid.
Renderer turns it into veins, pulses, scars, and bloom.

River erosion updates height/sediment.
Renderer turns it into lit terrain and glowing water.
```

That is the pattern that will make the whole catalogue feel much more premium.

---

# Implementation Notes and Design Implications

## Simulation Resolution vs Rendering Resolution

The fluid demo shows the key separation:

```text
simulation resolution: small, cheap, data-focused
rendering resolution: full screen, high fidelity, shader-focused
```

This should become a standard architectural principle across the catalogue. Most simulations do not need high-resolution physics. They need high-resolution presentation.

Recommended defaults:

```text
Scalar simulation fields: 128–512 px depending on complexity
Trail fields: 512–1024 px depending on style
Final render pass: native canvas resolution
Bloom/glow passes: half-res or quarter-res
Normal/gradient pass: derived from scalar field, usually same as render target or half-res
```

## Particles Should Often Become Data Emitters

Particles are still useful, but they should often stop being the main visual layer.

Better pattern:

```text
particles move according to simulation rules
particles deposit into fields
fields are rendered beautifully
particles are optionally drawn as highlights
```

This applies especially to:

```text
Amoeba Lamp
Ant Signal Civilization
Proto-Galaxy Forge
Chromatic Avalanche Bowl
Orbital Shrapnel Field
Time Echo Particles
Harmonic Sand Plate
```

## Use Multiple Fields Per Simulation

The highest-end look usually comes from combining several fields, not one.

Examples:

```text
Amoeba:
- density
- heat
- charge
- membrane edge

Mycelium:
- nutrient
- strain ID
- activity
- decay
- pulse trail

River delta:
- height
- water
- sediment
- flow speed

Ant colony:
- pheromone
- food scent
- colony influence
- trail age
```

Each field does not have to be expensive. Even 128×128 fields can look rich when composited well.

## Keep Identity-Specific Geometry Where It Matters

Not every simulation should become smooth fluid. Some simulations need crisp structures.

Keep geometry for:

```text
Jelly Web Resonator: spring web lines
Alien Vascular Tree: branch graph
Crystal Plasma Storm: triangular crystal facets
Plasma Branch Terrarium: lightning arcs
Orbital Shrapnel Field: triangular debris
```

But add field layers behind and around the geometry:

```text
glow field
scar field
stress field
pulse trail field
charge field
```

That combination gives both readable structure and premium rendering.

---

# Appendix A: Original Simulation Catalogue

The following is the original pasted simulation catalogue used as the basis for this analysis. It is included so this Markdown file is self-contained.

 10. Simulation Catalog

---

## Mycelium Prism

### Concept

Triangular-grid fungal growth with spreading veins and competing strains.

### Core Physics / Behaviors

- growth fronts
- decay
- nutrient spread
- vein pulses

### Primary Data Structures

- triangular grid
- nutrient field
- active frontier

### Rendering Architecture

- grid mesh
- optional pulse trail layer

### Supported Shader Features

- palette map
- edge glow
- bloom
- contour bands

### Style Presets

- Neon Mold
- Rot Bloom
- Synaptic Fungus

### Shared Gestures

- tap seeds spores
- drag smears nutrients
- hold adds moisture

### Director Mode Events

- seed new colonies
- pulse active veins

### Performance Notes

- low-res grid
- frontier-only updates

### Feasibility

Very High

---

## Orbital Shrapnel Field

### Concept

Thousands of triangular debris particles orbiting a planet.

### Core Physics / Behaviors

- orbital motion
- gravity approximation
- collisions
- dust trails

### Primary Data Structures

- particles
- velocity
- trail field

### Rendering Architecture

- custom triangle mesh
- trail buffer

### Supported Shader Features

- trail feedback
- bloom
- shockwaves
- chromatic edges

### Style Presets

- Ice Ring
- Solar Debris
- Black Hole Lens

### Shared Gestures

- drag swishes debris
- hold creates gravity well

### Director Mode Events

- meteor showers
- gravity pulses

### Performance Notes

- custom mesh required
- avoid all-pairs gravity

### Feasibility

High

---

## Amoeba Lamp / Metaball Biosoup

### Concept

Glowing blob-like lava-lamp organisms formed from particle density fields.

### Core Physics / Behaviors

- surface tension
- buoyancy
- blob merging/splitting

### Primary Data Structures

- blob particles
- density field
- heat field

### Rendering Architecture

- metaball density pass
- membrane composite

### Supported Shader Features

- metaballs
- edge glow
- fake normals
- distortion

### Style Presets

- Bio Plasma
- Oil Slick
- Toxic Lagoon

### Shared Gestures

- drag stirs blobs
- hold heats blobs
- swipe splits

### Director Mode Events

- split oversized blobs
- inject heat plumes

### Performance Notes

- shader-heavy
- low-res density fields required

### Feasibility

High

---

## Electro-Osmotic Amoeba

### Concept

Charged amoeba blobs exchanging energy through membranes.

### Core Physics / Behaviors

- surface tension
- charge
- attraction/repulsion

### Primary Data Structures

- density field
- charge field
- nuclei

### Rendering Architecture

- density + arc overlay

### Supported Shader Features

- metaballs
- edge corona
- bloom
- arcs

### Style Presets

- Electric Cell
- Ion Lagoon
- Plasma Membrane

### Shared Gestures

- hold injects charge
- swipe discharges

### Director Mode Events

- polarity shifts
- ambient arc pulses

### Performance Notes

- cap arc counts carefully

### Feasibility

High

---

## Harmonic Sand Plate

### Concept

Particles organizing into resonance patterns.

### Core Physics / Behaviors

- standing waves
- resonance
- nodal attraction

### Primary Data Structures

- particles
- wave field

### Rendering Architecture

- particle layer
- wave visualization layer

### Supported Shader Features

- contour bands
- palette map
- bloom

### Style Presets

- Chladni Gold
- Laser Plate
- Ghost Frequency

### Shared Gestures

- drag moves emitters
- hold amplifies

### Director Mode Events

- frequency sweeps

### Performance Notes

- very Pi-friendly

### Feasibility

Very High

---

## Plasma Branch Terrarium

### Concept

Branching lightning/plasma growth across a charged field.

### Core Physics / Behaviors

- ionization
- branching discharge
- charge propagation

### Primary Data Structures

- charge grid
- arc mesh
- scar trail

### Rendering Architecture

- line mesh + glow composite

### Supported Shader Features

- bloom
- edge glow
- scars

### Style Presets

- Lightning Garden
- Neon Circuit
- Blood Plasma

### Shared Gestures

- tap injects charge
- swipe discharges

### Director Mode Events

- ambient charge build-up

### Performance Notes

- use frontier propagation only

### Feasibility

High

---

## Jelly Web Resonator

### Concept

Elastic glowing spring-web structures.

### Core Physics / Behaviors

- springs
- resonance
- stress propagation

### Primary Data Structures

- spring nodes
- line mesh

### Rendering Architecture

- line renderer
- pulse overlays

### Supported Shader Features

- glow
- stress palette
- trails

### Style Presets

- Spiderglass
- Bass Web
- Torn Neon

### Shared Gestures

- drag pulls web
- swipe tears

### Director Mode Events

- ambient pulses

### Performance Notes

- keep node counts modest

### Feasibility

Medium-High

---

## Cellular Ocean

### Concept

Soft translucent cells absorbing nutrients and dividing.

### Core Physics / Behaviors

- osmosis
- membrane pressure
- mitosis

### Primary Data Structures

- spring-ring cells
- nutrient particles

### Rendering Architecture

- membrane shading
- nuclei overlay

### Supported Shader Features

- fake normals
- contours
- bloom

### Style Presets

- Microbe Sea
- Glass Cells
- Toxic Tissue

### Shared Gestures

- tap nutrients
- swipe ruptures

### Director Mode Events

- nutrient blooms

### Performance Notes

- avoid true fluid simulation

### Feasibility

Medium

---

## Crystal Plasma Storm

### Concept

Electric crystal growth and fracture system.

### Core Physics / Behaviors

- crystallization
- charge buildup
- fracture

### Primary Data Structures

- triangular grid
- stress field

### Rendering Architecture

- crystal mesh
- discharge overlays

### Supported Shader Features

- facet lighting
- cracks
- bloom

### Style Presets

- Ice Lightning
- Ruby Fault
- Aurora Quartz

### Shared Gestures

- tap seeds crystals
- hold charges

### Director Mode Events

- random fractures

### Performance Notes

- excellent grid candidate

### Feasibility

Very High

---

## Cosmic Ink Ocean

### Concept

Flowing psychedelic turbulence and dye currents.

### Core Physics / Behaviors

- turbulence
- vortices
- dye advection

### Primary Data Structures

- particles
- vector field
- trails

### Rendering Architecture

- trail feedback composite

### Supported Shader Features

- distortion
- bloom
- palette map

### Style Presets

- Cosmic Smoke
- Velvet Ink
- Superfluid Neon

### Shared Gestures

- drag stirs flow
- hold creates vortex

### Director Mode Events

- ambient current drift

### Performance Notes

- fake fluid only

### Feasibility

High

---

## Proto-Galaxy Forge

### Concept

Galaxy formation with approximate gravity.

### Core Physics / Behaviors

- orbital capture
- accretion
- collapse

### Primary Data Structures

- particles
- gravity wells

### Rendering Architecture

- particle mesh + trails

### Supported Shader Features

- bloom
- lens distortion
- trails

### Style Presets

- Spiral Forge
- Black Hole
- Star Nursery

### Shared Gestures

- hold black hole
- swipe supernova

### Director Mode Events

- spawn new stars

### Performance Notes

- avoid all-pairs gravity

### Feasibility

Medium

---

## Ant Signal Civilization

### Concept

Swarm intelligence using pheromone trails.

### Core Physics / Behaviors

- stigmergy
- trail reinforcement
- distributed routing

### Primary Data Structures

- agents
- pheromone field

### Rendering Architecture

- trail field composite

### Supported Shader Features

- bloom
- trail feedback

### Style Presets

- Neon Colony
- Circuit Ants
- Fungal Roads

### Shared Gestures

- tap food source
- swipe wipe trails

### Director Mode Events

- shifting resource nodes

### Performance Notes

- very high emergence per CPU

### Feasibility

Very High

---

## Time Echo Particles

### Concept

Particles interacting with delayed ghost versions of themselves.

### Core Physics / Behaviors

- temporal echoes
- history attraction

### Primary Data Structures

- particles
- history buffers

### Rendering Architecture

- echo trail composites

### Supported Shader Features

- chromatic aberration
- shockwaves

### Style Presets

- Ghost Loop
- Time Glass
- Phase Storm

### Shared Gestures

- tap time anchor
- hold freeze

### Director Mode Events

- temporal pulses

### Performance Notes

- quality tied to history length

### Feasibility

High

---

## Turing Skin

### Concept

Reaction-diffusion biological skin patterns.

### Core Physics / Behaviors

- reaction diffusion
- morphogenesis

### Primary Data Structures

- low-res chemical fields

### Rendering Architecture

- scalar field visualization

### Supported Shader Features

- contour bands
- palette mapping

### Style Presets

- Leopard Skin
- Coral Vein
- Alien Tissue

### Shared Gestures

- drag smears chemicals

### Director Mode Events

- parameter drift

### Performance Notes

- low-res only

### Feasibility

High

---

## Prism Pool

### Concept

Caustic/refraction shader playground.

### Core Physics / Behaviors

- refraction
- ripples
- caustics

### Primary Data Structures

- density/height field

### Rendering Architecture

- refractive composite

### Supported Shader Features

- fake normals
- chromatic split

### Style Presets

- Glass Ocean
- Neon Prism
- Oil Lens

### Shared Gestures

- drag ripples water

### Director Mode Events

- light sweeps

### Performance Notes

- shader-focused sim

### Feasibility

High

---

## Neon River Delta

### Concept

Terrain erosion and sediment transport.

### Core Physics / Behaviors

- erosion
- sediment deposition
- downhill flow

### Primary Data Structures

- height field
- sediment field

### Rendering Architecture

- terrain composite

### Supported Shader Features

- contour bands
- bloom rivers

### Style Presets

- Toxic Delta
- Lava Flood
- Neon Canyon

### Shared Gestures

- drag carves channels

### Director Mode Events

- rainfall pulses

### Performance Notes

- simplified erosion only

### Feasibility

Medium-High

---

## Oil-Water Universe

### Concept

Immiscible domains separating and merging.

### Core Physics / Behaviors

- phase separation
- boundary tension

### Primary Data Structures

- material grid
- concentration field

### Rendering Architecture

- domain composite

### Supported Shader Features

- edge glow
- metaball boundaries

### Style Presets

- Oil Slick
- Bio Foam
- Cosmic Cells

### Shared Gestures

- drag stirs materials

### Director Mode Events

- cooling/reheating cycles

### Performance Notes

- strong visual payoff

### Feasibility

High

---

## Living Voronoi Tissue

### Concept

Voronoi-based living territory simulation.

### Core Physics / Behaviors

- territorial competition
- cell division

### Primary Data Structures

- Voronoi seeds
- pressure field

### Rendering Architecture

- Voronoi visualization

### Supported Shader Features

- membrane glow
- contour shading

### Style Presets

- Living Tissue
- Neon Hive
- Crystal Cells

### Shared Gestures

- tap seeds new cells

### Director Mode Events

- pressure pulses

### Performance Notes

- keep site counts low

### Feasibility

Medium

---

## Alien Vascular Tree

### Concept

Procedural vascular branching network growth.

### Core Physics / Behaviors

- branching
- nutrient flow
- pruning

### Primary Data Structures

- branch graph
- nutrient field

### Rendering Architecture

- line mesh rendering

### Supported Shader Features

- pulse glow
- thickness shading

### Style Presets

- Neon Roots
- Coral Veins
- Gold Arbor

### Shared Gestures

- drag light source

### Director Mode Events

- growth spurts

### Performance Notes

- cap branch counts

### Feasibility

High

---

## Chromatic Avalanche Bowl

### Concept

Granular glowing avalanche simulation.

### Core Physics / Behaviors

- granular flow
- avalanches
- compaction

### Primary Data Structures

- particles
- density buckets

### Rendering Architecture

- particle + dust composite

### Supported Shader Features

- glow ridges
- dust bloom

### Style Presets

- Neon Sand
- Toxic Gravel
- Plasma Ash

### Shared Gestures

- drag tilts bowl

### Director Mode Events

- vibration pulses

### Performance Notes

- fake granular flow

### Feasibility

Medium-High