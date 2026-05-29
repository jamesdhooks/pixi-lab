# Sprite Sheet Reference
https://github.com/nikopueringer/CorridorKey
This document catalogues every simulation and ambient experience that would meaningfully benefit from bitmap sprite assets, describes what is needed, and provides an optimised generation prompt for each.

## Background Convention

All sprites must be placed on a **solid flat bright green background** (`#00FF00 `, RGB 255 0 255). This is the extraction key used programmatically to isolate each sprite frame. Rules that apply to **every prompt** below:

- Background must be a single uniform flat green — no gradients, no texture, no noise
- No drop shadows or glows spilling onto the background
- No grid lines, cell borders, or dividers between sprites
- Each sprite centred precisely in its grid cell
- All cells the same size (uniform grid)
- Final image square, high resolution (target 2048 × 2048)

---

## Simulations

---

### `ant-signal` — Ant Agents & Food Sources

**Why sprites help:** Individual ant agents are rendered as generic sized points by `ParticlePointRenderer`. A shaped ant sprite (and a "carrying food" variant) would immediately communicate the colony behaviour and make the `carrying` flag meaningful to the viewer.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `ant-signal-ants` | Top-down view ants in various poses: idle, walking, carrying food (food pellet visible under body) | 6 × 4 (24 sprites) |
| `ant-signal-food` | Small round food pellets and food cluster mounds, varied sizes and shading | 4 × 4 (16 sprites) |

**Generation prompt — ants:**

