import Phaser from 'phaser';
import { CHUNK_SIZE, CHUNK_PX, TILE_PX, TILE_COLORS } from '../config';
import { TileWorld } from './TileWorld';
import type { Tile } from './types';

export class ChunkManager {
  private gfx = new Map<string, Phaser.GameObjects.Graphics>();

  constructor(private scene: Phaser.Scene, private world: TileWorld) {}

  update(): void {
    for (const ck of this.world.consumeDirty()) this.redraw(ck);
  }

  private redraw(ck: string): void {
    const [cxStr, cyStr] = ck.split(',');
    const cx = Number(cxStr), cy = Number(cyStr);

    let g = this.gfx.get(ck);
    if (!g) {
      g = this.scene.add.graphics();
      g.setPosition(cx * CHUNK_PX, cy * CHUNK_PX);
      g.setDepth(cy * 10000);
      this.gfx.set(ck, g);
    }
    g.clear();

    const tiles: Tile[] = [...this.world.chunkTiles(cx, cy)];
    tiles.sort((a, b) => (a.gy - b.gy) || (a.z - b.z));

    for (const t of tiles) {
      const localX = (t.gx - cx * CHUNK_SIZE) * TILE_PX;
      const localY = (t.gy - cy * CHUNK_SIZE) * TILE_PX;
      this.drawTile(g, localX, localY, t);
    }
  }

  private drawTile(g: Phaser.GameObjects.Graphics, x: number, y: number, t: Tile): void {
    const size = TILE_PX;
    const zPx = t.z * TILE_PX * 0.5;
    const colors = TILE_COLORS[t.type];

    if (t.z > 0) {
      // Shadow
      g.fillStyle(0x000000, 0.4);
      g.fillRect(x + 3, y - zPx + 3, size, size);
      // Extrusion side (front face)
      g.fillStyle(colors.dark, 1);
      g.fillRect(x, y - zPx, size, zPx + size);
      // Top face
      g.fillStyle(colors.top, 1);
      g.fillRect(x, y - zPx, size, size);
      // Outline
      g.lineStyle(1, 0x000000, 0.3);
      g.strokeRect(x, y - zPx, size, size);
    } else {
      g.fillStyle(colors.top, 1);
      g.fillRect(x, y, size, size);
      g.lineStyle(1, 0x000000, 0.15);
      g.strokeRect(x, y, size, size);
    }
  }
}