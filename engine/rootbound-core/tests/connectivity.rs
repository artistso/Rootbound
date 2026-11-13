use rootbound_core::{Connectivity, TileCoord, TileType};

fn coord(gx: i32, gy: i32) -> TileCoord {
    TileCoord::new(gx, gy)
}

#[test]
fn adds_isolated_tiles_and_computes_component_stats() {
    let mut connectivity = Connectivity::new();
    let root = connectivity.add(coord(2, 3), TileType::Root);

    assert!(connectivity.has(coord(2, 3)));
    let stats = connectivity.stats(root);
    assert_eq!(stats.root, root);
    assert_eq!(stats.tile_count, 1);
    assert_eq!(stats.centroid.x, 2.0);
    assert_eq!(stats.centroid.y, 3.0);
    assert_eq!(stats.type_counts.get(&TileType::Root), Some(&1));
}

#[test]
fn unions_components_preserving_tiles_counts_and_centroid() {
    let mut connectivity = Connectivity::new();
    connectivity.add(coord(0, 0), TileType::Root);
    connectivity.add(coord(1, 0), TileType::Root);
    connectivity.add(coord(2, 0), TileType::Bloom);

    let neighbors = connectivity.neighbors_of(coord(1, 0));
    assert!(neighbors.contains(&coord(0, 0)));
    assert!(neighbors.contains(&coord(2, 0)));

    let first = connectivity.union(coord(0, 0), coord(1, 0));
    let root = connectivity.union(first, coord(2, 0));
    let stats = connectivity.stats(coord(0, 0));

    assert_eq!(stats.root, root);
    assert_eq!(stats.tile_count, 3);
    assert_eq!(stats.centroid.x, 1.0);
    assert_eq!(stats.centroid.y, 0.0);
    assert_eq!(stats.type_counts.get(&TileType::Root), Some(&2));
    assert_eq!(stats.type_counts.get(&TileType::Bloom), Some(&1));

    let mut found = connectivity.find(coord(2, 0));
    assert_eq!(found, root);
    // Re-running find on a path-compressed node keeps working.
    found = connectivity.find(coord(0, 0));
    assert_eq!(found, root);
}

#[test]
fn supports_diagonal_neighbors_and_ignores_duplicate_additions() {
    let mut connectivity = Connectivity::new();
    let root = connectivity.add(coord(4, 4), TileType::Stem);
    connectivity.add(coord(5, 5), TileType::Leaf);

    assert!(connectivity.neighbors_of(coord(4, 4)).contains(&coord(5, 5)));
    assert_eq!(connectivity.add(coord(4, 4), TileType::Stem), root);
    assert_eq!(connectivity.stats(root).tile_count, 1);
}

#[test]
fn distant_tiles_stay_in_separate_components() {
    let mut connectivity = Connectivity::new();
    connectivity.add(coord(0, 0), TileType::Stem);
    connectivity.add(coord(100, 100), TileType::Stem);

    let a = connectivity.find(coord(0, 0));
    let b = connectivity.find(coord(100, 100));
    assert_ne!(a, b);
}

#[test]
fn component_tiles_lists_every_member() {
    let mut connectivity = Connectivity::new();
    connectivity.add(coord(0, 0), TileType::Stem);
    connectivity.add(coord(1, 0), TileType::Stem);
    connectivity.add(coord(50, 50), TileType::Leaf);
    connectivity.union(coord(0, 0), coord(1, 0));

    let mut members = connectivity.component_tiles(coord(0, 0));
    members.sort();
    assert_eq!(members, vec![coord(0, 0), coord(1, 0)]);
}
