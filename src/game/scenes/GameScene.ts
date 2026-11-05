import Phaser from 'phaser';
import { World } from '../../core/ecs/world';
import { Module, Transform } from '../components';
import { TileWorld } from '../world/TileWorld';
import { ChunkManager } from '../world/ChunkManager';
import { Connectivity, tileKeyFor } from '../world/Connectivity';
import { ModuleRegistry } from '../world/ModuleRegistry';
import { ModuleRenderSystem } from '../systems/ModuleRenderSystem';
import { CameraController, type TapEvent } from '../input/CameraController';
import { TILE_PX, WORLD_SIZE, WORLD_PX, TILE_COLORS, type TileType } from '../config';

interface Pending { gx: number; gy: number; type: TileType; z: number }
interface Threat { x: number; y: number; hp: number; maxHp: number; speed: number; attack: number; wobble: number }
interface Shot { x: number; y: number; target: Threat; damage: number }
interface PressureMark { x: number; y: number; power: number }
const COST: Record<TileType, number> = { stem: 1, leaf: 1, root: 2, bloom: 2, glyph: 4 };
const INFO: Record<TileType, [string, string]> = {
  stem: ['Stem', 'The backbone of a living cluster. Pair with leaves to grow a trunk.'],
  leaf: ['Leaf', 'Three leaves and two stems awaken a restorative trunk.'],
  root: ['Root', 'Four roots awaken a taproot, gathering biomass over time.'],
  bloom: ['Bloom', 'Two blooms with three stems form a canopy that hunts nearby threats.'],
  glyph: ['Glyph', 'A costly, protected mark. Glyph clusters calm pressure around the heart.'],
};

export class GameScene extends Phaser.Scene {
  private world = new TileWorld();
  private ecs = new World();
  private chunks!: ChunkManager;
  private connectivity = new Connectivity();
  private modules = new ModuleRegistry();
  private controller!: CameraController;
  private ghost!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private pending: Pending | null = null;
  private currentType: TileType = 'stem';
  private hud: HTMLElement | null = null;
  private biomass = 12;
  private pressure = 0;
  private coreHealth = 6;
  private wave = 0;
  private readonly maxWaves = 5;
  private threats: Threat[] = [];
  private shots: Shot[] = [];
  private marks: PressureMark[] = [];
  private defenseTimers = new Map<string, number>();
  private gameState: 'playing' | 'won' | 'lost' = 'playing';
  private toastTimer = 0;
  private effectsTimer = 0;
  private passiveTimer = 0;
  private readonly cx = Math.floor(WORLD_SIZE / 2);
  private readonly cy = Math.floor(WORLD_SIZE / 2);

  constructor() { super('Game'); }

