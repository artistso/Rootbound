use rootbound_core::{ComponentStats, ModuleRegistry, ModuleType, TileCoord, TileType, Vec2};
use rootbound_core::ecs::World;
use std::collections::HashMap;

fn stats(gx: i32, gy: i32, tile_count: u32, centroid_x: f64, centroid_y: f64) -> ComponentStats {
    ComponentStats {
        root: TileCoord::new(gx, gy),
        tile_count,
        type_counts: HashMap::from([(TileType::Root, tile_count)]),
        centroid: Vec2::new(centroid_x, centroid_y),
    }
}

#[test]
fn creates_a_module_with_its_transform_in_world_pixel_coordinates() {
    let mut world = World::new();
    let mut registry = ModuleRegistry::new();

    registry.sync(&mut world, &stats(2, 4, 4, 2.0, 4.0), &[]);

    let entities = world.query2(registry.module_component(), registry.transform_component());
    assert_eq!(entities.len(), 1);

    let entity = entities[0];
    let module = world.get(entity, registry.module_component()).expect("module component");
    assert_eq!(module.module_type, ModuleType::Taproot);
    assert_eq!(module.component_root, TileCoord::new(2, 4));
    assert_eq!(module.tile_count, 4);

    let transform = world.get(entity, registry.transform_component()).expect("transform component");
    assert_eq!(transform.x, 40.0);
    assert_eq!(transform.y, 72.0);
    assert_eq!(transform.angle, 0.0);
}

#[test]
fn updates_existing_modules_and_removes_modules_below_the_threshold() {
    let mut world = World::new();
    let mut registry = ModuleRegistry::new();

    registry.sync(&mut world, &stats(2, 4, 4, 2.0, 4.0), &[]);
    let entities = world.query(registry.module_component());
    assert_eq!(entities.len(), 1);
    let entity = entities[0];

    registry.sync(&mut world, &stats(2, 4, 5, 3.0, 4.0), &[]);
    assert_eq!(world.query(registry.module_component()), vec![entity]);
    assert_eq!(
        world.get(entity, registry.transform_component()).map(|t| t.x),
        Some(56.0)
    );

    registry.sync(&mut world, &stats(2, 4, 2, 2.0, 4.0), &[]);
    assert!(world.query(registry.module_component()).is_empty());
    assert!(!world.has(entity));
}

#[test]
fn destroys_entities_for_component_roots_consumed_by_a_merge() {
    let mut world = World::new();
    let mut registry = ModuleRegistry::new();

    registry.sync(&mut world, &stats(0, 0, 4, 0.0, 0.0), &[]);
    registry.sync(&mut world, &stats(5, 0, 4, 5.0, 0.0), &[]);

    registry.sync(&mut world, &stats(0, 0, 8, 2.5, 0.0), &[TileCoord::new(5, 0)]);

    let entities = world.query(registry.module_component());
    assert_eq!(entities.len(), 1);
    assert_eq!(
        world.get(entities[0], registry.module_component()).map(|m| m.tile_count),
        Some(8)
    );
}
