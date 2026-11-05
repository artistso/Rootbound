import { describe, expect, it } from 'vitest';
import { classify } from '../src/game/world/Classifier';
import type { ComponentStats } from '../src/game/world/Connectivity';
import type { TileType } from '../src/game/config';

function stats(counts: Partial<Record<TileType, number>>): ComponentStats {
  const entries = Object.entries(counts) as [TileType, number][];
  return {
    root: '0,0',
    tileCount: entries.reduce((sum, [, count]) => sum + count, 0),
    typeCounts: new Map(entries),
    centroid: { x: 0, y: 0 },
  };
}

describe('classify', () => {
  it('leaves clusters below the module threshold unclassified', () => {
    expect(classify(stats({ root: 2 }))).toBeNull();
  });

  it.each([
    [{ glyph: 1, stem: 2 }, 'glyph'],
    [{ bloom: 2, stem: 3 }, 'canopy'],
    [{ root: 4 }, 'taproot'],
    [{ leaf: 3, stem: 2 }, 'trunk'],
    [{ leaf: 1, root: 1, stem: 1 }, 'wound'],
  ] as const)('classifies %o as %s', (counts, expected) => {
    expect(classify(stats(counts))).toBe(expected);
  });

  it('uses the documented priority when multiple rules match', () => {
    expect(classify(stats({ glyph: 1, bloom: 2, stem: 3 }))).toBe('glyph');
    expect(classify(stats({ root: 4, leaf: 3, stem: 2 }))).toBe('taproot');
  });
});
