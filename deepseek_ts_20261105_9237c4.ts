import { CHUNK_SIZE } from '../config';
import type { Tile } from './types';

export class TileWorld {
  private chunks = new Map<string, Map<string, Tile>>();
  private dirty = new Set<string>();

  static chunkKey(cx: number, cy: number): string { return `${cx},${cy}`; }
  static chunkOf(gx: number, gy: number): [number, number] {
    return [Math.floor(gx / CHUNK_SIZE), Math.floor(gy / CHUNK_SIZE)];
  }
  static tileKey(gx: number, gy: number): string { return `${gx},${gy}`; }

  place(tile: Tile): void {
    const [cx, cy] = TileWorld.chunkOf(tile.gx, tile.gy);
    const ck = TileWorld.chunkKey(cx, cy);
    let chunk = this.chunks.get(ck);
    if (!chunk) { chunk = new Map(); this.chunks.set(ck, chunk); }
    chunk.set(TileWorld.tileKey(tile.gx, tile.gy), tile);
    this.dirty.add(ck);
  }

  get(gx: number, gy: number): Tile | undefined {
    const [cx, cy] = TileWorld.chunkOf(gx, gy);
    return this.chunks.get(TileWorld.chunkKey(cx, cy))?.get(TileWorld.tileKey(gx, gy));
  }

  *chunkTiles(cx: number, cy: number): IterableIterator<Tile> {
    const c = this.chunks.get(TileWorld.chunkKey(cx, cy));
    if (c) yield* c.values();
  }

  count(): number {
    let n = 0;
    for (const c of this.chunks.values()) n += c.size;
    return n;
  }

  consumeDirty(): string[] {
    const d = [...this.dirty];
    this.dirty.clear();
    return d;
  }
}