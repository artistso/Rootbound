import { describe, expect, it, vi } from 'vitest';
import { World } from '../src/core/ecs/world';
import { defineComponent } from '../src/core/ecs/types';

const Position = defineComponent<{ x: number }>('Position');
const Health = defineComponent<{ value: number }>('Health');

describe('World', () => {
  it('creates entities and adds typed components', () => {
    const world = new World();
    const entity = world.create();
    world.add(entity, Position, { x: 4 });

    expect(world.has(entity)).toBe(true);
    expect(world.get(entity, Position)).toEqual({ x: 4 });
    expect(world.query(Position)).toEqual([entity]);
    expect(world.query(Health)).toEqual([]);
  });

  it('queries only entities containing every requested component', () => {
    const world = new World();
    const positioned = world.create();
    const complete = world.create();
    world.add(positioned, Position, { x: 1 });
    world.add(complete, Position, { x: 2 });
    world.add(complete, Health, { value: 10 });

    expect(world.query(Position, Health)).toEqual([complete]);
  });

  it('removes all component data when an entity is destroyed', () => {
    const world = new World();
    const entity = world.create();
    world.add(entity, Position, { x: 1 });
    world.destroy(entity);

    expect(world.has(entity)).toBe(false);
    expect(world.get(entity, Position)).toBeUndefined();
    expect(world.query(Position)).toEqual([]);
    expect(() => world.add(entity, Position, { x: 2 })).toThrow(/missing entity/);
  });

  it('updates systems with the world and frame delta', () => {
    const world = new World();
    const update = vi.fn();
    world.addSystem({ update });
    world.update(16.67);

    expect(update).toHaveBeenCalledWith(world, 16.67);
  });
});
