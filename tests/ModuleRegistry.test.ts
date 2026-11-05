import { describe, expect, it } from 'vitest';
import { World } from '../src/core/ecs/world';
import { Module, Transform } from '../src/game/components';
import { ModuleRegistry } from '../src/game/world/ModuleRegistry';
import type { ComponentStats } from '../src/game/world/Connectivity';

function stats(root: string, tileCount: number, x = 2, y = 4): ComponentStats {
  return {
    root,
    tileCount,
    typeCounts: new Map([['root', tileCount]]),
    centroid: { x, y },
  };
}

describe('ModuleRegistry', () => {
  it('creates a module with its transform in world-pixel coordinates', () => {
    const world = new World();
    const registry = new ModuleRegistry();
    registry.sync(world, stats('2,4', 4), []);

    const [entity] = world.query(Module, Transform);
    expect(entity).toBeDefined();
    expect(world.get(entity!, Module)).toMatchObject({
      moduleType: 'taproot',
      componentRoot: '2,4',
      tileCount: 4,
    });
    expect(world.get(entity!, Transform)).toEqual({ x: 40, y: 72, angle: 0 });
  });

  it('updates existing modules and removes modules below the threshold', () => {
    const world = new World();
    const registry = new ModuleRegistry();
    registry.sync(world, stats('2,4', 4), []);
    const [entity] = world.query(Module);

    registry.sync(world, stats('2,4', 5, 3, 4), []);
    expect(world.query(Module)).toEqual([entity]);
    expect(world.get(entity!, Transform)?.x).toBe(56);

    registry.sync(world, stats('2,4', 2), []);
    expect(world.query(Module)).toEqual([]);
    expect(world.has(entity!)).toBe(false);
  });

  it('destroys entities for component roots consumed by a merge', () => {
    const world = new World();
    const registry = new ModuleRegistry();
    registry.sync(world, stats('0,0', 4), []);
    registry.sync(world, stats('5,0', 4), []);

    registry.sync(world, stats('0,0', 8), ['5,0']);
    expect(world.query(Module)).toHaveLength(1);
    expect(world.get(world.query(Module)[0]!, Module)?.tileCount).toBe(8);
  });
});
