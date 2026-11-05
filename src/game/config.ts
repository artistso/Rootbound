export const TILE_PX = 16;
export const CHUNK_SIZE = 32;
export const CHUNK_PX = TILE_PX * CHUNK_SIZE;
export const WORLD_SIZE = 512;
export const WORLD_PX = TILE_PX * WORLD_SIZE;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;
export const ZOOM_STEP = 1.15;
export const ZOOM_SNAP_BELOW = 0.5;
export const ZOOM_STOPS = [0.25, 0.5] as const;

export const TAP_DRAG_THRESHOLD_PX = 5;

export type TileType = 'stem' | 'leaf' | 'root' | 'bloom' | 'glyph';

export const TILE_COLORS: Record<TileType, { top: number; dark: number }> = {
  stem:  { top: 0x6b8e23, dark: 0x4a6319 },
  leaf:  { top: 0x8fbc8f, dark: 0x5d825d },
  root:  { top: 0x8b4513, dark: 0x5c2e0c },
  bloom: { top: 0xdda0dd, dark: 0xa070a0 },
  glyph: { top: 0xffd700, dark: 0xb29500 },
};

export type ModuleType = 'trunk' | 'canopy' | 'taproot' | 'glyph' | 'wound';

export const MODULE_COLORS: Record<ModuleType, number> = {
  canopy:  0x66ff66,
  trunk:   0x9c7a3c,
  taproot: 0xffa040,
  glyph:   0xffd700,
  wound:   0xa02020,
};
