//! Rootbound engine core — headless Rust simulation for Rootbound.
//!
//! Rootbound is a tile-assembly world-building game with an emergent defense
//! layer (see `docs/PROPOSAL.md`). This crate is the seed of the full Rust
//! rewrite (see `docs/ENGINE.md`): it implements the world model and the
//! systems that decide *what the world becomes*, with no rendering, audio, or
//! platform dependencies.
//!
//! Layer map, from the TypeScript implementation this ports:
//!
//! | TypeScript                       | Rust                                |
//! | -------------------------------- | ----------------------------------- |
//! | `src/core/ecs/*`                 | [`ecs`]                             |
//! | `src/game/config.ts`             | constants in this file + [`pressure::PressureConfig`] |
//! | `src/game/world/types.ts`        | [`types`]                           |
//! | `src/game/world/TileWorld.ts`    | [`tile_world`]                      |
//! | `src/game/world/Connectivity.ts` | [`connectivity`]                    |
//! | `src/game/world/Classifier.ts`   | [`classifier`]                      |
//! | `src/game/world/ModuleRegistry.ts` | [`registry`]                      |
//! | (new) M2 visible pressure        | [`pressure`]                        |
//!
//! The crate has **zero dependencies** on purpose: it must build offline, in
//! minimal CI, and eventually to WebAssembly without a dependency audit.

#![forbid(unsafe_code)]

pub mod classifier;
pub mod components;
pub mod connectivity;
pub mod ecs;
pub mod pressure;
pub mod registry;
pub mod tile_world;
pub mod types;

// Shared tunable constants, mirroring `src/game/config.ts`.
pub const TILE_PX: f32 = 16.0;
pub const CHUNK_SIZE: i32 = 32;
pub const CHUNK_PX: f32 = TILE_PX * CHUNK_SIZE as f32;
pub const WORLD_SIZE: i32 = 512;
pub const WORLD_PX: f32 = TILE_PX * WORLD_SIZE as f32;

pub use classifier::{classify, MODULE_MIN_TILES};
pub use connectivity::{ComponentStats, Connectivity, NEIGHBORS_8};
pub use pressure::{PressureConfig, PressureField, PressurePeak};
pub use registry::ModuleRegistry;
pub use tile_world::TileWorld;
pub use types::{ModuleType, Tile, TileCoord, TileType, Vec2};
