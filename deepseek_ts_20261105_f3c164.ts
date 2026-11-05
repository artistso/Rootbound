import Phaser from 'phaser';
import {
  MIN_ZOOM, MAX_ZOOM, ZOOM_STEP,
  ZOOM_SNAP_BELOW, ZOOM_STOPS, TAP_DRAG_THRESHOLD_PX,
} from '../config';

export interface TapEvent {
  worldX: number;
  worldY: number;
  shift: boolean;
}

export interface GestureCallbacks {
  onTapDown(e: TapEvent): void;
  onTapUp(e: TapEvent): void;
  onTapCancel(): void;
  onDragStart(): void;
}

export class CameraController {
  private downX = 0;
  private downY = 0;
  private dragCameraX = 0;
  private dragCameraY = 0;
  private dragging = false;
  private pendingDown = false;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private shiftAtDown = false;
  private pinching = false;

  constructor(private scene: Phaser.Scene, private cb: GestureCallbacks) {
    const i = scene.input;
    i.addPointer(2);
    i.on('pointerdown', this.onDown, this);
    i.on('pointermove', this.onMove, this);
    i.on('pointerup', this.onUp, this);
    i.on('wheel', this.onWheel, this);
  }

  private activePointers(): Phaser.Input.Pointer[] {
    return this.scene.input.pointers.filter((p) => p.isDown);
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    return { x: cam.scrollX + sx / cam.zoom, y: cam.scrollY + sy / cam.zoom };
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.activePointers().length >= 2) {
      if (this.pendingDown) { this.pendingDown = false; this.cb.onTapCancel(); }
      this.pinching = true;
      this.pinchStartDist = 0;
      return;
    }
    const cam = this.scene.cameras.main;
    this.downX = p.x;
    this.downY = p.y;
    this.dragCameraX = cam.scrollX;
    this.dragCameraY = cam.scrollY;
    this.dragging = false;
    this.pinching = false;
    this.shiftAtDown = !!((p.event as MouseEvent | undefined)?.shiftKey);

    this.pendingDown = true;
    const w = this.screenToWorld(p.x, p.y);
    this.cb.onTapDown({ worldX: w.x, worldY: w.y, shift: this.shiftAtDown });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const actives = this.activePointers();
    if (actives.length >= 2) { this.updatePinch(actives); return; }
    if (!p.isDown) return;

    const dx = p.x - this.downX;
    const dy = p.y - this.downY;

    if (!this.dragging && Math.hypot(dx, dy) > TAP_DRAG_THRESHOLD_PX) {
      this.dragging = true;
      if (this.pendingDown) { this.pendingDown = false; this.cb.onTapCancel(); }
      this.cb.onDragStart();
    }

    if (this.dragging) {
      const cam = this.scene.cameras.main;
      cam.setScroll(this.dragCameraX - dx / cam.zoom, this.dragCameraY - dy / cam.zoom);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.pinching) {
      if (this.activePointers().length === 0) this.pinching = false;
      return;
    }
    if (this.dragging) { this.dragging = false; return; }
    if (this.pendingDown) {
      this.pendingDown = false;
      const w = this.screenToWorld(p.x, p.y);
      this.cb.onTapUp({ worldX: w.x, worldY: w.y, shift: this.shiftAtDown });
    }
  }

  private updatePinch(actives: Phaser.Input.Pointer[]): void {
    const [a, b] = actives;
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

  private onWheel(p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void {
    const cam = this.scene.cameras.main;
    const factor = dy > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    this.zoomAtScreen(p.x, p.y, cam.zoom * factor);
  }

  private snapZoom(target: number): number {
    let z = Phaser.Math.Clamp(target, MIN_ZOOM, MAX_ZOOM);
    if (z < ZOOM_SNAP_BELOW) {
      let best = ZOOM_STOPS[0];
      let bestDiff = Math.abs(z - best);
      for (const s of ZOOM_STOPS) {
        const d = Math.abs(z - s);
        if (d < bestDiff) { best = s; bestDiff = d; }
      }
      z = best;
    }
    return z;
  }

  private zoomAtScreen(sx: number, sy: number, targetZoom: number): void {
    const cam = this.scene.cameras.main;
    const zoom = this.snapZoom(targetZoom);
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