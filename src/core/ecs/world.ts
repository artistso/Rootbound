import type { ComponentType, Entity, System } from './types';

/** A deliberately small ECS: entities are IDs and components are plain data. */
export class World {
  private nextEntity: Entity = 1;
  private entities = new Set<Entity>();
  private stores = new Map<ComponentType<unknown>, Map<Entity, unknown>>();
  private systems: System[] = [];

  create(): Entity {
    const entity = this.nextEntity++;
    this.entities.add(entity);
    return entity;
  }

  destroy(entity: Entity): void {
    if (!this.entities.delete(entity)) return;
    for (const store of this.stores.values()) store.delete(entity);
  }

  has(entity: Entity): boolean {
    return this.entities.has(entity);
  }

  add<T>(entity: Entity, component: ComponentType<T>, value: T): void {
    if (!this.entities.has(entity)) throw new Error(`Cannot add ${component.name} to missing entity ${entity}`);
    let store = this.stores.get(component);
    if (!store) {
      store = new Map<Entity, unknown>();
      this.stores.set(component, store);
    }
    store.set(entity, value);
  }

  get<T>(entity: Entity, component: ComponentType<T>): T | undefined {
    return this.stores.get(component)?.get(entity) as T | undefined;
  }

  query(...components: ComponentType<unknown>[]): Entity[] {
    if (components.length === 0) return [...this.entities];

    const stores = components.map((component) => this.stores.get(component));
    if (stores.some((store) => store === undefined)) return [];

    const [first, ...rest] = stores as Map<Entity, unknown>[];
    if (!first) return [];
    return [...first.keys()].filter(
      (entity) => this.entities.has(entity) && rest.every((store) => store.has(entity)),
    );
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  update(deltaMs: number): void {
    for (const system of this.systems) system.update(this, deltaMs);
  }
}
