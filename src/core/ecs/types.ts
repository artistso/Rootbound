import type { World } from './world';

export type Entity = number;

/** A typed key used to store and retrieve one component kind. */
export interface ComponentType<T> {
  readonly name: string;
  readonly __type?: T;
}

export function defineComponent<T>(name: string): ComponentType<T> {
  return { name };
}

export interface System {
  update(world: World, deltaMs: number): void;
}
