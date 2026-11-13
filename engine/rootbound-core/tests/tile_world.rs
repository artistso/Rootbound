use rootbound_core::{Tile, TileCoord, TileType, TileWorld};

fn stem(gx: i32, gy: i32) -> Tile {
    Tile::new(gx, gy, 0, TileType::Stem)
}

#[test]
fn stores_retrieves_and_removes_tiles() {
    let mut world = TileWorld::new();
    world.place(stem(2, 3));

    assert_eq!(world.get(2, 3), Some(&stem(2, 3)));
    assert_eq!(world.count(), 1);
    assert_eq!(world.chunk_tiles(0, 0), vec![stem(2, 3)]);

    world.remove(2, 3);
    assert_eq!(world.get(2, 3), None);
    assert_eq!(world.count(), 0);
}

#[test]
fn tracks_dirty_chunks_once_until_consumed() {
    let mut world = TileWorld::new();
    world.place(stem(2, 3));
    world.place(stem(3, 3));

    assert_eq!(world.consume_dirty(), vec![(0, 0)]);
    assert_eq!(world.consume_dirty(), Vec::<(i32, i32)>::new());

    world.remove(2, 3);
    assert_eq!(world.consume_dirty(), vec![(0, 0)]);
}

#[test]
fn chunk_of_uses_floor_division_for_negative_coordinates() {
    assert_eq!(TileWorld::chunk_of(-1, -33), (-1, -2));
}

#[test]
fn tiles_land_in_separate_chunks() {
    let mut world = TileWorld::new();
    world.place(stem(0, 0));
    world.place(stem(40, 0));

    assert_eq!(world.chunk_tiles(0, 0).len(), 1);
    assert_eq!(world.chunk_tiles(1, 0).len(), 1);
    assert_eq!(world.count(), 2);
}

#[test]
fn tile_coord_round_trips_through_its_canonical_key() {
    let coord = TileCoord::new(-12, 305);
    let key = coord.to_key();
    assert_eq!(key, "-12,305");
    assert_eq!(key.parse::<TileCoord>().unwrap(), coord);
    assert!("nope".parse::<TileCoord>().is_err());
    assert!("1,2,3".parse::<TileCoord>().is_err());
}
