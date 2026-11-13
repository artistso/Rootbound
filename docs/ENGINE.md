# Rootbound — Rust engine

**Status: scaffold + core port + M2 pressure model. Not yet the shipping build.**
The playable game is still the TypeScript/Phaser build in `src/`. The Rust
engine in `engine/` is the beginning of the full Rust rewrite: the world model
and simulation live here from day one, so the rewrite grows out of a tested
core instead of a big-bang port.

## Why a Rust engine

The proposal targets itch.io (HTML) first and a desktop wrapper later, with a
512×512 grid, pressure propagation, threats, and hundreds of sprite-bearing
entities. That is a lot of per-frame simulation for a browser. A native/WASM
engine core gives us headroom for pressure fields and threat behavior without
changing the game's design, and it forces the "what does the world become"
logic to be a clean, tested library instead of scene glue.

## A note on the DeepSeek export (the attached PDF)

The engine discussion came with a two-page DeepSeek-generated PDF whose entire
content is a crate-version manifest:

```
just-deepseek = "0.2.0"
deepseek-recipe = "0.2.0"        deepseek-recipe-core = "0.2.0"
deepseek-recipe-macros = "0.2.0" deepseek-recipe-encoding = "0.2.0"
deepseek-recipe-image = "0.2.0"  deepseek-harness-sdk = "0.2.4"
deepseek-acp-adapter = "0.6.0"   deepseek-sdk = "0.5.0"
smg-symphony = "0.3.0"
deepseek-core = "0.8.40"         deepseek-state = "0.8.40"
deepseek-mcp = "0.8.40"          deepseek-hooks = "0.8.40"
deepseek-agent = "0.8.40"        deepseek-config = "0.8.40"
deepseek-tools = "0.8.40"        deepseek-secrets = "0.8.40"
```

**None of these are dependencies of the engine, and they should not become
dependencies of the game.** Reasons, plainly:

1. **They are an AI-agent framework, not a game engine.** `deepseek-agent`,
   `deepseek-mcp` (Model Context Protocol plumbing), `deepseek-hooks`,
   `deepseek-secrets`, `deepseek-config`, `deepseek-tools`, `deepseek-state`,
   `deepseek-core`, `deepseek-acp-adapter` (Agent Client Protocol),
   `deepseek-harness-sdk`, and the `deepseek-recipe-*` prompt-template
   libraries describe an LLM agent runtime and its tool integrations. Nothing
   in that list renders a tile, stores a component, propagates pressure, or
   resolves a threat. `smg-symphony` is unidentifiable from the file itself.
2. **They are unverifiable here.** The build environment cannot reach
   crates.io, so the existence, ownership, authenticity, and contents of
   those exact versions could not be confirmed. Loading 18 unvetted
   registry packages into a game that ships to the web would be a supply-chain
   risk in exchange for zero engine functionality.
3. **The engine needs almost nothing external yet.** The core
   (world, connectivity, classification, pressure) is a few hundred lines of
   arithmetic. `rootbound-core` is **zero-dependency** standard-library Rust.

If DeepSeek proposed these for a different purpose — e.g. a backend service
for AI-assisted content — evaluate that separately, with a security review,
as its own project. Do not let them leak into the client engine.

### Dependency policy

`rootbound-core` builds with **no dependencies**. Any proposed addition must
either (a) be unavailable in the standard library in a way that materially
impedes correctness (e.g. `serde` once a save/interchange format lands,
`wasm-bindgen` once the web bridge lands, `bevy` or similar once the rewrite
gets a frontend), and (b) be verifiable against crates.io at the time it is
added, pinned in `Cargo.lock`, and justified in this document.

## Verification status

The machine that wrote this code had no Rust toolchain and no crates.io
access, so the crate was not compiled locally. It was developed against
GitHub Actions instead: the first CI run caught two compile errors, the
second caught one test bug (a missing `union` before asserting component
membership), and the branch is now **green on both jobs** — `cargo test
--workspace --all-targets` passes on `ubuntu-latest` with the runner's
stable toolchain (run 43443964896, commits `4afd514`..`9d3e53a`). The same
job runs on every PR and on pushes to `main`, so regressions gate the same
way the TypeScript `check` job does.

Local workflow once you have a toolchain:

```bash
cd engine
cargo test --workspace --all-targets
```

## Layout

