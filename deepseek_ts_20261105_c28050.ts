export const TILE_PX = 16;
export const CHUNK_SIZE = 32;
export const CHUNK_PX = TILE_PX * CHUNK_SIZE;
export const WORLD_SIZE = 512;
export const WORLD_PX = TILE_PX * WORLD_SIZE;

export const MIN_ZOOM = 0.125;
export const MAX_ZOOM = 4.0;
export const ZOOM_STEP = 1.15;

export type TileType = 'stem' | 'leaf' | 'root' | 'bloom' | 'glyph';

export const TILE_COLORS: Record<TileType, { top: number; dark: number }> = {
  stem:  { top: 0x6b8e23, dark: 0x4a6319 },
  leaf:  { top: 0x8fbc8f, dark: 0x5d825d },
  root:  { top: 0x8b4513, dark: 0x5c2e0c },
  bloom: { top: 0xdda0dd, dark: 0xa070a0 },
  glyph: { top: 0xffd700, dark: 0xb29500 },
};