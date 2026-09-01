import type { HorizonTreeReduction } from "./graphics-settings.ts";

/**
 * Selects an exact, deterministic share from the complete horizon stock.
 * Ranking by a spatial hash creates natural gaps throughout the horizon;
 * restoring traversal order keeps matrix writes stable frame to frame.
 */
export function thinHorizonTrees<T>(
  trees: readonly T[],
  reduction: HorizonTreeReduction,
  score: (tree: T, index: number) => number,
): T[] {
  if (reduction === 0) return trees.slice();

  const keepCount = Math.floor(trees.length * (1 - reduction / 100));
  return trees
    .map((tree, index) => ({ tree, index, score: score(tree, index) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, keepCount)
    .sort((a, b) => a.index - b.index)
    .map(({ tree }) => tree);
}
