import { defineComponent } from '../core/ecs/types';
import type { ModuleType } from './config';

export const Transform = defineComponent<{ x: number; y: number; angle: number }>('Transform');

export const Module = defineComponent<{
  moduleType: ModuleType;
  componentRoot: string;
  centroid: { x: number; y: number };
  tileCount: number;
}>('Module');
