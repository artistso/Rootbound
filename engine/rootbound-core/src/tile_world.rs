//! Chunked tile storage.
//!
//! Port of `src/game/world/TileWorld.ts`. Chunks are 32x32 tiles; dirty chunks
//! are tracked so a frontend can redraw only what changed.

use crate::types::{Tile, TileCoord};
use crate::CHUNK_SIZE;
use std::collections::{HashMap, HashSet};

/// 32x32-tile chunks keyed by chunk coordinate.
#[derive(Default)]
pub struct TileWorld {
    chunks: HashMap<(i32, i32), HashMap<TileCoord, Tile>>,
    dirty: Vec<(i32, i32)>,
    dirty_set: HashSet<(i32, i32)>,
}

impl TileWorld {
    pub fn new() -> Self {
        Self::default()
    }

    /// Chunk coordinates containing a tile. Uses floor division, so negative
    /// coordinates behave exactly as in the TypeScript original.
    pub fn chunk_of(gx: i32, gy: i32) -> (i32, i32) {
        (gx.div_euclid(CHUNK_SIZE), gy.div_euclid(CHUNK_SIZE))
    }

    pub fn place(&mut self, tile: Tile) {
        let key = Self::chunk_of(tile.gx, tile.gy);
        self.chunks
            .entry(key)
            .or_default()
            .insert(tile.coord(), tile);
        self.mark_dirty(key);
    }

    pub fn remove(&mut self, gx: i32, gy: i32) {
        let key = Self::chunk_of(gx, gy);
        if let Some(chunk) = self.chunks.get_mut(&key) {
            chunk.remove(&TileCoord::new(gx, gy));
        }
        self.mark_dirty(key);
    }

    pub fn get(&self, gx: i32, gy: i32) -> Option<&Tile> {
        let key = Self::chunk_of(gx, gy);
        self.chunks.get(&key)?.get(&TileCoord::new(gx, gy))
    }

    /// All tiles in a chunk, in unspecified order.
    pub fn chunk_tiles(&self, cx: i32, cy: i32) -> Vec<Tile> {
        self.chunks
            .get(&(cx, cy))
            .map(|chunk| chunk.values().copied().collect())
            .unwrap_or_default()
    }

    pub fn count(&self) -> usize {
        self.chunks.values().map(HashMap::len).sum()
    }

    /// Returns the chunks dirtied since the last call, in insertion order,
    /// and clears the dirty set. Mirrors `TileWorld.consumeDirty()`.
    pub fn consume_dirty(&mut self) -> Vec<(i32, i32)> {
        self.dirty_set.clear();
        std::mem::take(&mut self.dirty)
    }

    fn mark_dirty(&mut self, key: (i32, i32)) {
        if self.dirty_set.insert(key) {
            self.dirty.push(key);
        }
    }
}
