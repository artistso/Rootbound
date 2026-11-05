import type { TileType } from '../config';

export interface Tile {
  gx: number;
  gy: number;
  z: number;
  type: TileType;
}
