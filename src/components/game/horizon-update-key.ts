// Exact identity/value comparison; never quantize movement or approximate terrain revisions.
export function sameHorizonUpdateKey(previous: readonly unknown[] | null, next: readonly unknown[]): boolean {
  return previous !== null && previous.length === next.length && next.every((value, i) => Object.is(value, previous[i]));
}
