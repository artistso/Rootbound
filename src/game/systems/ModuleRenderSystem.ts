import Phaser from 'phaser';
import { World } from '../../core/ecs/world';
import { Module, Transform } from '../components';
import { MODULE_COLORS } from '../config';
import type { System } from '../../core/ecs/types';

export class ModuleRenderSystem implements System {
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(99999);
  }

  update(world: World): void {
    const g = this.gfx;
    g.clear();
    for (const e of world.query(Module, Transform)) {
      const mod = world.get(e, Module)!;
      const tf = world.get(e, Transform)!;
      const color = MODULE_COLORS[mod.moduleType];
      const r = Math.sqrt(mod.tileCount) * 10;
      g.fillStyle(color, 0.25);
      g.fillCircle(tf.x, tf.y, r);
      g.lineStyle(2, color, 0.9);
      g.strokeCircle(tf.x, tf.y, r);
    }
  }
}
