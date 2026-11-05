import { describe, expect, it } from 'vitest';
import { TileWorld } from '../src/game/world/TileWorld';

const tile = { gx: 2, gy: 3, z: 0, type: 'stem' } as const;

describe('TileWorld', () => {
  it('stores, retrieves, and removes tiles', () => {
    const world = new TileWorld();
    world.place(tile);

    expect(world.get(2, 3)).toEqual(tile);
    expect(world.count()).toBe(1);
    expect([...world.chunkTiles(0, 0)]).toEqual([tile]);

    world.remove(2, 3);
    expect(world.get(2, 3)).toBeUndefined();
    expect(world.count()).toBe(0);
  });

  it('tracks dirty chunks once until consumed', () => {
    const world = new TileWorld();
    world.place(tile);
    world.place({ ...tile, gx: 3 });

    expect(world.consumeDirty()).toEqual(['0,0']);
    expect(world.consumeDirty()).toEqual([]);

    world.remove(2, 3);
    expect(world.consumeDirty()).toEqual(['0,0']);
  });

  it('uses floor division for negative chunk coordinates', () => {
    expect(TileWorld.chunkOf(-1, -33)).toEqual([-1, -2]);
  });
});
