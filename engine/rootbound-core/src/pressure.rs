//! Visible pressure propagation (M2).
//!
//! Design (see `docs/PROPOSAL.md` and issue #1): every placed tile emits
//! pressure into the world. Pressure radiates outward from its source, decays
//! exponentially with Euclidean distance, and is meant to be *seen* — the
//! frontend darkens the ground proportionally to [`PressureField::darkness_at`].
//! Above [`PressureConfig::threat_threshold`] the field reports threat peaks;
//! M3 will consume those to spawn root-worms and rots from the world's edge.
//!
//! The field is a dense `size x size` grid of `f32` (1 MiB at the default
//! 512x512 world). Recomputation is proportional to `sources * pi * radius^2`
//! and happens eagerly on add/remove, which keeps reads allocation-free and
//! deterministic; placement is infrequent enough that this is the right
//! trade. If source counts ever grow large, swap `recompute` for an
//! incremental splat without changing the public API.

use crate::types::{TileCoord, TileType, Vec2};
use crate::WORLD_SIZE;
use std::collections::HashMap;

/// Tunable pressure configuration. These are the engine-side counterparts of
/// the `config.ts` constants; the values are starting points for playtesting,
/// not balanced numbers.
#[derive(Debug, Clone, PartialEq)]
pub struct PressureConfig {
    /// Pressure emitted at a source cell before distance decay and type weight.
    pub source_strength: f32,
    /// Multiplicative decay per tile of distance (0 < decay < 1).
    pub decay: f32,
    /// Maximum propagation radius in tiles; beyond it, pressure is exactly 0.
    pub radius: i32,
    /// Pressure at which ground darkening saturates to fully dark.
    pub full_darkness_pressure: f32,
    /// Pressure at or above which a threat peak is reported.
    pub threat_threshold: f32,
    /// Per-tile-type source multipliers, indexed by [`TileType::index`].
    pub type_weights: [f32; 5],
}

impl Default for PressureConfig {
    fn default() -> Self {
        Self {
            source_strength: 10.0,
            decay: 0.78,
            radius: 18,
            full_darkness_pressure: 8.0,
            threat_threshold: 20.0,
            type_weights: [1.0; 5],
        }
    }
}

/// A cluster of cells at or above a threshold, reduced to its peak. This is
/// the M3 hook: threats spawn toward these points, not toward individual
/// over-threshold cells.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PressurePeak {
    /// Arithmetic mean of the contributing cells, in tile coordinates.
    pub centroid: Vec2,
    /// The highest pressure anywhere in the cluster.
    pub max_pressure: f32,
    /// Number of cells at or above the threshold.
    pub cells: u32,
}

pub struct PressureField {
    config: PressureConfig,
    size: i32,
    cells: Vec<f32>,
    sources: HashMap<TileCoord, f32>,
}

impl PressureField {
    /// A field sized to the default world ([`crate::WORLD_SIZE`]).
    pub fn new(config: PressureConfig) -> Self {
        Self::with_size(config, WORLD_SIZE)
    }

    /// A field sized `size` x `size`. Exposed for tests and future smaller maps.
    pub fn with_size(config: PressureConfig, size: i32) -> Self {
        assert!(size > 0, "pressure field size must be positive");
        assert!(config.decay > 0.0 && config.decay <= 1.0, "decay must be in (0, 1]");
        assert!(config.radius >= 0, "radius must be non-negative");
        assert!(config.source_strength >= 0.0, "source strength must be non-negative");

        Self {
            config,
            size,
            cells: vec![0.0; (size * size) as usize],
            sources: HashMap::new(),
        }
    }

    pub fn config(&self) -> &PressureConfig {
        &self.config
    }

    pub fn size(&self) -> i32 {
        self.size
    }

    pub fn source_count(&self) -> usize {
        self.sources.len()
    }

    /// Add (or replace) a pressure source at `coord` for a tile of `tile_type`.
    /// Returns `false` if the coordinate lies outside the field.
    pub fn add_source(&mut self, coord: TileCoord, tile_type: TileType) -> bool {
        if !self.in_bounds(coord) {
            return false;
        }
        let strength =
            self.config.source_strength * self.config.type_weights[tile_type.index()];
        self.sources.insert(coord, strength);
        self.recompute();
        true
    }

    /// Remove the source at `coord`, if any. Returns `true` if one existed.
    pub fn remove_source(&mut self, coord: TileCoord) -> bool {
        let removed = self.sources.remove(&coord).is_some();
        if removed {
            self.recompute();
        }
        removed
    }

    pub fn clear(&mut self) {
        self.sources.clear();
        for cell in &mut self.cells {
            *cell = 0.0;
        }
    }

    /// Raw pressure at a coordinate; 0.0 outside the field.
    pub fn pressure_at(&self, coord: TileCoord) -> f32 {
        match self.index(coord) {
            Some(index) => self.cells[index],
            None => 0.0,
        }
    }

