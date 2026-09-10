type Tile = { kind: string; h: number };
type Span = { x0: number; z0: number; width: number; height: number };
type Request = { tiles: readonly (readonly (Tile | undefined)[] | undefined)[]; span: Span; dependencies: readonly unknown[]; missingTileDependencies?: readonly unknown[] };
export type GroundUpdatePlan = { mode: 'full' | 'patch' | 'skip'; dirty: { tx: number; ty: number }[] };

/** Planning only. Caller owns existing vertex math and includes every non-tile input in dependencies.
 * Plan, write successfully, then commit. Failed writes must never advance the snapshot.
 */
export function createGroundUpdatePlanner(limit = 32) {
  let previous: { key: unknown[]; kinds: (string | undefined)[]; heights: (number | undefined)[] } | undefined;
  let generation = 0;
  return {
    prepare({ tiles, span, dependencies, missingTileDependencies = [] }: Request) {
      const { x0, z0, width, height } = span;
      if (![x0, z0, width, height].every(Number.isInteger) || width <= 0 || height <= 0 || width * height > 262144) throw new Error('Invalid bounded tile span');
      const kinds: (string | undefined)[] = [], heights: (number | undefined)[] = [];
      for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
        const tile = tiles[z0 + z]?.[x0 + x];
        kinds.push(tile?.kind); heights.push(tile?.h);
      }
      // Haze only colors missing vertices. The padded span is conservative:
      // any hole or world edge retains full color invalidation.
      const key = [tiles, x0, z0, width, height, ...dependencies,
        ...(kinds.includes(undefined) ? missingTileDependencies : [])];
      const same = previous && previous.key.length === key.length && key.every((x, i) => Object.is(x, previous!.key[i]));
      const dirty: { tx: number; ty: number }[] = [];
      if (same) for (let i = 0; i < kinds.length; i++) {
        if (kinds[i] !== previous!.kinds[i] || !Object.is(heights[i], previous!.heights[i])) dirty.push({ tx: x0 + i % width, ty: z0 + Math.floor(i / width) });
      }
      const plan: GroundUpdatePlan = { mode: !same || dirty.length > limit ? 'full' : dirty.length ? 'patch' : 'skip', dirty };
      const expected = generation;
      return { plan, commit() { if (expected !== generation) throw new Error('Stale terrain plan'); previous = { key, kinds, heights }; generation++; } };
    },
  };
}
