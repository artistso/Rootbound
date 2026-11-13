//! A deliberately small ECS: entities are IDs and components are plain data.
//!
//! Port of `src/core/ecs/{types,world}.ts`, adapted to Rust's type system.
//! Instead of `ComponentType<T>` keys stored in a map of name -> unknown, this
//! uses `TypeId` internally while keeping an explicit `name` for diagnostics.
//!
//! Intentional divergences from the TypeScript original:
//! * `query` is split into `query`, `query2`, and `entities` (Rust cannot
//!   spread heterogeneous component arguments through one generic function).
//! * Query results are sorted by entity ID. The TypeScript version returned
//!   first-store insertion order, which is observable but not meaningful.

use std::any::{Any, TypeId};
use std::collections::{HashMap, HashSet};
use std::marker::PhantomData;

pub type Entity = u64;

/// A typed handle to one component kind.
pub struct Component<T: 'static> {
    name: &'static str,
    type_id: TypeId,
    marker: PhantomData<fn() -> T>,
}

impl<T: 'static> Component<T> {
    pub fn new(name: &'static str) -> Self {
        Self {
            name,
            type_id: TypeId::of::<T>(),
            marker: PhantomData,
        }
    }

    pub fn name(&self) -> &'static str {
        self.name
    }

    fn type_id(&self) -> TypeId {
        self.type_id
    }
}

/// Mirror of the TypeScript `defineComponent` helper.
pub fn define_component<T: 'static>(name: &'static str) -> Component<T> {
    Component::new(name)
}

/// A system is anything that can advance the world by `delta_ms` milliseconds.
pub trait System {
    fn update(&mut self, world: &mut World, delta_ms: f32);
}

pub struct World {
    next_entity: Entity,
    entities: HashSet<Entity>,
    stores: HashMap<TypeId, HashMap<Entity, Box<dyn Any>>>,
    systems: Vec<Box<dyn System>>,
}

impl World {
    pub fn new() -> Self {
        Self {
            next_entity: 1,
            entities: HashSet::new(),
            stores: HashMap::new(),
            systems: Vec::new(),
        }
    }

    pub fn create(&mut self) -> Entity {
        let entity = self.next_entity;
        self.next_entity += 1;
        self.entities.insert(entity);
        entity
    }

    pub fn destroy(&mut self, entity: Entity) {
        if self.entities.remove(&entity).is_none() {
            return;
        }
        for store in self.stores.values_mut() {
            store.remove(&entity);
        }
    }

    pub fn has(&self, entity: Entity) -> bool {
        self.entities.contains(&entity)
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    pub fn add<T: 'static>(&mut self, entity: Entity, component: &Component<T>, value: T) {
        if !self.entities.contains(&entity) {
            panic!(
                "Cannot add {} to missing entity {}",
                component.name(),
                entity
            );
        }
        self.stores
            .entry(component.type_id())
            .or_default()
            .insert(entity, Box::new(value));
    }

    pub fn get<T: 'static>(&self, entity: Entity, component: &Component<T>) -> Option<&T> {
        self.stores
            .get(&component.type_id())?
            .get(&entity)?
            .downcast_ref::<T>()
    }

    pub fn get_mut<T: 'static>(
        &mut self,
        entity: Entity,
        component: &Component<T>,
    ) -> Option<&mut T> {
        self.stores
            .get_mut(&component.type_id())?
            .get_mut(&entity)?
            .downcast_mut::<T>()
    }

    /// Every live entity holding `A`, sorted by entity ID.
    pub fn query<A: 'static>(&self, a: &Component<A>) -> Vec<Entity> {
        self.query_ids(&[a.type_id()])
    }

    /// Every live entity holding both `A` and `B`, sorted by entity ID.
    pub fn query2<A: 'static, B: 'static>(
        &self,
        a: &Component<A>,
        b: &Component<B>,
    ) -> Vec<Entity> {
        self.query_ids(&[a.type_id(), b.type_id()])
    }

    /// Every live entity, sorted by entity ID.
    pub fn entities(&self) -> Vec<Entity> {
        let mut entities: Vec<Entity> = self.entities.iter().copied().collect();
        entities.sort_unstable();
        entities
    }

    fn query_ids(&self, type_ids: &[TypeId]) -> Vec<Entity> {
        let mut stores = Vec::with_capacity(type_ids.len());
        for id in type_ids {
            match self.stores.get(id) {
                Some(store) => stores.push(store),
                None => return Vec::new(),
            }
        }
        let (first, rest) = match stores.split_first() {
            Some(parts) => parts,
            None => return self.entities(),
        };
        let mut matches: Vec<Entity> = first
            .keys()
            .filter(|entity| {
                self.entities.contains(*entity)
                    && rest.iter().all(|store| store.contains_key(*entity))
            })
            .copied()
            .collect();
        matches.sort_unstable();
        matches
    }

    pub fn add_system(&mut self, system: Box<dyn System>) {
        self.systems.push(system);
    }

    pub fn update(&mut self, delta_ms: f32) {
        // Taken out so systems may receive &mut World while iterating. If a
        // system panics, the remaining systems are dropped rather than left
        // in a half-run state; treat panics in systems as fatal.
        let mut systems = std::mem::take(&mut self.systems);
        for system in &mut systems {
            system.update(self, delta_ms);
        }
        self.systems = systems;
    }
}
