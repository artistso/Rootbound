# Rootbound — Design Proposal

**Genre:** Tile-assembly world-builder / emergent defense
**Platform:** Web (itch.io primary, Epic Games Store via wrapper)
**Target hardware:** Galaxy Tab S12 Ultra (also desktop, iPad Pro, mid-range tablets)
**Language / Stack:** TypeScript + Phaser 4 (or 3.x fallback) + hand-rolled ECS
**Team size:** Solo developer + commissioned / hand-drawn art
**Mode:** Single-player
**Onboarding:** None. No tutorial. No text instructions.

---

## One-Sentence Pitch

**You start with one tile in the void. Everything else — your buildings, your
defenses, your economy, your threats — emerges from the shape of what you
build.**

---

## The Core Reframe

Rootbound is not a tower defense game with a building layer on top. It's a
**tile-assembly system whose output happens to include defense.**

When you place a tile, it doesn't become a specific thing. It joins a cluster.
The cluster's shape and composition determine what module *emerges* from it:
a taproot if the cluster is root-heavy, a canopy if it's bloomed, a wound if
it doesn't match any pattern. You don't choose "tower" from a menu. You
sculpt a shape and find out what it becomes.

This single reframe collapses what would otherwise be five separate systems
(maps, towers, talents, economy, threats) into one mechanic: **placement
on a growing organic grid.** Every part of the game is the same verb.

**The closest reference point is Townscaper** — the charm of placing a block
and watching it auto-assemble into a building. Rootbound replaces "charming
town" with "grimy organic growth" and adds a threat layer that responds to
your footprint.

---

## Theme

**Dusty antique cartography.** The visual language of hand-drawn maps from
empires that claimed land they'd never seen. Parchment textures, ink
cross-hatching, compass roses, crease marks, burn stains at the edges,
annotations in dead languages.

**Greed is the mechanic, not the morality.** Every tile you place is an act
of extraction. The world pushes back proportionally. Idle play is viable —
build nothing, and the world leaves you alone. Build a lot, and the world
comes for you. The player chooses their own pace of escalation.

The thematic through-line: *what does it cost to make a place yours?*

---

## Three Interlocking Mechanics

### 1. Assembly

Tiles are placed on a 512×512 grid (representing about 8,000 screen pixels
at 1× zoom). Each tile has a **type** (stem, leaf, root, bloom, glyph) and a
**height** (z-level). Clusters of tiles are classified by **8-connected
union-find** and become **modules** once they reach a threshold of 3+ tiles:

| Cluster shape | Module |
|---|---|
| ≥1 glyph | **glyph** — puzzle object, cannot be harvested or destroyed |
| ≥2 bloom + ≥3 stem | **canopy** — the primary defensive structure |
| ≥4 root | **taproot** — the primary resource extractor |
| ≥3 leaf + ≥2 stem | **trunk** — structural / connective |
| any 3+ tiles that don't match | **wound** — draws threat |

**Misfit shapes are not failure.** A wound is a valid move that simply has
a cost. This keeps the canvas free of "you must build this specific shape"
pressure while preserving a discovery loop: the player *learns* which shapes
produce which modules by experimenting, never by being told.

### 2. Pressure

Every tile you place emits **pressure** into the world. Pressure radiates
outward from its source, decaying with distance, and **is visible to the
player** — the ground darkens, spores drift, shadows deepen. There is no
hidden meter. The state of pressure is literally painted on the map.

Above a threshold, pressure **spawns a threat**: a root-worm, a rot, a
scavenger, emerging from the world's edge and walking toward the pressure
peak. The player sees it coming because they see the darkening before it
arrives.

This is the *entire* tutorial. There are no popups. There is no "!" over a
spawning enemy. The darkening is the teaching, and it's diegetic.

### 3. Discovery

The world contains **equation glyphs** — carved stones, dials, geometric
markings — that are solved by interacting with the world itself (aligning
dials, connecting paths, setting levers). A glyph might read `x³ − 6x² + 11x − 6`
and the player has to figure out that the answer is the set of roots `{1, 2, 3}`
and that there are three dials somewhere nearby that need those values.

**No hints. No hover text. No quest log.** The field journal records what's
already been found — it's a trophy case, not a walkthrough.

The discovery loop is what gives Rootbound its identity as a game of
*wandering and noticing*, not just building and defending.

---

## The Hodge / Algebraic Cycles Hook

I want to be honest about this in the proposal, because the honesty is what
makes it work.

**We cannot implement the Hodge conjecture.** It's an open problem about
complex projective varieties. There is no tile-grid algorithm that "solves"
it, and any design that claims to is dressing up something else.

**What we can implement is a discovery mechanic that inherits its *aesthetic*.**

- **Algebraic cycles in-game** = closed loops of tiles. This is genuinely
  computable with flood-fill: from any tile, if you can reach yourself
  without retracing, you have a cycle. Real graph theory, not metaphor.
- **Hodge classes in-game** = cycles whose *shape signature* matches some
  hidden criteria. The signature is a tuple of computable invariants: perimeter,
  area, symmetry order, number of holes (genus). Most cycles are inert.
  Some signatures grant something — a talent unlock, a resource burst, a
  permanent buff. The player's discovery game is: *which shapes matter, and why?*
- **The feel is the Hodge conjecture**, not its content: "certain objects
  are special and recognizable, but the structure that makes them special is
  hidden." That's the pull.