```text
engine/
├── Cargo.toml                  # workspace (resolver 2)
└── rootbound-core/             # zero-dependency simulation core
    ├── Cargo.toml
    ├── src/
    │   ├── lib.rs              # crate docs + shared constants (TILE_PX, CHUNK_SIZE, WORLD_SIZE, …)
    │   ├── types.rs            # TileCoord, Vec2, TileType, ModuleType, Tile
    │   ├── tile_world.rs       # chunked tile storage (port of TileWorld.ts)
    │   ├── connectivity.rs     # 8-connected union-find (port of Connectivity.ts)
    │   ├── classifier.rs       # cluster -> module rules (port of Classifier.ts)
    │   ├── ecs.rs              # minimal ECS (port of core/ecs/*)
    │   ├── components.rs       # Transform, Module (port of components.ts)
    │   ├── registry.rs         # module <-> ECS synchronization (port of ModuleRegistry.ts)
    │   └── pressure.rs         # M2 pressure propagation (new)
    └── tests/                  # integration tests mirroring tests/*.test.ts + pressure.rs
```

### Port fidelity notes (intentional divergences from TypeScript)

* `ecs.rs`: `query(...)` is split into `query`, `query2`, and `entities`
  because Rust cannot pass heterogeneous component lists through one generic
  signature. Query results are **sorted by entity ID** instead of first-store
  insertion order. `ComponentType<T>` keys become `Component<T>` handles with
  a `TypeId` internally and an explicit human-readable name.
* `Connectivity::find` takes `&mut self` and applies real path compression
  (path halving). Read-only call sites (`stats`, `component_tiles`) use a
  non-compressing root walk via `&self`. `component_tiles` was added because
  M6 cycle detection will need it; the TS original kept the member set purely
  for merging.
* `TileWorld::chunk_tiles` returns an owned `Vec<Tile>` instead of a lazy
  iterator, and dirty chunks are consumed in insertion order (matching TS),
  deduplicated through a set.
* Chunk/negative coordinates use `i32::div_euclid`, which is floor division
  — the TS `Math.floor(gx / CHUNK_SIZE)` behavior including negatives.
* Tile keys are structured `TileCoord { gx, gy }` values, with
  `to_key()`/`FromStr` round-tripping the canonical `"gx,gy"` format so a
  JSON bridge (saves, TS interop) stays trivial.
* `ModuleRegistry` exposes its `Component<Module>`/`Component<Transform>`
  handles so callers can query the ECS world without holding duplicates.

## M2 pressure model

Every placed tile is a pressure source. The field is dense (`512×512` `f32` =
1 MiB); each cell accumulates contributions from every source in range:

```text
pressure(cell) = Σ_sources  strength · type_weight · decay^(euclidean_distance_in_tiles)
```

* Cut off at `radius` tiles (zero contribution beyond).
* `decay` is multiplicative per tile (default 0.78), `source_strength`
  default 10.0, `type_weights` default `[1.0; 5]` (roots/canopy/etc. can be
  tuned once playtesting exists).
* Recompute is eager on add/remove — O(sources · π · radius²), allocation-free
  reads, fully deterministic. Placement is infrequent; if source counts grow,
  swap `recompute` for an incremental splat behind the same public API.
* **Ground darkening** is the entire UI: `darkness_at(coord)` maps pressure to
  `[0, 1]` (linear ramp against `full_darkness_pressure`). The renderer is
  expected to sample this per tile/chunk and deepen ground color — no numeric
  meters, per the design.
* **Threat hook (M3):** `threat_peaks()` flood-fills cells at or above
  `threat_threshold` into 8-connected clusters and returns one `PressurePeak
  { centroid, max_pressure, cells }` per cluster, sorted by peak strength.
  M3's spawner should pick the world-edge entry point nearest the highest
  peak and walk toward it — do not spawn per cell.
* All values live in `PressureConfig` — the engine-side counterpart of
  `config.ts`. Defaults are starting points, not balance.

### What is deliberately not in M2

Rendering, spores, shadows, camera shake — all frontend. Threat entities —
that is M3. Wiring the TS game to this field (via a shared constants JSON or a
WASM bridge) is a separate, small PR once CI is green.

## Roadmap for the engine

1. **Now** — this PR: workspace, ported core, M2 pressure, CI gate.
2. WASM bridge (`wasm-bindgen` or a C-ABI + JS glue) so the Phaser build can
   call the engine for placement/connectivity/pressure without behavior drift.
3. M3 threats against `threat_peaks()`; M4 module behavior; M5/M6 unchanged.
4. Frontend decision for the full rewrite: Bevy (recommended for a native
   path with a WASM target) vs. keeping Phaser and only porting simulation.
   Either way, the core stays this crate.

## Testing

`engine/rootbound-core/tests/` mirrors the Vitest suites one-to-one
(`tile_world`, `connectivity`, `classifier`, `ecs`, `registry`) and adds
`pressure.rs` (decay math, radius cutoff, source summation, type weights,
darkness clamp, source removal, peak clustering/ordering, clear/reset).
If a TS behavior changes, port the change and both suites stay honest to each
other.