  create(): void {
    // Phaser restarts the existing Scene instance, so explicitly reset run state.
    this.world = new TileWorld();
    this.ecs = new World();
    this.connectivity = new Connectivity();
    this.modules = new ModuleRegistry();
    this.pending = null;
    this.currentType = 'stem';
    document.querySelectorAll<HTMLElement>('[data-tile]').forEach(button => button.classList.toggle('selected', button.dataset.tile === 'stem'));
    this.biomass = 12;
    this.pressure = 0;
    this.coreHealth = 6;
    this.wave = 0;
    this.threats = [];
    this.shots = [];
    this.marks = [];
    this.defenseTimers.clear();
    this.gameState = 'playing';
    this.toastTimer = 0;
    this.effectsTimer = 0;
    this.passiveTimer = 0;

    this.cameras.main.setBackgroundColor(0x172019);
    this.chunks = new ChunkManager(this, this.world);
    this.effects = this.add.graphics().setDepth(90000);
    this.ghost = this.add.graphics().setDepth(99998);
    this.ecs.addSystem(new ModuleRenderSystem(this));
    this.drawCartography();
    this.controller = new CameraController(this, {
      onTapDown: e => this.onTapDown(e), onTapUp: () => this.onTapUp(),
      onTapCancel: () => this.onTapCancel(), onDragStart: () => {},
    });

    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn((this.cx + 0.5) * TILE_PX, (this.cy + 0.5) * TILE_PX);
    this.cameras.main.setBounds(-WORLD_PX * 0.1, -WORLD_PX * 0.1, WORLD_PX * 1.2, WORLD_PX * 1.2);
    this.commitTile(this.cx, this.cy, 'stem', 0, false);
    this.hud = document.getElementById('game-ui');
    const endScreen = document.getElementById('end-screen');
    if (endScreen) endScreen.hidden = true;
    this.bindUI();
    this.refreshUI();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controller.destroy();
      this.unbindUI();
    });
  }

  private drawCartography(): void {
    const g = this.add.graphics().setDepth(-100000);
    const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
    g.lineStyle(1, 0x9a8d64, 0.055);
    for (let i = 0; i < 34; i++) {
      const x = (rnd(i * 2 + 1) - 0.5) * 2800 + this.cx * TILE_PX;
      const y = (rnd(i * 2 + 2) - 0.5) * 1800 + this.cy * TILE_PX;
      g.strokeCircle(x, y, 35 + rnd(i + 60) * 150);
    }
    for (let i = 0; i < 190; i++) {
      const x = (rnd(i + 200) - 0.5) * 3300 + this.cx * TILE_PX;
      const y = (rnd(i + 500) - 0.5) * 2200 + this.cy * TILE_PX;
      g.fillStyle(i % 3 ? 0xb9a777 : 0x82916c, 0.12 + rnd(i + 900) * 0.18);
      g.fillCircle(x, y, 1 + rnd(i + 1000) * 2);
    }
    g.lineStyle(2, 0xb8a66e, 0.16);
    const ox = this.cx * TILE_PX - 600, oy = this.cy * TILE_PX - 310;
    g.strokeCircle(ox, oy, 34); g.strokeCircle(ox, oy, 29);
    g.lineBetween(ox - 43, oy, ox + 43, oy); g.lineBetween(ox, oy - 43, ox, oy + 43);
    g.fillStyle(0xc9ae71, 0.25); g.fillTriangle(ox, oy - 24, ox - 5, oy + 4, ox + 5, oy + 4);
  }

  private bindUI(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-tile]').forEach(button => {
      button.addEventListener('click', this.onPaletteClick);
    });
    document.getElementById('restart')?.addEventListener('click', this.onRestartClick);
    document.getElementById('play-again')?.addEventListener('click', this.onRestartClick);
    const keys = this.input.keyboard;
    keys?.on('keydown-ONE', this.onKeyOne);
    keys?.on('keydown-TWO', this.onKeyTwo);
    keys?.on('keydown-THREE', this.onKeyThree);
    keys?.on('keydown-FOUR', this.onKeyFour);
    keys?.on('keydown-FIVE', this.onKeyFive);
  }
  private unbindUI(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-tile]').forEach(button => button.removeEventListener('click', this.onPaletteClick));
    document.getElementById('restart')?.removeEventListener('click', this.onRestartClick);
    document.getElementById('play-again')?.removeEventListener('click', this.onRestartClick);
    const keys = this.input.keyboard;
    keys?.off('keydown-ONE', this.onKeyOne);
    keys?.off('keydown-TWO', this.onKeyTwo);
    keys?.off('keydown-THREE', this.onKeyThree);
    keys?.off('keydown-FOUR', this.onKeyFour);
    keys?.off('keydown-FIVE', this.onKeyFive);
  }
  private onPaletteClick = (event: Event): void => this.select((event.currentTarget as HTMLButtonElement).dataset.tile as TileType);
  private onRestartClick = (): void => { this.scene.restart(); };
  private onKeyOne = (): void => this.select('stem');
  private onKeyTwo = (): void => this.select('leaf');
  private onKeyThree = (): void => this.select('root');
  private onKeyFour = (): void => this.select('bloom');
  private onKeyFive = (): void => this.select('glyph');
  private select(type: TileType): void {
    this.currentType = type;
    document.querySelectorAll('[data-tile]').forEach(button => button.classList.toggle('selected', (button as HTMLElement).dataset.tile === type));
    this.refreshUI();
  }

  private onTapDown(e: TapEvent): void {
    if (this.gameState !== 'playing') return;
    const gx = Math.floor(e.worldX / TILE_PX), gy = Math.floor(e.worldY / TILE_PX);
    if (gx < 0 || gy < 0 || gx >= WORLD_SIZE || gy >= WORLD_SIZE || this.world.get(gx, gy)) return;
    if (this.biomass < COST[this.currentType]) { this.showToast('Not enough biomass'); return; }
    if (!this.hasNeighbor(gx, gy)) { this.showToast('Grow from an existing tile'); return; }
    const z = e.shift ? 1 : 0;
    this.pending = { gx, gy, type: this.currentType, z };
    this.drawGhost(gx, gy, this.currentType, z);
  }
  private onTapUp(): void {
    if (!this.pending) return;
    const p = this.pending; this.pending = null; this.ghost.clear();
    this.commitTile(p.gx, p.gy, p.type, p.z, true);
  }
  private onTapCancel(): void { this.pending = null; this.ghost.clear(); }
  private hasNeighbor(gx: number, gy: number): boolean {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && this.world.get(gx + dx, gy + dy)) return true;
    }
    return false;
  }
  private drawGhost(gx: number, gy: number, type: TileType, z: number): void {
    const g = this.ghost; g.clear();
    const x = gx * TILE_PX, y = gy * TILE_PX - z * TILE_PX * 0.5;
    g.fillStyle(TILE_COLORS[type].top, 0.68); g.fillRect(x, y, TILE_PX, TILE_PX);
    g.lineStyle(2, 0xffe6a3, 0.95); g.strokeRect(x, y, TILE_PX, TILE_PX);
  }

  private commitTile(gx: number, gy: number, type: TileType, z: number, charge: boolean): void {
    if (charge && (this.biomass < COST[type] || !this.hasNeighbor(gx, gy) || this.world.get(gx, gy))) return;
    if (charge) this.biomass -= COST[type];
    this.world.place({ gx, gy, z, type });
    const [chunkX, chunkY] = TileWorld.chunkOf(gx, gy);
    this.chunks.redrawNow(TileWorld.chunkKey(chunkX, chunkY));
    const key = tileKeyFor(gx, gy), root = this.connectivity.add(key, gx, gy, type), consumed: string[] = [];
    for (const [dx, dy] of this.connectivity.NEIGHBORS_8) {
      const neighbor = tileKeyFor(gx + dx, gy + dy);
      if (!this.connectivity.has(neighbor)) continue;
      const a = this.connectivity.find(root), b = this.connectivity.find(neighbor);
      if (a !== b) { const merged = this.connectivity.union(a, b); consumed.push(merged === a ? b : a); }
    }
    const stats = this.connectivity.stats(this.connectivity.find(root));
    this.modules.sync(this.ecs, stats, consumed);
    const wound = this.ecs.query(Module).some(entity => this.ecs.get(entity, Module)?.moduleType === 'wound' && this.ecs.get(entity, Module)?.componentRoot === stats.root);
    const pressureGain = type === 'glyph' ? 0.28 : type === 'root' ? 0.42 : 0.56;
    this.pressure = Math.min(20, this.pressure + pressureGain + (wound ? 0.24 : 0));
    this.marks.push({ x: (gx + 0.5) * TILE_PX, y: (gy + 0.5) * TILE_PX, power: 1 });
    if (this.marks.length > 50) this.marks.shift();
    this.showToast(stats.tileCount >= 3 && stats.tileCount <= 6 ? 'A new shape takes root' : '');
    this.refreshUI();
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.chunks.update();
    if (this.gameState === 'playing') this.simulate(dt);
    this.ecs.update(deltaMs);
    this.drawEffects(dt);
    this.refreshUI();
  }

  private simulate(dt: number): void {
    const mods = this.ecs.query(Module, Transform).map(entity => ({
      module: this.ecs.get(entity, Module)!, transform: this.ecs.get(entity, Transform)!,
    }));
    const roots = mods.filter(m => m.module.moduleType === 'taproot').length;
    const trunks = mods.filter(m => m.module.moduleType === 'trunk').length;
    const glyphs = mods.filter(m => m.module.moduleType === 'glyph').length;
    this.biomass = Math.min(99, this.biomass + dt * (0.18 + roots * 0.48));
    this.pressure = Math.max(0, this.pressure - dt * (0.045 + glyphs * 0.12));
    this.coreHealth = Math.min(6, this.coreHealth + dt * trunks * 0.018);
    this.marks.forEach(mark => { mark.power -= dt * 0.075; });
    this.marks = this.marks.filter(mark => mark.power > 0);
    this.passiveTimer += dt;

    const threshold = 5.2 + this.wave * 0.9;
    if (this.pressure >= threshold && this.wave < this.maxWaves && this.threats.length < 3) {
      this.pressure -= threshold * 0.72;
      this.spawnThreat();
    }

    for (const { module, transform } of mods) {
      if (module.moduleType !== 'canopy') continue;
      const root = module.componentRoot;
      const timer = Math.max(0, (this.defenseTimers.get(root) ?? 0) - dt);
      this.defenseTimers.set(root, timer);
      if (timer > 0) continue;
      const x = (module.centroid.x + 0.5) * TILE_PX, y = (module.centroid.y + 0.5) * TILE_PX;
      const target = this.threats.filter(t => Math.hypot(t.x - x, t.y - y) < 150)
        .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      if (target) {
        this.shots.push({ x, y, target, damage: 1.8 + module.tileCount * 0.12 });
        this.defenseTimers.set(root, 0.72);
      }
      void transform;
    }

    for (const threat of [...this.threats]) {
      const tx = (this.cx + 0.5) * TILE_PX, ty = (this.cy + 0.5) * TILE_PX;
      const dx = tx - threat.x, dy = ty - threat.y, distance = Math.hypot(dx, dy);
      if (distance > 16) {
        threat.x += dx / distance * threat.speed * dt;
        threat.y += dy / distance * threat.speed * dt;
        threat.wobble += dt * 5;
      } else {
        threat.attack -= dt;
        if (threat.attack <= 0) {
          threat.attack = 1.15;
          this.coreHealth = Math.max(0, this.coreHealth - 1);
          this.showToast('The heart is under attack');
        }
      }
    }
    for (const shot of [...this.shots]) {
      if (!this.threats.includes(shot.target)) { this.shots.splice(this.shots.indexOf(shot), 1); continue; }
      const dx = shot.target.x - shot.x, dy = shot.target.y - shot.y, dist = Math.hypot(dx, dy);
      const move = 360 * dt;
      if (dist <= move + 5) {
        shot.target.hp -= shot.damage;
        this.shots.splice(this.shots.indexOf(shot), 1);
        if (shot.target.hp <= 0) this.threats.splice(this.threats.indexOf(shot.target), 1);
      } else { shot.x += dx / dist * move; shot.y += dy / dist * move; }
    }
    if (this.coreHealth <= 0) this.finish(false);
    else if (this.wave >= this.maxWaves && this.threats.length === 0) this.finish(true);
  }

  private spawnThreat(): void {
    this.wave++;
    const angle = Math.random() * Math.PI * 2, radius = (27 + Math.random() * 4) * TILE_PX;
    const maxHp = 3 + this.wave * 0.75;
    this.threats.push({
      x: (this.cx + 0.5) * TILE_PX + Math.cos(angle) * radius,
      y: (this.cy + 0.5) * TILE_PX + Math.sin(angle) * radius,
      hp: maxHp, maxHp, speed: 25 + this.wave * 1.7, attack: 1, wobble: Math.random() * 7,
    });
    this.showToast(`A root-worm stirs · ${this.wave}/${this.maxWaves}`);
  }

  private finish(won: boolean): void {
    this.gameState = won ? 'won' : 'lost';
    const overlay = document.getElementById('end-screen');
    const title = document.getElementById('end-title');
    const copy = document.getElementById('end-copy');
    if (overlay) overlay.hidden = false;
    if (title) title.textContent = won ? 'The heart endures' : 'The garden falls quiet';
    if (copy) copy.textContent = won
      ? 'Five root-worms turned back. Your living map has made a home in the wild.'
      : 'The root-worms reached the heart. Shape a stronger defense and try again.';
  }

  private drawEffects(dt: number): void {
    const g = this.effects;
    g.clear();
    const cx = (this.cx + 0.5) * TILE_PX, cy = (this.cy + 0.5) * TILE_PX;
    // Pressure lingers as a rust-colored stain on the map.
    for (const mark of this.marks) {
      const alpha = Math.min(0.13, mark.power * 0.13);
      g.fillStyle(0x782d22, alpha);
      g.fillCircle(mark.x, mark.y, (2.5 + mark.power * 2) * TILE_PX);
      g.lineStyle(1, 0xc36a43, alpha * 1.5);
      g.strokeCircle(mark.x, mark.y, (1.3 + mark.power * 1.5) * TILE_PX);
    }
    // The heart pulses softly, and canopy shots make defense easy to read.
    this.effectsTimer += dt;
    g.fillStyle(0xe4b972, 0.08 + Math.sin(this.effectsTimer * 2) * 0.025);
    g.fillCircle(cx, cy, 19 + Math.sin(this.effectsTimer * 2) * 2);
    g.fillStyle(0xffdf9a, 0.95); g.fillCircle(cx, cy, 4);
    for (const shot of this.shots) {
      g.lineStyle(2, 0xffdc83, 0.95); g.lineBetween(shot.x, shot.y, shot.x - 6, shot.y - 6);
      g.fillStyle(0xffe6aa, 1); g.fillCircle(shot.x, shot.y, 3);
    }
    for (const threat of this.threats) {
      const x = threat.x, y = threat.y + Math.sin(threat.wobble) * 2;
      g.fillStyle(0x050806, 0.4); g.fillEllipse(x, y + 8, 24, 10);
      g.fillStyle(0x431d19, 1); g.fillCircle(x, y, 10);
      g.fillStyle(0x9b4835, 1); g.fillCircle(x - 3, y - 3, 5);
      g.fillStyle(0xe5a25c, 1); g.fillCircle(x + 4, y - 2, 2);
      g.lineStyle(1, 0x170f0e, 0.8);
      g.lineBetween(x - 7, y - 7, x - 12, y - 13); g.lineBetween(x + 5, y - 8, x + 10, y - 13);
      g.fillStyle(0x251712, 0.9); g.fillRect(x - 12, y - 17, 24, 3);
      g.fillStyle(0xd45f47, 1); g.fillRect(x - 11, y - 16, 22 * Math.max(0, threat.hp / threat.maxHp), 1);
    }
  }

  private refreshUI(): void {
    if (!this.hud) return;
    const set = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    const bar = (id: string, value: number) => { const el = document.getElementById(id) as HTMLElement | null; if (el) el.style.width = `${Phaser.Math.Clamp(value, 0, 100)}%`; };
    set('biomass-value', Math.floor(this.biomass).toString());
    set('core-value', `${Math.ceil(this.coreHealth)} / 6`);
    set('pressure-value', `${Math.round(this.pressure * 10) / 10}`);
    set('wave-value', `${this.wave} / ${this.maxWaves}`);
    set('tile-value', `${this.world.count()}`);
    set('selected-name', INFO[this.currentType][0]);
    set('selected-detail', INFO[this.currentType][1]);
    set('selected-cost', `${COST[this.currentType]} biomass`);
    const moduleCounts = { canopy: 0, taproot: 0, trunk: 0, glyph: 0, wound: 0 };
    for (const entity of this.ecs.query(Module)) {
      const mod = this.ecs.get(entity, Module);
      if (mod) moduleCounts[mod.moduleType]++;
    }
    set('module-value', `${moduleCounts.canopy} canopy · ${moduleCounts.taproot} taproot · ${moduleCounts.wound} wound`);
    const status = document.getElementById('status-line');
    if (status) status.textContent = this.threats.length ? 'A shadow is moving toward the heart' : this.wave >= this.maxWaves ? 'Last danger turned away' : 'The wild is watching';
    bar('core-bar', this.coreHealth / 6 * 100);
    bar('pressure-bar', this.pressure / (5.2 + this.wave * 0.9) * 100);
    const toast = document.getElementById('toast');
    if (toast && this.toastTimer <= 0) toast.classList.remove('visible');
    if (this.toastTimer > 0) this.toastTimer -= 1 / 60;
  }

  private showToast(message: string): void {
    const toast = document.getElementById('toast');
    if (!toast) return;
    if (!message) { toast.classList.remove('visible'); return; }
    toast.textContent = message;
    toast.classList.add('visible');
    this.toastTimer = 2.2;
  }
}
