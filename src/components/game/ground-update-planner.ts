type Tile = { kind: string; h: number };
type Span = { x0: number; z0: number; width: number; height: number };
type Request = { tiles: readonly (readonly (Tile | undefined)[] | undefined)[]; span: Span; dependencies: readonly unknown[] };
export type GroundUpdatePlan = { mode: 'full' | 'patch' | 'skip'; dirty: { tx: number; ty: number }[] };

/** Planning only. Caller owns existing vertex math and includes every non-tile input in dependencies.
 * Plan, write successfully, then commit. Failed writes must never advance the snapshot.
 */
export function createGroundUpdatePlanner(limit = 32) {
  let previous: { key: unknown[]; kinds: (string | undefined)[]; heights: (number | undefined)[] } | undefined;
  let generation = 0;
  return {
    prepare({ tiles, span, dependencies }: Request) {
      const { x0, z0, width, height } = span;
      if (![x0, z0, width, height].every(Number.isInteger) || width <= 0 || height <= 0 || width * height > 262144) throw new Error('Invalid bounded tile span');
      const key = [tiles, x0, z0, width, height, ...dependencies];
      const kinds: (string | undefined)[] = [], heights: (number | undefined)[] = [];
      const same = previous && previous.key.length === key.length && key.every((x, i) => Object.is(x, previous!.key[i]));
      const dirty: { tx: number; ty: number }[] = [];
      for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
        const tile = tiles[z0 + z]?.[x0 + x], i = kinds.length;
        kinds.push(tile?.kind); heights.push(tile?.h);
        if (same && (tile?.kind !== previous!.kinds[i] || !Object.is(tile?.h, previous!.heights[i]))) dirty.push({ tx: x0 + x, ty: z0 + z });
      }
      const plan: GroundUpdatePlan = { mode: !same || dirty.length > limit ? 'full' : dirty.length ? 'patch' : 'skip', dirty };
      const expected = generation;
      return { plan, commit() { if (expected !== generation) throw new Error('Stale terrain plan'); previous = { key, kinds, heights }; generation++; } };
    },
  };
}
