import { describe, expect, it } from 'vitest';
import { Connectivity, tileKeyFor } from '../src/game/world/Connectivity';

describe('Connectivity', () => {
  it('adds isolated tiles and calculates component stats', () => {
    const connectivity = new Connectivity();
    const root = connectivity.add('2,3', 2, 3, 'root');

    expect(connectivity.has('2,3')).toBe(true);
    expect(connectivity.stats(root)).toMatchObject({
      root,
      tileCount: 1,
      centroid: { x: 2, y: 3 },
    });
    expect(connectivity.stats(root).typeCounts.get('root')).toBe(1);
  });

  it('unions components while preserving tiles, counts, and centroid', () => {
    const connectivity = new Connectivity();
    connectivity.add('0,0', 0, 0, 'root');
    connectivity.add('1,0', 1, 0, 'root');
    connectivity.add('2,0', 2, 0, 'bloom');

    expect(connectivity.neighborsOf('1,0')).toEqual(
      expect.arrayContaining(['0,0', '2,0']),
    );

    let root = connectivity.union('0,0', '1,0');
    root = connectivity.union(root, '2,0');
    const stats = connectivity.stats('0,0');

    expect(stats.root).toBe(root);
    expect(stats.tileCount).toBe(3);
    expect(stats.centroid).toEqual({ x: 1, y: 0 });
    expect(stats.typeCounts.get('root')).toBe(2);
    expect(stats.typeCounts.get('bloom')).toBe(1);
    expect(connectivity.find('2,0')).toBe(root);
  });

  it('supports diagonal neighbors and ignores duplicate additions', () => {
    const connectivity = new Connectivity();
    const root = connectivity.add(tileKeyFor(4, 4), 4, 4, 'stem');
    connectivity.add(tileKeyFor(5, 5), 5, 5, 'leaf');

    expect(connectivity.neighborsOf('4,4')).toContain('5,5');
    expect(connectivity.add('4,4', 4, 4, 'stem')).toBe(root);
    expect(connectivity.stats(root).tileCount).toBe(1);
  });
});
