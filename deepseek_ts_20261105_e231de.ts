import Phaser from 'phaser';
import { World } from '../../core/ecs/world';
import { TileWorld } from '../world/TileWorld';
import { ChunkManager } from '../world/ChunkManager';
import { Connectivity, tileKeyFor, parseTileKey } from '../world/Connectivity';
import { ModuleRegistry } from '../world/ModuleRegistry';
import { ModuleRenderSystem } from '../systems/ModuleRenderSystem';
import { CameraController, type TapEvent } from '../input/CameraController';
import {
  TILE_PX, WORLD_SIZE, WORLD_PX, TILE_COLORS,
  CHUNK_SIZE, type TileType,
} from '../config';

interface Pending {
  gx: number;
  gy: number;
  type: TileType;
  z: number;
}

export class GameScene extends Phaser.Scene {
  private world = new TileWorld();
  private ecs = new World();
  private chunks!: ChunkManager;
  private connectivity = new Connectivity();
  private modules = new ModuleRegistry();
  private controller!: CameraController;
  private ghost!: Phaser.GameObjects.Graphics;
  private pending: Pending | null = null;
  private currentType: TileType = 'stem';
  private hud: HTMLElement | null = null;

  constructor() { super('Game'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1510);
    this.chunks = new ChunkManager(this, this.world);
    this.ghost = this.add.graphics();
    this.ghost.setDepth(99998);

    this.ecs.addSystem(new ModuleRenderSystem(this));

    this.controller = new CameraController(this, {
      onTapDown: (e) => this.onTapDown(e),
      onTapUp: () => this.onTapUp(),
      onTapCancel: () => this.onTapCancel(),
      onDragStart: () => {},
    });

    const cx = Math.floor(WORLD_SIZE / 2);
    const cy = Math.floor(WORLD_SIZE / 2);
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(cx * TILE_PX + TILE_PX / 2, cy * TILE_PX + TILE_PX / 2);
    this.cameras.main.setBounds(
      -WORLD_PX * 0.1, -WORLD_PX * 0.1,
      WORLD_PX * 1.2, WORLD_PX * 1.2,
    );

    // Seed
    this.commitTile(cx, cy, 'stem', 0);

    const k = this.input.keyboard;
    k?.on('keydown-ONE',   () => { this.currentType = 'stem'; });
    k?.on('keydown-TWO',   () => { this.currentType = 'leaf'; });
    k?.on('keydown-THREE', () => { this.currentType = 'root'; });
    k?.on('keydown-FOUR',  () => { this.currentType = 'bloom'; });
    k?.on('keydown-FIVE',  () => { this.currentType = 'glyph'; });

    this.hud = document.getElementById('hud');
  }

  private onTapDown(e: TapEvent): void {
    const gx = Math.floor(e.worldX / TILE_PX);
    const gy = Math.floor(e.worldY / TILE_PX);
    if (gx < 0 || gy < 0 || gx >= WORLD_SIZE || gy >= WORLD_SIZE) return;
    if (this.world.get(gx, gy)) return;

    const z = e.shift ? 1 : 0;
    this.pending = { gx, gy, type: this.currentType, z };
    this.drawGhost(gx, gy, this.currentType, z);
  }

  private onTapUp(): void {
    if (!this.pending) return;
    const p = this.pending;
    this.pending = null;
    this.ghost.clear();
    this.commitTile(p.gx, p.gy, p.type, p.z);
  }

  private onTapCancel(): void {
    this.pending = null;
    this.ghost.clear();
  }

  private drawGhost(gx: number, gy: number, type: TileType, z: number): void {
    const g = this.ghost;
    g.clear();
    const px = gx * TILE_PX;
    const py = gy * TILE_PX;
    const zPx = z * TILE_PX * 0.5;
    const color = TILE_COLORS[type].top;

    if (z > 0) {
      g.fillStyle(0x000000, 0.4);
      g.fillRect(px + 3, py - zPx + 3, TILE_PX, TILE_PX);
    }
    g.fillStyle(color, 0.7);
    g.fillRect(px, py - zPx, TILE_PX, TILE_PX);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeRect(px, py - zPx, TILE_PX, TILE_PX);
  }

  private commitTile(gx: number, gy: number, type: TileType, z: number): void {
    // 1. Write to world + redraw chunk synchronously (visible this frame).
    this.world.place({ gx, gy, z, type });
    const [cx, cy] = TileWorld.chunkOf(gx, gy);
    this.chunks.redrawNow(TileWorld.chunkKey(cx, cy));

    // 2. Union-find
    const tk = tileKeyFor(gx, gy);
    const initialRoot = this.connectivity.add(tk, gx, gy, type);
    const consumedRoots: string[] = [];

    for (const [dx, dy] of this.connectivity.NEIGHBORS_8) {
      const nk = tileKeyFor(gx + dx, gy + dy);
      if (!this.connectivity.has(nk)) continue;
      const rootA = this.connectivity.find(initialRoot);
      const rootB = this.connectivity.find(nk);
      if (rootA === rootB) continue;
      const newRoot = this.connectivity.union(rootA, rootB);
      const loser = newRoot === rootA ? rootB : rootA;
      consumedRoots.push(loser);
    }

    // 3. Classify + sync modules
    const finalRoot = this.connectivity.find(initialRoot);
    const stats = this.connectivity.stats(finalRoot);
    this.modules.sync(this.ecs, stats, consumedRoots);
  }

  override update(): void {
    this.chunks.update();
    this.ecs.update(this.game.loop.delta);
    if (this.hud) {
      this.hud.textContent =
        `zoom ${this.cameras.main.zoom.toFixed(2)}  |  tiles ${this.world.count()}  |  type ${this.currentType}`;
    }
  }
}