> Sprite sheet for a 2D simulation game. 24 top-down view cartoon ant sprites arranged in a uniform 6-column 4-row grid. Each ant is a distinct pose or variant: walking left, walking right, standing still, turning, carrying a small food pellet, and antenna-up signalling. Ants are dark brown to black with segmented body, six visible legs, and antennae. Clean bold outlines, flat cel-shaded colouring, no rendering detail on the background. Solid flat bright green background (#00FF00 ) only — no shadows on background, no texture. No grid lines or dividers between cells. Each ant centred in its cell. Square image, 2048 × 2048 pixels.

**Generation prompt — food:**

> Sprite sheet for a 2D simulation game. 16 food source sprites arranged in a uniform 4-column 4-row grid. Items include: small round seed pellets, crumb fragments, sugar crystal clusters, and small food mound piles — all in warm amber, tan, and cream tones. Clean bold outlines, flat cel-shaded colouring. Solid flat bright green background (#00FF00 ) only — no shadows on background, no texture, no decorations outside each food item. No grid lines or dividers between cells. Each item centred in its cell. Square image, 2048 × 2048 pixels.

---

### `orbital-shrapnel` — Asteroid Debris & Gravity Wells

**Why sprites help:** Debris particles are currently uniform sized points. Jagged irregular rock sprites with pre-rotated variants would dramatically improve the space debris aesthetic. A gravity well indicator sprite at well centres would also ground the simulation visually.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `orbital-shrapnel-debris` | Jagged asteroid / rock shrapnel pieces, pre-rotated across the full 360° and in 3 size classes | 8 × 8 (64 sprites) |
| `orbital-shrapnel-wells` | Gravity well / lens distortion indicators — concentric ring or spiral designs in 4 variants | 2 × 2 (4 sprites) |

**Generation prompt — debris:**

> Sprite sheet for a 2D space simulation game. 64 asteroid and shrapnel debris sprites arranged in a uniform 8-column 8-row grid. Each sprite is a jagged irregular rock fragment, each unique in silhouette — angular, fractured, chunky or shard-like. Mix of sizes: small pebbles, medium chunks, and large boulders spread across rows. Rock textures are dark charcoal grey and brown-grey with subtle cratered surface detail. Clean bold outlines, flat lit shading with a single light direction. Solid flat bright green background (#00FF00 ) only — no shadows cast onto background, no glow behind rocks. No grid lines or dividers between cells. Each rock centred in its cell. Square image, 2048 × 2048 pixels.

**Generation prompt — wells:**

> Sprite sheet for a 2D space simulation game. 4 gravity well indicator sprites arranged in a uniform 2-column 2-row grid. Each is a concentric ring lens distortion icon — 2 variants with circular arc rings, 2 variants with inward spiral arms — rendered in faint electric blue and violet with a bright white core. Clean vector-style illustration with thin glowing outlines. Solid flat bright green background (#00FF00 ) only — no background glow, no texture. No grid lines or dividers between cells. Each icon centred in its cell. Square image, 2048 × 2048 pixels.

---

### `crystal-plasma` — Spark Fragments

**Why sprites help:** Charged spark particles at crystal fracture tips are generic points. A small shaped spark sprite (glinting star burst, elongated spark shard) adds energy and visual texture during fracture events.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `crystal-plasma-sparks` | Electric spark and crystal shard sprites: starburst sparks, elongated lightning slivers, gem facet fragments | 6 × 6 (36 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D plasma simulation game. 36 electric spark and crystal shard sprites arranged in a uniform 6-column 6-row grid. Variety of shapes: 4-pointed starburst sparks, 6-pointed radial bursts, thin elongated lightning bolt slivers, angular crystal facet fragments, and small glowing orbs. Colours range from electric white, icy cyan, violet, and pale gold — each sprite a single dominant colour. Clean bold crisp outlines, flat cel-shaded fill with a bright centre highlight. Solid flat bright green background (#00FF00 ) only — no background glow, no texture. No grid lines or dividers between cells. Each sprite centred in its cell. Square image, 2048 × 2048 pixels.

---

### `living-voronoi-tissue` — Cell Nuclei

**Why sprites help:** Cell nuclei are rendered as generic glow points by `ParticlePointRenderer`. A small organelle-detailed nucleus sprite (circular with a darker centre, hint of nuclear membrane) would add microscopy authenticity to the tissue simulation.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `voronoi-nuclei` | Biological cell nucleus icons: single nucleus, dividing (dumbbell) nucleus, binucleate, and multi-lobular variants | 4 × 4 (16 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D biological cell simulation. 16 cell nucleus sprites arranged in a uniform 4-column 4-row grid. Each sprite is a stylised cell nucleus viewed from directly above: circular organelles with a visible inner nucleolus dot, double-ring nuclear membrane, and subtle mottled chromatin texture. Variants include: single round nucleus, dividing dumbbell-shaped nucleus, two-lobe binucleate, and irregular multi-lobe nucleus. Colours range across warm pink, pale violet, teal, and amber. Clean detailed illustration style, scientific but approachable. Solid flat bright green background (#00FF00 ) only — no background texture or glow. No grid lines or dividers. Each nucleus centred in its cell. Square image, 2048 × 2048 pixels.

---

### `proto-galaxy-forge` — Star & Galaxy Well Sprites

**Why sprites help:** Stars are currently uniform glowing points. A soft round sprite with a hot luminous core, diffuse corona, and subtle lens cross gives each star dimension. Gravity well indicators could use a spiral/lens sprite.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `proto-galaxy-stars` | Soft glowing star sprites in varied sizes and spectral colours (blue-white, yellow, orange, red dwarf) with diffraction spikes | 6 × 6 (36 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D galaxy simulation game. 36 glowing star sprites arranged in a uniform 6-column 6-row grid. Stars vary by spectral class and size: hot bright blue-white stars, medium yellow and orange stars, cooler red dwarf stars, large bright giant stars. Each star has a soft luminous core, faint corona halo, and 4-point diffraction spikes of varying prominence. Colours span ice blue, white, pale yellow, warm gold, orange, and deep red. Dark space aesthetic, clean illustration style. Solid flat bright green background (#00FF00 ) only — no background glow, no texture. No grid lines or dividers between cells. Each star centred in its cell. Square image, 2048 × 2048 pixels.

---

### `harmonic-sand` — Emitter Markers

**Why sprites help:** Emitter position markers currently use a procedural `EmitterMarkerRenderer`. A polished speaker/tuning-fork icon sprite would make emitter interaction points much clearer, especially at small screen sizes.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `harmonic-sand-emitters` | Speaker, tuning fork, and resonator plate emitter icons in 4 style variants each | 4 × 4 (16 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D physics simulation game. 16 audio emitter icons arranged in a uniform 4-column 4-row grid. Icon types: a front-facing round speaker driver, a tuning fork viewed from above, a vibrating metal plate with concentric wave lines, and an abstract sine-wave emitter disc. 4 colour variants each: electric gold, cyan, soft white, and warm orange. Clean flat icon design with bold outlines and minimal shading detail. Solid flat bright green background (#00FF00 ) only — no background texture. No grid lines or dividers between cells. Each icon centred in its cell. Square image, 2048 × 2048 pixels.

---

## Ambients

---

### `confetti` — Shaped Confetti Pieces

**Why sprites help:** Confetti pieces are currently rendered as uniform round points. Real confetti comes in rectangles, circles, stars, and streamers — a sprite sheet adds instant visual authenticity.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `confetti-shapes` | Confetti pieces in 6 shapes × 6 colour variants: rectangle, oval circle, 5-pointed star, thin paper streamer curl, heart, and diamond | 6 × 6 (36 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D confetti particle effect. 36 confetti piece sprites arranged in a uniform 6-column 6-row grid. Six distinct shapes across rows: flat rectangular strip, round disc, 5-pointed star, thin curling paper streamer, small heart, and diamond rhombus. Six bright celebration colours across columns: red, orange, yellow, lime green, sky blue, and hot pink. Each piece is a flat single-colour shape with a thin white outline, slightly glossy surface suggesting paper. Clean flat illustration style, no complexity. Solid flat bright green background (#00FF00 ) only — no background texture or shadow. No grid lines or dividers between cells. Each piece centred in its cell. Square image, 2048 × 2048 pixels.

---

### `embers` — Ember & Coal Particles

**Why sprites help:** Embers are currently uniform glow points. Soft organic ember fragment shapes — irregular oval hot coals, thin glowing slivers — add texture variation to rising fire particles.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `embers-particles` | Glowing ember fragment shapes: irregular oval coals, thin elongated sparks, small angular cinder shards | 4 × 4 (16 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D fire particle effect. 16 glowing ember sprites arranged in a uniform 4-column 4-row grid. Shapes include: irregular rounded coal fragments, thin elongated spark slivers, angular cinder shards, and small round glowing orbs. Each ember glows from deep red and orange at its core to bright yellow-white at the hottest point, with a soft fading edge — rendered as a flat lit shape, not a photographic particle. Clean flat illustration style with a visible glowing aura that stays within the cell bounds. Solid flat bright green background (#00FF00 ) only — no shadows on background. No grid lines or dividers between cells. Each ember centred in its cell. Square image, 2048 × 2048 pixels.

---

### `family-orbit` — Person Avatars

**Why sprites help:** Orbiting family members are currently generic round points. A small simplified human avatar silhouette (or abstract person icon) communicates the family metaphor instantly.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `family-orbit-avatars` | Simplified person avatar icons: adult, child, teen, elderly, baby — in 4 colour variants each | 5 × 4 (20 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D ambient family visualization. 20 simplified person avatar icons arranged in a uniform 5-column 4-row grid. Five person types across columns: adult, teenager, child, elderly person with rounded posture, and small baby. Four colour variants across rows: warm coral, sky blue, soft gold, and mint green. Each avatar is a clean bold rounded silhouette icon style — head and shoulders visible, friendly and gender-neutral. Flat illustration, no fine detail, strong clear silhouette readable at small sizes. Solid flat bright green background (#00FF00 ) only — no shadows, no background texture. No grid lines or dividers between cells. Each avatar centred in its cell. Square image, 2048 × 2048 pixels.

---

### `fireflies` — Bioluminescent Glow Orbs

**Why sprites help:** Fireflies are point glows. A soft teardrop or oval sprite body with a brighter abdomen tip adds the biological glow-source shape that makes fireflies recognisable even at small render sizes.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `fireflies-sprites` | Firefly body sprites: oval insect body with glowing abdomen, wings visible, in 4 glow-intensity states and 2 orientations | 4 × 4 (16 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D ambient firefly effect. 16 firefly sprites arranged in a uniform 4-column 4-row grid. Each sprite shows a stylised firefly insect: small elongated body, two small wing pairs, and a glowing abdomen tip. Four glow intensity states across columns: dim unlit, faint amber, bright yellow-green glow, and intense white-core burst. Insects oriented at a slight upward angle, dark body contrast against the glow. Clean detailed insect illustration with bold outlines, flat colouring. Solid flat bright green background (#00FF00 ) only — no background glow, no shadows outside the sprite bounds. No grid lines or dividers between cells. Each firefly centred in its cell. Square image, 2048 × 2048 pixels.

---

### `home-weather-glass` — Raindrop Shapes

**Why sprites help:** Droplets are currently rendered as round points. Actual window raindrops are elongated teardrop or cylindrical shapes — a matching sprite makes the "glass pane" metaphor immediately readable.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `weather-glass-drops` | Window raindrop sprites in various sizes and elongation ratios, plus small round splash impact rings | 6 × 4 (24 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D weather window glass effect. 24 raindrop and splash sprites arranged in a uniform 6-column 4-row grid. Three rows of raindrop shapes: elongated vertical teardrops with a rounded bottom and tapered top, in small, medium, and large sizes — each with a subtle internal water refraction highlight suggesting glass. One row of small circular splash ring impact shapes with a thin concentric ripple line. Colours are semi-transparent blue-grey and pale aquamarine with a specular white highlight. Clean illustration style, soft edges. Solid flat bright green background (#00FF00 ) only — no background texture. No grid lines or dividers between cells. Each drop or splash centred in its cell. Square image, 2048 × 2048 pixels.

---

### `house-pulse-map` — Room & Zone Icons

**Why sprites help:** All room nodes are currently identical glow points. Distinct room icons (living room, kitchen, bedroom, bathroom, etc.) make the smart-home floor plan semantic at a glance.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `house-pulse-icons` | Room type icons: living room, kitchen, bedroom, bathroom, hallway, garage, garden, office, front door, back door, utility room, dining room, child's room, nursery, loft, basement | 4 × 4 (16 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D smart home visualisation. 16 room and zone icon sprites arranged in a uniform 4-column 4-row grid. Each icon represents a room type: living room (sofa silhouette), kitchen (fork and pan), master bedroom (double bed), bathroom (bathtub), hallway (door archway), garage (car outline), garden (leaf or tree), home office (monitor and desk), front door (door with letterbox), utility room (washing machine), dining room (table and chairs), child's bedroom (building blocks), nursery (crib), loft (hatch ladder), basement (stairs down), back door (French doors). Clean flat line-icon style, single colour white lines on a transparent-ready background, bold and readable at 32px. Solid flat bright green background (#00FF00 ) only. No grid lines or dividers between cells. Each icon centred in its cell. Square image, 2048 × 2048 pixels.

---

### `leaves-pollen` — Leaf Shapes & Pollen Motes

**Why sprites help:** This is one of the strongest sprite candidates. Leaves and pollen both use the same round-point renderer despite the `kind` field distinguishing them in the model. Shaped sprites make the difference instantly visible.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `leaves-shapes` | Autumn and spring leaf silhouettes in varied species and colours: maple, oak, birch, ginkgo, cherry blossom petal, willow, and broad tropical | 6 × 4 (24 sprites) |
| `pollen-motes` | Pollen particle sprites: spiky spherical pollen grains, oval smooth grains, multi-lobed pollen, and round spore clusters | 4 × 4 (16 sprites) |

**Generation prompt — leaves:**

> Sprite sheet for a 2D ambient nature effect. 24 leaf sprites arranged in a uniform 6-column 4-row grid. Six leaf species across columns: maple (5-point lobed), oak (rounded lobes), birch (triangular serrated), ginkgo (fan shaped), cherry blossom petal (oval soft), and willow (long narrow). Four colour rows: deep autumn red-orange, golden amber, fresh spring green, and pale yellow. Each leaf is a clean flat silhouette with a visible central vein and secondary veins, slightly irregular natural edges. Clean botanical illustration style, bold outlines. Solid flat bright green background (#00FF00 ) only — no shadow, no background texture. No grid lines or dividers. Each leaf centred in its cell. Square image, 2048 × 2048 pixels.

**Generation prompt — pollen:**

> Sprite sheet for a 2D ambient nature particle effect. 16 pollen grain sprites arranged in a uniform 4-column 4-row grid. Four pollen morphologies across columns: spiky spherical grain with protruding spines, smooth prolate oval grain, three-lobed tricolpate grain, and irregular clustered spore mass. Four size variants across rows from tiny to large. Colours: pale golden yellow, cream white, warm orange, and soft lime green. Scientific botanical illustration style, clean rounded outlines, slight 3D form shading suggesting volume. Solid flat bright green background (#00FF00 ) only — no background texture. No grid lines or dividers. Each grain centred in its cell. Square image, 2048 × 2048 pixels.

---

### `memory-drift` — Photo Frames

**Why sprites help:** Memory frames are large glow circles with nothing to connect them to photographs. A photo-frame sprite directly communicates the concept — this is the most conceptually important sprite in all ambients.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `memory-frames` | Photo frame designs: polaroid, vintage wooden, thin modern, ornate gilded, rounded corner softbox, small square instant film, filmstrip strip section, and oval Victorian frame | 4 × 4 (16 sprites) |

**Generation prompt:**

> Sprite sheet for a 2D ambient memory photo visualization. 16 photo frame sprites arranged in a uniform 4-column 4-row grid. Frame styles: white Polaroid with bottom label strip, dark aged wooden rectangle, thin modern brushed-metal rectangle, ornate gilded baroque oval, soft rounded white square with drop-shadow indent, small square instant-film with white borders, a horizontal filmstrip section showing 3 small film frames, and a thin oval Victorian cameo frame. Each frame drawn with a visible empty interior (interior fills the frame but shows the frame border clearly). Mix of warm sepia, gold, white, and dark tones. Clean detailed illustration style. Solid flat bright green background (#00FF00 ) only — no background texture or shadows outside frame bounds. No grid lines or dividers between cells. Each frame centred in its cell. Square image, 2048 × 2048 pixels.

---

### `sleep-aquarium` — Fish & Bubbles

**Why sprites help:** Fish are currently oval glow points despite being the conceptual centrepiece of the aquarium. Even a simple side-view fish sprite (flippable for `direction`) transforms the ambient. This is the highest-impact sprite in the project.

> Note: Existing fish sprite sheets exist in this folder (`fish_1.png`, `fish_2.png`, `fish_3.png`). Review these before generating new sheets — they may already cover the required variety.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `aquarium-fish` | Side-view cartoon tropical fish in many species and colours, all facing right (flip in code for `direction=left`) | 8 × 8 (64 sprites) |
| `aquarium-bubbles` | Underwater air bubble sprites: single round bubble with specular highlight, oval stretched bubble, small micro-bubble cluster | 4 × 2 (8 sprites) |

**Generation prompt — fish:**

> Sprite sheet of cartoon tropical aquarium fish. A large 8-column 8-row uniform grid of 64 unique fish, each a different species and colour combination. Include variety such as clownfish, angel fish, neon tetra, guppy, goldfish, betta, surgeonfish, blowfish, eel, pufferfish, discus, cichlid, and others. All fish face right, shown from the side. Each fish is clean, bold-outlined, bright-coloured with visible fins, tail, and eye. Flat cel-shaded illustration style. Solid flat bright green background (#00FF00 ) only — no water, no background, no shadows on background. No grid lines or dividers between cells. Each fish centred in its cell. Square image, 2048 × 2048 pixels.

**Generation prompt — bubbles:**

> Sprite sheet for a 2D underwater scene. 8 air bubble sprites arranged in a uniform 4-column 2-row grid. Row 1: single round bubbles in 4 sizes (tiny, small, medium, large) — each a circle outline with a bright specular white highlight crescent in the upper-left and a faint blue-aqua interior tint. Row 2: an elongated oval wobbling bubble, a pear-shaped rising bubble, a small cluster of 3 micro-bubbles, and a large flat squashed bubble. Clean vector illustration style. Solid flat bright green background (#00FF00 ) only — no background texture. No grid lines or dividers. Each bubble centred in its cell. Square image, 2048 × 2048 pixels.

---

### `snowfall` — Snowflake Crystals

**Why sprites help:** Snowflakes are among the most recognisable natural shapes and are currently plain round points. Even a single 6-pointed crystal sprite would be transformative; a varied sheet makes the scene genuinely beautiful.

> Note: An existing snowflake sprite sheet exists in this folder (`snowflake_1.png`). Review it before generating more — it may already provide sufficient variety.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `snowflakes` | Unique 6-armed snowflake crystal designs in varied complexity and arm geometry | 6 × 6 (36 sprites) |

**Generation prompt:**

> Sprite sheet of unique snowflake crystal sprites. A 6-column 6-row uniform grid of 36 distinct snowflake designs. Each snowflake is a 6-fold symmetric ice crystal, each unique in arm branching pattern: simple hexagonal plate, dendrite with fine branches, stellar plate with sectored ridges, needle cluster, hollow column crystal, capped column, and many variations. Snowflakes are white and pale ice blue with crisp geometric detail, varying in size from small simple to large intricate. Clean technical illustration style. Solid flat bright green background (#00FF00 ) only — no background texture, no shadow, no tint. No grid lines or dividers between cells. Each snowflake centred precisely in its cell. Square image, 2048 × 2048 pixels.

---

### `task-garden` — Plant Growth Stages & Sparkles

**Why sprites help:** Garden plants are generic glow points despite the `species` field distinguishing them. Growth-stage sprites (seed → sprout → flowering → fruiting) make the garden metaphor explicit and give the ambient strong visual narrative.

**Sprites needed:**

| Sheet | Contents | Grid |
|---|---|---|
| `garden-plants` | 4 plant species × 4 growth stages = 16 sprites. Species: flower (sunflower style), vegetable (tomato plant), herb (bushy round), vine (climbing tendril) | 4 × 4 (16 sprites) |
| `garden-sparkles` | Completion sparkle burst sprites in 4 animation-ready frames: pre-burst glow, burst peak, ring scatter, fade-out sparkle cloud | 2 × 4 (8 sprites) |

**Generation prompt — plants:**

> Sprite sheet for a 2D task garden game. 16 plant growth stage sprites arranged in a uniform 4-column 4-row grid. Four plant species across columns: a sunflower, a tomato plant, a round bushy herb, and a climbing vine with tendrils. Four growth stages across rows: stage 1 a tiny seedling with two cotyledon leaves, stage 2 a small leafy sprout, stage 3 a flowering plant in full bloom, stage 4 a mature plant bearing fruit or seeds. All sprites are top-down or 45-degree angled view, bright and cheerful. Flat cartoon illustration style, bold outlines, vivid natural greens, yellows, reds. Solid flat bright green background (#00FF00 ) only — no background, no ground, no shadow. No grid lines or dividers between cells. Each plant centred in its cell. Square image, 2048 × 2048 pixels.

**Generation prompt — sparkles:**

> Sprite sheet for a 2D game completion sparkle effect. 8 sparkle burst sprites arranged in a uniform 2-column 4-row grid representing 4 animation frames in 2 colour variants. Frame 1: a compact bright glowing star point, Frame 2: a large radial starburst with long spike rays, Frame 3: a ring of small scattered star particles mid-expansion, Frame 4: a faded diffuse cluster of tiny twinkling dots. Colour variant 1 in warm golden-yellow, colour variant 2 in bright pastel rainbow multi-colour. Clean illustration style with white core highlights. Solid flat bright green background (#00FF00 ) only — no background texture. No grid lines or dividers between cells. Each frame centred in its cell. Square image, 2048 × 2048 pixels.

---

## Summary Table

| Experience | Package | Sheet Name | Priority | Grid | Notes |
|---|---|---|---|---|---|
| `ant-signal` | simulations | `ant-signal-ants` | **HIGH** | 6×4 | Include carrying variant |
| `ant-signal` | simulations | `ant-signal-food` | MEDIUM | 4×4 | |
| `orbital-shrapnel` | simulations | `orbital-shrapnel-debris` | **HIGH** | 8×8 | Pre-rotated variants |
| `orbital-shrapnel` | simulations | `orbital-shrapnel-wells` | MEDIUM | 2×2 | |
| `crystal-plasma` | simulations | `crystal-plasma-sparks` | MEDIUM | 6×6 | |
| `living-voronoi-tissue` | simulations | `voronoi-nuclei` | MEDIUM | 4×4 | Include dividing variant |
| `proto-galaxy-forge` | simulations | `proto-galaxy-stars` | MEDIUM | 6×6 | |
| `harmonic-sand` | simulations | `harmonic-sand-emitters` | LOW | 4×4 | Cosmetic only |
| `confetti` | ambients | `confetti-shapes` | **HIGH** | 6×6 | |
| `embers` | ambients | `embers-particles` | MEDIUM | 4×4 | |
| `family-orbit` | ambients | `family-orbit-avatars` | MEDIUM | 5×4 | Gender-neutral |
| `fireflies` | ambients | `fireflies-sprites` | MEDIUM | 4×4 | |
| `home-weather-glass` | ambients | `weather-glass-drops` | MEDIUM | 6×4 | |
| `house-pulse-map` | ambients | `house-pulse-icons` | **HIGH** | 4×4 | 16 room types |
| `leaves-pollen` | ambients | `leaves-shapes` | **HIGH** | 6×4 | Most impactful shape change |
| `leaves-pollen` | ambients | `pollen-motes` | MEDIUM | 4×4 | |
| `memory-drift` | ambients | `memory-frames` | **HIGH** | 4×4 | Most conceptually critical |
| `sleep-aquarium` | ambients | `aquarium-fish` | **HIGH** | 8×8 | Check existing fish sheets first |
| `sleep-aquarium` | ambients | `aquarium-bubbles` | LOW | 4×2 | |
| `snowfall` | ambients | `snowflakes` | **HIGH** | 6×6 | Check existing snowflake sheet first |
| `task-garden` | ambients | `garden-plants` | **HIGH** | 4×4 | 4 species × 4 stages |
| `task-garden` | ambients | `garden-sparkles` | MEDIUM | 2×4 | Completion animation frames |
