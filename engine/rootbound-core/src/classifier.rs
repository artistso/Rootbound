//! Component-to-module classification rules.
//!
//! Port of `src/game/world/Classifier.ts`. Classification is deterministic and
//! priority-ordered: any cluster of at least `MODULE_MIN_TILES` tiles that
//! matches no pattern is a wound, never an error.

use crate::connectivity::ComponentStats;
use crate::types::{ModuleType, TileType};

/// Clusters smaller than this never become modules.
pub const MODULE_MIN_TILES: u32 = 3;

/// Priority-ordered classification. The order is load-bearing: glyph beats
/// canopy, canopy beats taproot, taproot beats trunk.
pub fn classify(stats: &ComponentStats) -> Option<ModuleType> {
    if stats.tile_count < MODULE_MIN_TILES {
        return None;
    }

    let count = |tile_type: TileType| stats.count_of(tile_type);

    if count(TileType::Glyph) > 0 {
        return Some(ModuleType::Glyph);
    }
    if count(TileType::Bloom) >= 2 && count(TileType::Stem) >= 3 {
        return Some(ModuleType::Canopy);
    }
    if count(TileType::Root) >= 4 {
        return Some(ModuleType::Taproot);
    }
    if count(TileType::Leaf) >= 3 && count(TileType::Stem) >= 2 {
        return Some(ModuleType::Trunk);
    }
    Some(ModuleType::Wound)
}
