const OUTPOINT = /^[0-9a-f]{64}\.\d+$/i;

export interface WalletOrdinalIdentity {
  readonly trackingId: string;
  readonly origin: string;
  readonly outpoint: string;
  readonly listed: boolean;
  readonly priceSats?: number;
}

/** Separate stable inscription origin from the wallet's current spend handle. */
export function walletOrdinalIdentity(output: { outpoint: string; tags?: readonly string[] }): WalletOrdinalIdentity | null {
  if (typeof output.outpoint !== "string" || !OUTPOINT.test(output.outpoint)) return null;
  const tags = output.tags ?? [];
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) return null;
  const idTags = tags.filter((tag) => tag.startsWith("id:") && tag.length > 3);
  if (idTags.length !== 1) return null;
  const origins = tags.filter((tag) => tag === "origin" || tag.startsWith("origin:"));
  if (origins.length !== 1) return null;
  const origin = origins[0] === "origin" ? output.outpoint : origins[0]!.slice("origin:".length);
  if (!OUTPOINT.test(origin)) return null;
  const priceTags = tags.filter((tag) => tag.startsWith("price:"));
  if (priceTags.length > 1) return null;
  let priceSats: number | undefined;
  if (priceTags.length === 1) {
    priceSats = Number(priceTags[0]!.slice("price:".length));
    if (!Number.isSafeInteger(priceSats) || priceSats < 1) return null;
  }
  const listed = tags.includes("ordlock");
  if (listed !== (priceSats !== undefined)) return null;
  return Object.freeze({
    trackingId: idTags[0]!.slice(3),
    origin,
    outpoint: output.outpoint,
    listed,
    ...(priceSats !== undefined ? { priceSats } : {}),
  });
}

export function contentPointer(origin: string): string {
  return origin.replace(/\.(\d+)$/, "_$1");
}
