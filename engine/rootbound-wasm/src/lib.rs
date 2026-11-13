//! WebAssembly bindings for the Rootbound engine core.
//!
//! Exposes a single [`Engine`] object that mirrors the placement pipeline of
//! the TypeScript `GameScene.commitTile`: placing a tile writes the world,
//! union-finds connectivity, classifies and syncs modules, and registers the
//! pressure source — in one call from JavaScript.
//!
//! The API is deliberately scalar-only (numbers, booleans, short strings) so
//! the binding layer stays thin and the generated `.d.ts` is trivial to
//! consume from Vite/TypeScript. List-valued results come back as small
//! hand-rolled JSON strings with number/enum content only, which keeps this
//! crate free of serde.
//!
//! Build (see docs/ENGINE.md):
//!
//! ```bash
//! cd engine
//! rustup target add wasm32-unknown-unknown
//! cargo build --release --target wasm32-unknown-unknown -p rootbound-wasm
//! wasm-bindgen --target nodejs --out-dir rootbound-wasm/pkg \
//!   target/wasm32-unknown-unknown/release/rootbound_wasm.wasm
//! node rootbound-wasm/smoke.mjs
//! ```

use rootbound_core::ecs::World;
use rootbound_core::pressure::PressureField;
use rootbound_core::{
    ComponentStats, Connectivity, ModuleRegistry, Tile, TileCoord, TileType, TileWorld, NEIGHBORS_8,
    WORLD_SIZE,
};
use wasm_bindgen::prelude::*;

/// The whole engine, callable from JavaScript.
#[wasm_bindgen]
pub struct Engine {
    world: TileWorld,
    connectivity: Connectivity,
    registry: ModuleRegistry,
    ecs: World,
    pressure: PressureField,
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl Engine {
    /// A fresh, empty world (512x512 tiles, default pressure configuration).
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            world: TileWorld::new(),
            connectivity: Connectivity::new(),
            registry: ModuleRegistry::new(),
            ecs: World::new(),
            pressure: PressureField::new(Default::default()),
        }
    }

    /// Place a tile at `(gx, gy)`. `tile_type` is one of
    /// `stem | leaf | root | bloom | glyph`.
    ///
    /// Returns `false` when the coordinate is out of bounds, the cell is
    /// already occupied, or the tile type is unrecognized. On success the
    /// tile is committed to the world, connectivity is re-merged, modules are
    /// re-classified, and pressure is recomputed — same pipeline as the
    /// TypeScript placement flow.
    pub fn place_tile(&mut self, gx: i32, gy: i32, tile_type: &str, z: i32) -> bool {
        if gx < 0 || gy < 0 || gx >= WORLD_SIZE || gy >= WORLD_SIZE {
            return false;
        }
        let tile_type: TileType = match tile_type.parse() {
            Ok(parsed) => parsed,
            Err(_) => return false,
        };
        if self.world.get(gx, gy).is_some() {
            return false;
        }

        self.world.place(Tile::new(gx, gy, z, tile_type));

        let coord = TileCoord::new(gx, gy);
        self.connectivity.add(coord, tile_type);

        // Merge with each live 8-neighbor, mirroring the TS union loop.
        let mut consumed_roots = Vec::new();
        for (dx, dy) in NEIGHBORS_8 {
            let neighbor = TileCoord::new(gx + dx, gy + dy);
            if !self.connectivity.has(neighbor) {
                continue;
            }
            let root_a = self.connectivity.find(coord);
            let root_b = self.connectivity.find(neighbor);
            if root_a == root_b {
                continue;
            }
            let new_root = self.connectivity.union(root_a, root_b);
            consumed_roots.push(if new_root == root_a { root_b } else { root_a });
        }

        let stats: ComponentStats = self.connectivity.stats(coord);
        self.registry.sync(&mut self.ecs, &stats, &consumed_roots);
        self.pressure.add_source(coord, tile_type);
        true
    }

    /// Reset the engine to a fresh, empty world.
    pub fn reset(&mut self) {
        *self = Self::new();
    }

    /// Number of tiles committed to the world.
    pub fn tile_count(&self) -> u32 {
        self.world.count() as u32
    }

    /// Number of live module entities (canopy/trunk/taproot/glyph/wound).
    pub fn module_count(&self) -> u32 {
        self.ecs.query(self.registry.module_component()).len() as u32
    }

    /// JSON array of the module types currently live, e.g. `["taproot"]`.
    pub fn module_types_json(&self) -> String {
        let module = self.registry.module_component();
        let names: Vec<&str> = self
            .ecs
            .query(module)
            .iter()
            .filter_map(|entity| self.ecs.get(*entity, module))
            .map(|module| module.module_type.as_str())
            .collect();
        format!(
            "[{}]",
            names
                .iter()
                .map(|name| format!("\"{name}\""))
                .collect::<Vec<_>>()
                .join(",")
        )
    }

    /// Raw pressure at a coordinate (0 outside the world).
    pub fn pressure_at(&self, gx: i32, gy: i32) -> f32 {
        self.pressure.pressure_at(TileCoord::new(gx, gy))
    }

    /// Normalized ground darkening in `[0, 1]` — the diegetic pressure UI.
    pub fn darkness_at(&self, gx: i32, gy: i32) -> f32 {
        self.pressure.darkness_at(TileCoord::new(gx, gy))
    }

    /// The highest pressure anywhere in the world.
    pub fn max_pressure(&self) -> f32 {
        self.pressure.max_pressure()
    }

    /// Number of 8-connected hotspots at or above the configured threat
    /// threshold (what M3 will spawn from).
    pub fn threat_peak_count(&self) -> u32 {
        self.pressure.threat_peaks().len() as u32
    }

    /// JSON array of threat peaks, strongest first:
    /// `[{"x":3.0,"y":4.0,"max":25.6,"cells":5}]`.
    pub fn threat_peaks_json(&self) -> String {
        let body = self
            .pressure
            .threat_peaks()
            .iter()
            .map(|peak| {
                format!(
                    "{{\"x\":{:.3},\"y\":{:.3},\"max\":{:.3},\"cells\":{}}}",
                    peak.centroid.x, peak.centroid.y, peak.max_pressure, peak.cells
                )
            })
            .collect::<Vec<_>>()
            .join(",");
        format!("[{body}]")
    }

    /// Side length of the (square) world, in tiles.
    pub fn world_size(&self) -> i32 {
        WORLD_SIZE
    }
}
