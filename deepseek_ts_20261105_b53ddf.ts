import Phaser from 'phaser';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../config';

export interface TapEvent {
  worldX: number;
  worldY: number;
  shift: boolean;
}

export class CameraController {
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private dragCameraX = 0;
  private dragCameraY = 0;
  private dragging = false;
  private multiTouch = false;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private shiftAtDown = false;

  constructor(private scene: Phaser.Scene, private onTap: (e: TapEvent) => void) {
    const i = scene.input;
    i.addPointer(2);
    i.on('pointerdown', this.onDown, this);
    i.on('pointermove', this.onMove, this);
    i.on('pointerup', this.onUp, this);
    i.on('wheel', this.onWheel, this);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.activePointers() >= 2) {
      this.pinchStartDist = 0;
      this.multiTouch = true;
      return;
    }
    const cam = this.scene.cameras.main;
    this.downAt = performance.now();
    this.downX = p.x;
    this.downY = p.y;
    this.dragCameraX = cam.scrollX;
    this.dragCameraY = cam.scrollY;
    this.dragging = false;
    this.multiTouch = false;
    this.shiftAtDown = !!((p.event as MouseEvent | undefined)?.shiftKey);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.activePointers() >= 2) { this.updatePinch(); return; }
    if (!p.isDown) return;
    const dx = p.x - this.downX;
    const dy = p.y - this.downY;
    if (!this.dragging && Math.hypot(dx, dy) > 8) this.dragging = true;
    if (this.dragging) {
      const cam = this.scene.cameras.main;
      cam.setScroll(this.dragCameraX - dx / cam.zoom, this.dragCameraY - dy / cam.zoom);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.multiTouch) {
      if (this.activePointers() === 0) this.multiTouch = false;
      return;
    }
    const dx = p.x - this.downX;
    const dy = p.y - this.downY;
    const dt = performance.now() - this.downAt;
    if (this.dragging || Math.hypot(dx, dy) >= 8 || dt >= 250) return;
    const cam = this.scene.cameras.main;
    this.onTap({
      worldX: cam.scrollX + p.x / cam.zoom,
      worldY: cam.scrollY + p.y / cam.zoom,
      shift: this.shiftAtDown,
    });
  }

  private onWheel(p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void {
    const cam = this.scene.cameras.main;
    const factor = dy > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    this.zoomAtScreen(p.x, p.y, cam.zoom * factor);
  }

  private activePointers(): number {
    return this.scene.input.pointers.filter((p) => p.isDown).length;
  }

  private updatePinch(): void {
    const active = this.scene.input.pointers.filter((p) => p.isDown);
    if (active.length < 2) { this.pinchStartDist = 0; return; }
    const [a, b] = active;
    if (!a || !b) return;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (this.pinchStartDist === 0) {
      this.pinchStartDist = dist;
      this.pinchStartZoom = this.scene.cameras.main.zoom;
      return;
    }
    const zoom = this.pinchStartZoom * (dist / this.pinchStartDist);
    this.zoomAtScreen((a.x + b.x) / 2, (a.y + b.y) / 2, zoom);
  }

  private zoomAtScreen(sx: number, sy: number, targetZoom: number): void {
    const cam = this.scene.cameras.main;
    const zoom = Phaser.Math.Clamp(targetZoom, MIN_ZOOM, MAX_ZOOM);
    const beforeWorldX = cam.scrollX + sx / cam.zoom;
    const beforeWorldY = cam.scrollY + sy / cam.zoom;
    cam.setZoom(zoom);
    cam.setScroll(beforeWorldX - sx / zoom, beforeWorldY - sy / zoom);
  }

  destroy(): void {
    const i = this.scene.input;
    i.off('pointerdown', this.onDown, this);
    i.off('pointermove', this.onMove, this);
    i.off('pointerup', this.onUp, this);
    i.off('wheel', this.onWheel, this);
  }
}