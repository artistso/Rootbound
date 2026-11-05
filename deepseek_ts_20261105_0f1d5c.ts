import { World } from '../../core/ecs/world';
import { Transform, Module } from '../components';
import type { Entity } from '../../core/ecs/types';
import { classify } from './Classifier';
import type { ComponentStats } from './Connectivity';

export class ModuleRegistry {
  private rootToModule = new Map<string, Entity>();

  sync(world: World, stats: ComponentStats, consumedRoots: string[]): void {
    // Destroy modules whose roots were merged away.
    for (const r of consumedRoots) {
      const e = this.rootToModule.get(r);
      if (e !== undefined) {
        world.destroy(e);
        this.rootToModule.delete(r);
      }
    }

    const type = classify(stats);
    const existing = this.rootToModule.get(stats.root);

    if (!type) {
      if (existing !== undefined) {
        world.destroy(existing);
        this.rootToModule.delete(stats.root);
      }
      return;
    }

    if (existing === undefined) {
      const e = world.create();
      world.add(e, Module, {
        moduleType: type,
        componentRoot: stats.root,
        centroid: stats.centroid,
        tileCount: stats.tileCount,
      });
      world.add(e, Transform, { x: stats.centroid.x, y: stats.centroid.y, angle: 0 });
      this.rootToModule.set(stats.root, e);
    } else {
      const mod = world.get(existing, Module)!;
      mod.moduleType = type;
      mod.centroid = stats.centroid;
      mod.tileCount = stats.tileCount;
      const tf = world.get(existing, Transform);
      if (tf) { tf.x = stats.centroid.x; tf.y = stats.centroid.y; }
    }
  }
}