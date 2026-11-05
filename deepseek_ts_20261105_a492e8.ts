import type { TileType } from '../config';

const NEIGHBORS_8: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

export interface ComponentStats {
  root: string;
  tileCount: number;
  typeCounts: Map<TileType, number>;
  centroid: { x: number; y: number };
}

export function parseTileKey(k: string): [number, number] {
  const [a, b] = k.split(',');
  return [Number(a), Number(b)];
}

export function tileKeyFor(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

export class Connectivity {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();
  private tiles = new Map<string, Set<string>>();
  private typeCounts = new Map<string, Map<TileType, number>>();
  private centroidSum = new Map<string, { x: number; y: number }>();
  private tileCount = new Map<string, number>();

  has(tk: string): boolean { return this.parent.has(tk); }

  find(k: string): string {
    let root = k;
    while (this.parent.get(root) !== root) {
      const next = this.parent.get(root);
      if (next === undefined) return root;
      root = next;
    }
    while (this.parent.get(k) !== root) {
      const next = this.parent.get(k)!;
      this.parent.set(k, root);
      k = next;
    }
    return root;
  }

  add(tk: string, gx: number, gy: number, type: TileType): string {
    if (this.parent.has(tk)) return this.find(tk);
    this.parent.set(tk, tk);
    this.rank.set(tk, 0);
    this.tiles.set(tk, new Set([tk]));
    this.typeCounts.set(tk, new Map([[type, 1]]));
    this.centroidSum.set(tk, { x: gx, y: gy });
    this.tileCount.set(tk, 1);
    return tk;
  }

  union(a: string, b: string): string {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return ra;
    const rankA = this.rank.get(ra) ?? 0, rankB = this.rank.get(rb) ?? 0;
    let newRoot: string, child: string;
    if (rankA >= rankB) { newRoot = ra; child = rb; } else { newRoot = rb; child = ra; }
    this.parent.set(child, newRoot);
    if (rankA === rankB) this.rank.set(newRoot, rankA + 1);

    const newTiles = this.tiles.get(newRoot)!;
    for (const t of this.tiles.get(child)!) newTiles.add(t);
    this.tiles.delete(child);

    const newCounts = this.typeCounts.get(newRoot)!;
    for (const [t, n] of this.typeCounts.get(child)!) newCounts.set(t, (newCounts.get(t) ?? 0) + n);
    this.typeCounts.delete(child);

    const newSum = this.centroidSum.get(newRoot)!;
    const childSum = this.centroidSum.get(child)!;
    newSum.x += childSum.x;
    newSum.y += childSum.y;
    this.centroidSum.delete(child);

    this.tileCount.set(newRoot, (this.tileCount.get(newRoot) ?? 0) + (this.tileCount.get(child) ?? 0));
    this.tileCount.delete(child);

    this.rank.delete(child);
    return newRoot;
  }

  stats(root: string): ComponentStats {
    const r = this.find(root);
    const count = this.tileCount.get(r) ?? 0;
    const sum = this.centroidSum.get(r) ?? { x: 0, y: 0 };
    return {
      root: r,
      tileCount: count,
      typeCounts: new Map(this.typeCounts.get(r) ?? []),
      centroid: { x: sum.x / (count || 1), y: sum.y / (count || 1) },
    };
  }

  neighborsOf(tk: string): string[] {
    const [gx, gy] = parseTileKey(tk);
    const out: string[] = [];
    for (const [dx, dy] of NEIGHBORS_8) {
      const nk = tileKeyFor(gx + dx, gy + dy);
      if (this.parent.has(nk)) out.push(nk);
    }
    return out;
  }

  NEIGHBORS_8 = NEIGHBORS_8;
}