    /// Normalized darkening in `[0, 1]` for rendering the ground. This is the
    /// whole "UI" of pressure: no numbers, just darkening.
    pub fn darkness_at(&self, coord: TileCoord) -> f32 {
        let full = self.config.full_darkness_pressure;
        if full <= 0.0 {
            return 1.0;
        }
        (self.pressure_at(coord) / full).clamp(0.0, 1.0)
    }

    /// The highest pressure anywhere in the field.
    pub fn max_pressure(&self) -> f32 {
        self.cells.iter().copied().fold(0.0_f32, f32::max)
    }

    /// Sum of all pressure cells. Mainly useful for tests and telemetry.
    pub fn total_pressure(&self) -> f32 {
        self.cells.iter().copied().sum()
    }

    /// Every 8-connected cluster of cells at or above `threshold`, ordered by
    /// peak pressure (descending) with ties broken by position for
    /// determinism. Returns an empty vector when nothing qualifies.
    ///
    /// `threshold` must be positive; a non-positive threshold would classify
    /// the entire grid as one peak and is rejected by returning an empty
    /// vector rather than silently scanning 262k cells.
    pub fn peaks_above(&self, threshold: f32) -> Vec<PressurePeak> {
        if threshold <= 0.0 {
            return Vec::new();
        }
        self.collect_peaks(threshold)
    }

    /// Peaks at or above the configured threat threshold (M3 hook).
    pub fn threat_peaks(&self) -> Vec<PressurePeak> {
        self.collect_peaks(self.config.threat_threshold)
    }

    fn collect_peaks(&self, threshold: f32) -> Vec<PressurePeak> {
        let mut visited = vec![false; self.cells.len()];
        let mut peaks = Vec::new();
        let size = self.size as usize;

        for start in 0..self.cells.len() {
            if visited[start] || self.cells[start] < threshold {
                continue;
            }

            // Flood fill this cluster.
            let mut stack = vec![start];
            visited[start] = true;
            let mut sum_x = 0.0_f64;
            let mut sum_y = 0.0_f64;
            let mut max_pressure = 0.0_f32;
            let mut count: u32 = 0;

            while let Some(cell) = stack.pop() {
                let cx = (cell % size) as i32;
                let cy = (cell / size) as i32;
                let pressure = self.cells[cell];
                sum_x += cx as f64;
                sum_y += cy as f64;
                max_pressure = max_pressure.max(pressure);
                count += 1;

                for dy in -1..=1 {
                    for dx in -1..=1 {
                        if dx == 0 && dy == 0 {
                            continue;
                        }
                        let nx = cx + dx;
                        let ny = cy + dy;
                        if nx < 0 || ny < 0 || nx >= self.size || ny >= self.size {
                            continue;
                        }
                        let neighbor = ny as usize * size + nx as usize;
                        if !visited[neighbor] && self.cells[neighbor] >= threshold {
                            visited[neighbor] = true;
                            stack.push(neighbor);
                        }
                    }
                }
            }

            peaks.push(PressurePeak {
                centroid: Vec2::new(sum_x / count as f64, sum_y / count as f64),
                max_pressure,
                cells: count,
            });
        }

        peaks.sort_by(|a, b| {
            b.max_pressure
                .partial_cmp(&a.max_pressure)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.centroid.y.partial_cmp(&b.centroid.y).unwrap_or(std::cmp::Ordering::Equal))
                .then(a.centroid.x.partial_cmp(&b.centroid.x).unwrap_or(std::cmp::Ordering::Equal))
        });
        peaks
    }

    fn in_bounds(&self, coord: TileCoord) -> bool {
        coord.gx >= 0 && coord.gy >= 0 && coord.gx < self.size && coord.gy < self.size
    }

    fn index(&self, coord: TileCoord) -> Option<usize> {
        if self.in_bounds(coord) {
            Some(coord.gy as usize * self.size as usize + coord.gx as usize)
        } else {
            None
        }
    }

    fn recompute(&mut self) {
        for cell in &mut self.cells {
            *cell = 0.0;
        }

        let radius = self.config.radius;
        let radius_sq = (radius * radius) as f32;
        let size = self.size;

        for (source, &strength) in &self.sources {
            for dy in -radius..=radius {
                let ny = source.gy + dy;
                if ny < 0 || ny >= size {
                    continue;
                }
                let dy_sq = (dy * dy) as f32;
                for dx in -radius..=radius {
                    let nx = source.gx + dx;
                    if nx < 0 || nx >= size {
                        continue;
                    }
                    let dist_sq = (dx * dx) as f32 + dy_sq;
                    if dist_sq > radius_sq {
                        continue;
                    }
                    let dist = dist_sq.sqrt();
                    let value = strength * self.config.decay.powf(dist);
                    self.cells[ny as usize * size as usize + nx as usize] += value;
                }
            }
        }
    }
}
