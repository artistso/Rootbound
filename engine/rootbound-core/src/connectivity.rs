//! Eight-connected union-find connectivity.
//!
//! Port of `src/game/world/Connectivity.ts`. Tracks per-component tile sets,
//! type histograms, tile counts, and running centroid sums so components can
//! be merged incrementally as tiles are placed.

use crate::types::{TileCoord, TileType, Vec2};
use std::collections::{HashMap, HashSet};

/// The eight king-move neighbor offsets, in the same order as the TypeScript
/// `NEIGHBORS_8` constant.
pub const NEIGHBORS_8: [(i32, i32); 8] = [
    (-1, -1),
    (0, -1),
    (1, -1),
    (-1, 0),
    (1, 0),
    (-1, 1),
    (0, 1),
    (1, 1),
];

/// A snapshot of one connected component, computed on demand.
#[derive(Debug, Clone, PartialEq)]
pub struct ComponentStats {
    pub root: TileCoord,
    pub tile_count: u32,
    pub type_counts: HashMap<TileType, u32>,
    pub centroid: Vec2,
}

impl ComponentStats {
    pub fn count_of(&self, tile_type: TileType) -> u32 {
        self.type_counts.get(&tile_type).copied().unwrap_or(0)
    }
}

pub struct Connectivity {
    parent: HashMap<TileCoord, TileCoord>,
    rank: HashMap<TileCoord, u32>,
    tiles: HashMap<TileCoord, HashSet<TileCoord>>,
    type_counts: HashMap<TileCoord, HashMap<TileType, u32>>,
    centroid_sum: HashMap<TileCoord, (f64, f64)>,
    tile_count: HashMap<TileCoord, u32>,
}

impl Default for Connectivity {
    fn default() -> Self {
        Self::new()
    }
}

impl Connectivity {
    pub fn new() -> Self {
        Self {
            parent: HashMap::new(),
            rank: HashMap::new(),
            tiles: HashMap::new(),
            type_counts: HashMap::new(),
            centroid_sum: HashMap::new(),
            tile_count: HashMap::new(),
        }
    }

    pub fn has(&self, coord: TileCoord) -> bool {
        self.parent.contains_key(&coord)
    }

    /// Find the root of `coord` with path halving. A never-added coordinate
    /// resolves to itself, matching the TypeScript behavior of returning the
    /// key when no parent entry exists.
    pub fn find(&mut self, coord: TileCoord) -> TileCoord {
        let mut root = coord;
        while let Some(&next) = self.parent.get(&root) {
            if next == root {
                break;
            }
            root = next;
        }
        let mut cursor = coord;
        while let Some(&next) = self.parent.get(&cursor) {
            if next == cursor || next == root {
                break;
            }
            self.parent.insert(cursor, root);
            cursor = next;
        }
        root
    }

    /// Root resolution for read-only paths. Skips path compression so callers
    /// can take `&self`; asymptotically identical, just without the constant
    /// factor the compressing [`Connectivity::find`] provides.
    fn root_of(&self, coord: TileCoord) -> TileCoord {
        let mut root = coord;
        while let Some(&next) = self.parent.get(&root) {
            if next == root {
                break;
            }
            root = next;
        }
        root
    }

    /// Add a tile. Idempotent: adding an existing tile returns the current root.
    pub fn add(&mut self, coord: TileCoord, tile_type: TileType) -> TileCoord {
        if self.parent.contains_key(&coord) {
            return self.root_of(coord);
        }
        self.parent.insert(coord, coord);
        self.rank.insert(coord, 0);
        self.tiles.insert(coord, HashSet::from([coord]));
        self.type_counts.insert(coord, HashMap::from([(tile_type, 1)]));
        self.centroid_sum
            .insert(coord, (coord.gx as f64, coord.gy as f64));
        self.tile_count.insert(coord, 1);
        coord
    }

    /// Union the components containing `a` and `b`. Returns the root that wins.
    pub fn union(&mut self, a: TileCoord, b: TileCoord) -> TileCoord {
        let ra = self.find(a);
        let rb = self.find(b);
        if ra == rb {
            return ra;
        }

        let rank_a = self.rank.get(&ra).copied().unwrap_or(0);
        let rank_b = self.rank.get(&rb).copied().unwrap_or(0);
        let (new_root, child) = if rank_a >= rank_b { (ra, rb) } else { (rb, ra) };

        self.parent.insert(child, new_root);
        if rank_a == rank_b {
            self.rank.insert(new_root, rank_a + 1);
        }

        let mut new_tiles = self.tiles.remove(&new_root).unwrap_or_default();
        if let Some(child_tiles) = self.tiles.remove(&child) {
            new_tiles.extend(child_tiles);
        }
        self.tiles.insert(new_root, new_tiles);

        let mut new_counts = self.type_counts.remove(&new_root).unwrap_or_default();
        if let Some(child_counts) = self.type_counts.remove(&child) {
            for (tile_type, n) in child_counts {
                *new_counts.entry(tile_type).or_insert(0) += n;
            }
        }
        self.type_counts.insert(new_root, new_counts);

        let (mut sum_x, mut sum_y) = self.centroid_sum.remove(&new_root).unwrap_or((0.0, 0.0));
        if let Some((child_x, child_y)) = self.centroid_sum.remove(&child) {
            sum_x += child_x;
            sum_y += child_y;
        }
        self.centroid_sum.insert(new_root, (sum_x, sum_y));

        let new_count = self.tile_count.remove(&new_root).unwrap_or(0)
            + self.tile_count.remove(&child).unwrap_or(0);
        self.tile_count.insert(new_root, new_count);

        self.rank.remove(&child);
        new_root
    }

    /// Snapshot the component containing `root` (the argument may name any
    /// member; it is resolved to the current root first).
    pub fn stats(&self, root: TileCoord) -> ComponentStats {
        let root = self.root_of(root);
        let count = self.tile_count.get(&root).copied().unwrap_or(0);
        let (sum_x, sum_y) = self.centroid_sum.get(&root).copied().unwrap_or((0.0, 0.0));
        let divisor = if count == 0 { 1.0 } else { count as f64 };
        ComponentStats {
            root,
            tile_count: count,
            type_counts: self.type_counts.get(&root).cloned().unwrap_or_default(),
            centroid: Vec2::new(sum_x / divisor, sum_y / divisor),
        }
    }

    /// All tiles in the component containing `coord`. Useful for debug HUDs
    /// and for M6 cycle detection.
    pub fn component_tiles(&self, coord: TileCoord) -> Vec<TileCoord> {
        let root = self.root_of(coord);
        self.tiles
            .get(&root)
            .map(|tiles| tiles.iter().copied().collect())
            .unwrap_or_default()
    }

    /// The in-world neighbors of `coord` that currently exist, in
    /// [`NEIGHBORS_8`] order.
    pub fn neighbors_of(&self, coord: TileCoord) -> Vec<TileCoord> {
        NEIGHBORS_8
            .iter()
            .map(|(dx, dy)| TileCoord::new(coord.gx + dx, coord.gy + dy))
            .filter(|neighbor| self.parent.contains_key(neighbor))
            .collect()
    }
}
