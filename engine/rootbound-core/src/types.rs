//! Shared vocabulary for the Rootbound engine core.
//!
//! Coordinate system: grid cells are addressed by integer tile coordinates
//! `(gx, gy)`. Tiles are 16 world pixels ([`crate::TILE_PX`]) and are grouped
//! into 32x32-tile chunks ([`crate::CHUNK_SIZE`]). All of this mirrors the
//! TypeScript model in `src/game/config.ts` and `src/game/world/types.ts`;
//! when the two diverge during migration, this crate is the source of truth.

use std::fmt;
use std::str::FromStr;

/// A position on the tile grid.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct TileCoord {
    pub gx: i32,
    pub gy: i32,
}

impl TileCoord {
    pub const fn new(gx: i32, gy: i32) -> Self {
        Self { gx, gy }
    }

    /// The canonical `"gx,gy"` key used by the TypeScript implementation and by
    /// any future JSON interchange format.
    pub fn to_key(self) -> String {
        format!("{},{}", self.gx, self.gy)
    }
}

impl fmt::Display for TileCoord {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{},{}", self.gx, self.gy)
    }
}

/// Error returned when parsing a `"gx,gy"` tile key.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseTileCoordError(String);

impl fmt::Display for ParseTileCoordError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "invalid tile coord key: {:?}", self.0)
    }
}

impl std::error::Error for ParseTileCoordError {}

impl FromStr for TileCoord {
    type Err = ParseTileCoordError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let err = || ParseTileCoordError(s.to_string());
        let (gx, gy) = s.split_once(',').ok_or_else(err)?;
        let gx = gx.trim().parse::<i32>().map_err(|_| err())?;
        let gy = gy.trim().parse::<i32>().map_err(|_| err())?;
        Ok(Self { gx, gy })
    }
}

/// A floating-point 2D vector, used for centroids and other non-cell positions.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec2 {
    pub x: f64,
    pub y: f64,
}

impl Vec2 {
    pub const ZERO: Vec2 = Vec2 { x: 0.0, y: 0.0 };

    pub const fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

/// The five placeable tile types. Discriminants are stable: they double as
/// indices into [`crate::pressure::PressureConfig::type_weights`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(usize)]
pub enum TileType {
    Stem = 0,
    Leaf = 1,
    Root = 2,
    Bloom = 3,
    Glyph = 4,
}

impl TileType {
    pub const ALL: [TileType; 5] = [
        TileType::Stem,
        TileType::Leaf,
        TileType::Root,
        TileType::Bloom,
        TileType::Glyph,
    ];

    /// Index into [`TileType::ALL`] and into `PressureConfig::type_weights`.
    pub const fn index(self) -> usize {
        self as usize
    }

    /// Lowercase name matching the TypeScript `TileType` union.
    pub const fn as_str(self) -> &'static str {
        match self {
            TileType::Stem => "stem",
            TileType::Leaf => "leaf",
            TileType::Root => "root",
            TileType::Bloom => "bloom",
            TileType::Glyph => "glyph",
        }
    }
}

impl fmt::Display for TileType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for TileType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "stem" => Ok(TileType::Stem),
            "leaf" => Ok(TileType::Leaf),
            "root" => Ok(TileType::Root),
            "bloom" => Ok(TileType::Bloom),
            "glyph" => Ok(TileType::Glyph),
            other => Err(format!("unknown tile type: {other:?}")),
        }
    }
}

/// The module types that emerge from classified clusters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ModuleType {
    Trunk,
    Canopy,
    Taproot,
    Glyph,
    Wound,
}

impl ModuleType {
    /// Lowercase name matching the TypeScript `ModuleType` union.
    pub const fn as_str(self) -> &'static str {
        match self {
            ModuleType::Trunk => "trunk",
            ModuleType::Canopy => "canopy",
            ModuleType::Taproot => "taproot",
            ModuleType::Glyph => "glyph",
            ModuleType::Wound => "wound",
        }
    }
}

impl fmt::Display for ModuleType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A single placed tile.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Tile {
    pub gx: i32,
    pub gy: i32,
    pub z: i32,
    pub tile_type: TileType,
}

impl Tile {
    pub const fn new(gx: i32, gy: i32, z: i32, tile_type: TileType) -> Self {
        Self {
            gx,
            gy,
            z,
            tile_type,
        }
    }

    pub const fn coord(&self) -> TileCoord {
        TileCoord {
            gx: self.gx,
            gy: self.gy,
        }
    }
}