When a player discovers a Hodge-class cycle on their own, with no hint, that
is the whole game paying off. That's the no-tutorial dream made concrete.

**Implementation note:** this is M6+ scope. M1's connectivity layer already
does the flood-fill work; adding cycle detection and signature matching is a
clean extension, not a rewrite.

---

## No Tutorial: What That Actually Means

"No tutorial" is a design constraint that forces every other decision:

- **No modal dialogs, ever.** The HUD is always on screen, always non-blocking.
  Nothing pauses the game.
- **Affordances instead of instructions.** A valid placement spot blooms
  faintly. An interactable stone pulses. The player infers rules from
  feedback, never from text boxes.
- **The world is legible at a glance.** No numbers for biomass, health, or
  threat. Biomass is the glow intensity of your root network. World health
  is the density of the central mass. Threat is the darkening of the ground.
  All state is *visible in the world*.

This is much harder to build than a HUD-driven game, because you have to make
every distinct state visually distinct. It is also the correct approach for
this game, because the discovery *is* the experience.

**Consequence for development:** you will need playtesters, not documentation.
Where a player gets stuck, you fix it with visual affordance, not text.

---

## 2.5D Rendering

Heightmap-based 2.5D (like Townscaper), not isometric. Each tile is three
sprites: shadow at z=0, extrusion side at height `z × tileHalf`, top face
at height `z`. Depth sorted by `gy × 1000 + z`.

Isometric would force rigid alignment and look wrong for organic shapes.
Heightmap handles irregular geometry gracefully and scales from a single
pixel to a continent without changing the rendering model.

**Level of detail:** at far zoom, collapse modules to a single pre-baked
silhouette sprite. At near zoom, show individual tiles. This is what makes
the zoom-out fantasy — start with one pixel, end with a continent — technically
viable.

---

## Platform

**Primary target:** web, deployed to **itch.io** as HTML. Vite build, ZIP
with `index.html` at root.

**Secondary target:** **Epic Games Store** via a desktop wrapper (Deskifier
or similar). Same codebase, wrapped in Electron or Tauri.

**Reference hardware:** Galaxy Tab S12 Ultra. Design resolution 1600×1000,
`Scale.FIT` with letterboxing. S Pen works as a first-class pointer via
Phaser's unified pointer API. Pinch and wheel both work for zoom.

**Why itch.io first:** it's where hand-drawn, unusual, no-tutorial games
thrive. The audience that plays *Dwarf Fortress* and *Townscaper* and
*Kentucky Route Zero* finds games on itch.io. It's also a zero-friction
launch — no store review, no SDK integration, immediate feedback.

---

## Milestones

| M | Deliverable | Status |
|---|---|---|
| **0** | Grid, heightmap, camera, one placeable tile | ✅ |
| **1** | Connectivity, classification, modules, zero-latency placement | ✅ |
| **2** | Pressure system — visible darkening | next |
| **3** | Threats spawn from pressure peaks | |
| **4** | Modules do things — harvest, defend, attract | |
| **5** | Organic resource display | |
| **6** | Equation glyphs + field journal | |
| **7** | Art manifest + ART_TODO export | |
| **8** | FX pass, splash, itch.io build | |

---

## Risks

**1. Emergence is hard to balance.** Townscaper works because the rules are
simple and the shape space is constrained. Rootbound has more tile types,
more module types, pressure, and threats. You will spend months making "the
weird shape the playtester built" produce something *interesting* instead of
nothing or something broken. This is the defining risk.

**2. Art volume.** Each module type × each connection topology needs a sprite
variant. Budget hundreds of hand-drawn sprites. This is why the asset
pipeline (M7) is critical — it lets the game run on placeholders and generate
a continuous drawing TODO.

**3. 2.5D occlusion.** Tall modules occlude the camera's view of the
battlefield behind them. This needs a fade-when-occluding shader. Solve it in
M3.

**4. Balance against "do nothing."** Because idle play is viable, the game
has to be interesting for players who choose to build slowly. That's a
design problem, not a technical one, but it needs real attention.

**None of these are blockers.** But the project has moved from "a tower
defense with personality" to "a novel building game with a defense layer,"
and the timeline moves with it.

---

## What Makes It Different

- **Tile assembly as the primary verb.** Not tower defense with a building
  layer. The shape of your world *is* your strategy.
- **Emergent defense.** Towers aren't placed, they grow out of clusters. A
  taproot isn't a building, it's a consequence of the shape you made.
- **Visible consequence.** Every mechanic has a visual manifestation on the
  world. No hidden numbers. The pressure system makes your own greed the
  threat.
- **No tutorial, structurally.** Not "no tutorial" as a marketing claim —
  no tutorial because the game is *about* the discovery, and every system
  is legible without explanation.
- **Algebraic cycles as content.** Real graph-theoretic cycle detection,
  dressed in the aesthetic of one of the hardest open problems in modern
  mathematics, used as a discovery loop rather than a puzzle menu.

---

## What Success Looks Like

A player opens the game with no instructions, sees a dark void with one
tile, places a second tile out of curiosity, sees a cluster form, places
more, watches a brown circle appear, keeps going, watches the ground
darken near their building, and then a shadow walks out of the world's edge
toward them — and they realize, without being told, that *they* caused it.

That's the whole design in one moment.
