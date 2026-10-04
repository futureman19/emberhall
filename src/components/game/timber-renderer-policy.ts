/** Canonical catalog identities; presentation only, no world position gate or RNG. */
export const TIMBER_IDS = ["oak", "pine", "willow", "birch", "ash", "redwood", "yew", "ghostwood"] as const;
export type TimberId = (typeof TIMBER_IDS)[number];
export function authoredTimberId(resourceId: string, ready: boolean): TimberId | null {
  return ready && (TIMBER_IDS as readonly string[]).includes(resourceId) ? resourceId as TimberId : null;
}
export function timberAssetUrl(id: TimberId) {
  return id === "oak" ? "/art/lanternwood/oak.glb" : `/art/lanternwood/timber-${id}.glb`;
}
