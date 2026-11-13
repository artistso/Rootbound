//! Engine ECS components, mirroring `src/game/components.ts`.

use crate::types::{ModuleType, TileCoord, Vec2};

/// World-space position and facing, in pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Transform {
    pub x: f32,
    pub y: f32,
    pub angle: f32,
}

/// The merged-module identity of a classified cluster.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Module {
    pub module_type: ModuleType,
    pub component_root: TileCoord,
    pub centroid: Vec2,
    pub tile_count: u32,
}
