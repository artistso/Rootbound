import Phaser from 'phaser';
import { TileWorld } from '../world/TileWorld';
import { ChunkManager } from '../world/ChunkManager';
import { CameraController, type TapEvent } from '../input/CameraController';
import { TILE_PX, WORLD_SIZE, WORLD_PX, type TileType } from '../config';

export class GameScene extends Phaser.Scene {
  private world = new TileWorld();
  private chunks!: ChunkManager;
  private controller!: CameraController;
  private currentType: TileType = 'stem';
  private hud: HTMLElement | null = null;

  constructor() { super('Game'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1510);
    this.chunks = new ChunkManager(this, this.world);
    this.controller = new CameraController(this, (e) => this.onTap(e));

    const cx = Math.floor(WORLD_SIZE / 2);
    const cy = Math.floor(WORLD_SIZE / 2);
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(cx * TILE_PX + TILE_PX / 2, cy * TILE_PX + TILE_PX / 2);

    // Bounds with 10% margin so the void edge is visible
    this.cameras.main.setBounds(
      -WORLD_PX * 0.1, -WORLD_PX * 0.1,
      WORLD_PX * 1.2, WORLD_PX * 1.2,
    );

    // The seed. Every world begins with one tile.
    this.world.place({ gx: cx, gy: cy, z: 0, type: 'stem' });

    // Debug: number keys select tile type
    const k = this.input.keyboard;
    k?.on('keydown-ONE', () => { this.currentType = 'stem'; });
    k?.on('keydown-TWO', () => { this.currentType = 'leaf'; });
    k?.on('keydown-THREE', () => { this.currentType = 'root'; });
    k?.on('keydown-FOUR', () => { this.currentType = 'bloom'; });
    k?.on('keydown-FIVE', () => { this.currentType = 'glyph'; });

    this.hud = document.getElementById('hud');
  }

  private onTap(e: TapEvent): void {
    const gx = Math.floor(e.worldX / TILE_PX);
    const gy = Math.floor(e.worldY / TILE_PX);
    if (gx < 0 || gy < 0 || gx >= WORLD_SIZE || gy >= WORLD_SIZE) return;
    if (this.world.get(gx, gy)) return;
    this.world.place({ gx, gy, z: e.shift ? 1 : 0, type: this.currentType });
  }

  override update(): void {
    this.chunks.update();
    if (this.hud) {
      this.hud.textContent = `zoom ${this.cameras.main.zoom.toFixed(2)}  |  tiles ${this.world.count()}  |  type ${this.currentType}`;
    }
  }
}