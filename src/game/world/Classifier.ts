import type { ModuleType, TileType } from '../config';
import type { ComponentStats } from './Connectivity';

/** Priority-ordered classification. Any misfit cluster with ≥3 tiles becomes a wound. */
export function classify(stats: ComponentStats): ModuleType | null {
  if (stats.tileCount < 3) return null;
  const c = (t: TileType) => stats.typeCounts.get(t) ?? 0;

  if (c('glyph') > 0) return 'glyph';
  if (c('bloom') >= 2 && c('stem') >= 3) return 'canopy';
  if (c('root') >= 4) return 'taproot';
  if (c('leaf') >= 3 && c('stem') >= 2) return 'trunk';
  return 'wound';
}
