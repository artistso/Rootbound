//! Module-to-ECS synchronization.
//!
//! Port of `src/game/world/ModuleRegistry.ts`. After every placement, the game
//! computes the current component stats and calls [`ModuleRegistry::sync`]
//! with the list of roots that were merged away during this placement. The
//! registry then:
//!
//! 1. destroys module entities whose roots were consumed by a merge,
//! 2. destroys the module entity if the component no longer classifies, and
//! 3. upserts a module entity (with a pixel-space [`Transform`]) otherwise.

use crate::classifier::classify;
use crate::components::{Module, Transform};
use crate::connectivity::ComponentStats;
use crate::ecs::{define_component, Component, Entity, World};
use crate::types::TileCoord;
use crate::TILE_PX;
use std::collections::HashMap;

pub struct ModuleRegistry {
    root_to_module: HashMap<TileCoord, Entity>,
    transform: Component<Transform>,
    module: Component<Module>,
}

impl ModuleRegistry {
    pub fn new() -> Self {
        Self {
            root_to_module: HashMap::new(),
            transform: define_component("Transform"),
            module: define_component("Module"),
        }
    }

    /// The [`Component<Module>`] handle, for querying the ECS world.
    pub fn module_component(&self) -> &Component<Module> {
        &self.module
    }

    /// The [`Component<Transform>`] handle, for querying the ECS world.
    pub fn transform_component(&self) -> &Component<Transform> {
        &self.transform
    }

    pub fn sync(
        &mut self,
        world: &mut World,
        stats: &ComponentStats,
        consumed_roots: &[TileCoord],
    ) {
        // Destroy modules whose roots were merged away.
        for root in consumed_roots {
            if let Some(entity) = self.root_to_module.remove(root) {
                world.destroy(entity);
            }
        }

        let module_type = classify(stats);
        let existing = self.root_to_module.get(&stats.root).copied();

        let Some(module_type) = module_type else {
            if let Some(entity) = existing {
                world.destroy(entity);
                self.root_to_module.remove(&stats.root);
            }
            return;
        };

        let pixel_x = (stats.centroid.x + 0.5) as f32 * TILE_PX;
        let pixel_y = (stats.centroid.y + 0.5) as f32 * TILE_PX;

        match existing {
            None => {
                let entity = world.create();
                world.add(
                    entity,
                    &self.module,
                    Module {
                        module_type,
                        component_root: stats.root,
                        centroid: stats.centroid,
                        tile_count: stats.tile_count,
                    },
                );
                world.add(
                    entity,
                    &self.transform,
                    Transform {
                        x: pixel_x,
                        y: pixel_y,
                        angle: 0.0,
                    },
                );
                self.root_to_module.insert(stats.root, entity);
            }
            Some(entity) => {
                if let Some(module) = world.get_mut(entity, &self.module) {
                    module.module_type = module_type;
                    module.centroid = stats.centroid;
                    module.tile_count = stats.tile_count;
                }
                if let Some(transform) = world.get_mut(entity, &self.transform) {
                    transform.x = pixel_x;
                    transform.y = pixel_y;
                }
            }
        }
    }
}
