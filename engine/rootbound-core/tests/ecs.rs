use rootbound_core::ecs::{define_component, System, World};
use std::sync::{Arc, Mutex};

#[derive(Debug, PartialEq)]
struct Position {
    x: f32,
}

#[derive(Debug)]
struct Health {
    value: u32,
}

#[test]
fn creates_entities_and_adds_typed_components() {
    let position = define_component::<Position>("Position");
    let health = define_component::<Health>("Health");

    let mut world = World::new();
    let entity = world.create();
    world.add(entity, &position, Position { x: 4.0 });

    assert!(world.has(entity));
    assert_eq!(world.get(entity, &position), Some(&Position { x: 4.0 }));
    assert_eq!(world.query(&position), vec![entity]);
    assert_eq!(world.query(&health), Vec::<u64>::new());
}

#[test]
fn queries_only_entities_holding_every_component() {
    let position = define_component::<Position>("Position");
    let health = define_component::<Health>("Health");

    let mut world = World::new();
    let positioned = world.create();
    let complete = world.create();
    world.add(positioned, &position, Position { x: 1.0 });
    world.add(complete, &position, Position { x: 2.0 });
    world.add(complete, &health, Health { value: 10 });

    assert_eq!(world.query2(&position, &health), vec![complete]);
}

#[test]
fn query_results_are_sorted_by_entity_id() {
    let position = define_component::<Position>("Position");

    let mut world = World::new();
    let first = world.create();
    let second = world.create();
    let third = world.create();
    for entity in [third, first, second] {
        world.add(entity, &position, Position { x: 0.0 });
    }

    assert_eq!(world.query(&position), vec![first, second, third]);
}

#[test]
fn removes_all_component_data_when_an_entity_is_destroyed() {
    let position = define_component::<Position>("Position");

    let mut world = World::new();
    let entity = world.create();
    world.add(entity, &position, Position { x: 1.0 });
    world.destroy(entity);

    assert!(!world.has(entity));
    assert_eq!(world.get(entity, &position), None);
    assert_eq!(world.query(&position), Vec::<u64>::new());
}

#[test]
fn destroying_a_missing_entity_is_a_no_op() {
    let mut world = World::new();
    world.destroy(999);
    assert_eq!(world.entity_count(), 0);
}

#[test]
#[should_panic(expected = "missing entity")]
fn adding_to_a_missing_entity_panics() {
    let position = define_component::<Position>("Position");
    let mut world = World::new();
    world.add(999, &position, Position { x: 1.0 });
}

struct RecordingSystem {
    deltas: Arc<Mutex<Vec<f32>>>,
}

impl System for RecordingSystem {
    fn update(&mut self, _world: &mut World, delta_ms: f32) {
        self.deltas.lock().expect("deltas lock poisoned").push(delta_ms);
    }
}

#[test]
fn systems_receive_the_world_and_delta() {
    let deltas = Arc::new(Mutex::new(Vec::new()));
    let mut world = World::new();
    world.add_system(Box::new(RecordingSystem {
        deltas: Arc::clone(&deltas),
    }));

    world.update(16.67);
    assert_eq!(deltas.lock().expect("deltas lock poisoned").as_slice(), &[16.67]);
}
