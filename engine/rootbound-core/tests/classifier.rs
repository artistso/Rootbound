use rootbound_core::{classify, ComponentStats, ModuleType, TileCoord, TileType, Vec2};
use std::collections::HashMap;

fn stats(counts: &[(TileType, u32)]) -> ComponentStats {
    ComponentStats {
        root: TileCoord::new(0, 0),
        tile_count: counts.iter().map(|(_, count)| count).sum(),
        type_counts: counts.iter().copied().collect::<HashMap<_, _>>(),
        centroid: Vec2::ZERO,
    }
}

#[test]
fn leaves_clusters_below_the_module_threshold_unclassified() {
    assert_eq!(classify(&stats(&[(TileType::Root, 2)])), None);
}

#[test]
fn classifies_each_module_pattern() {
    assert_eq!(
        classify(&stats(&[(TileType::Glyph, 1), (TileType::Stem, 2)])),
        Some(ModuleType::Glyph)
    );
    assert_eq!(
        classify(&stats(&[(TileType::Bloom, 2), (TileType::Stem, 3)])),
        Some(ModuleType::Canopy)
    );
    assert_eq!(
        classify(&stats(&[(TileType::Root, 4)])),
        Some(ModuleType::Taproot)
    );
    assert_eq!(
        classify(&stats(&[(TileType::Leaf, 3), (TileType::Stem, 2)])),
        Some(ModuleType::Trunk)
    );
    assert_eq!(
        classify(&stats(&[(TileType::Leaf, 1), (TileType::Root, 1), (TileType::Stem, 1)])),
        Some(ModuleType::Wound)
    );
}

#[test]
fn uses_the_documented_priority_when_multiple_rules_match() {
    assert_eq!(
        classify(&stats(&[(TileType::Glyph, 1), (TileType::Bloom, 2), (TileType::Stem, 3)])),
        Some(ModuleType::Glyph)
    );
    assert_eq!(
        classify(&stats(&[(TileType::Root, 4), (TileType::Leaf, 3), (TileType::Stem, 2)])),
        Some(ModuleType::Taproot)
    );
}
