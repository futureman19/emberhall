import { ITEM_META } from "./catalog.ts";
import { log } from "./world.ts";
import type { ItemId, World } from "./types.ts";

/**
 * The Vault — Emberhall's bridge between in-game items and 1Sat ordinal
 * NFTs on BSV. Minting writes the item's essence into a JSON inscription
 * (the item leaves the pack); redeeming burns the ordinal and the item
 * returns. Trades happen wallet-to-wallet or on any 1Sat market — the
 * chain is the registry, the game is one reader among many.
 *
 * Beta trust note: the sim is client-side, so a hacked save could mint
 * items it never earned. Machinery ships silent now; mint authority moves
 * server-side when the world goes persistent (same flip as the rest of
 * the enforcement layer).
 */

export const VAULT_APP = "emberhall";
export const VAULT_VERSION = 1;

export interface ItemInscription {
  app: typeof VAULT_APP;
  v: number;
  type: "item";
  item: ItemId;
  label: string;
  /** World seed the item was minted from. */
  world: number;
  /** World hour at mint. */
  hour: number;
}

const ITEM_IDS = new Set(Object.keys(ITEM_META));

export function encodeItemInscription(world: World, item: ItemId): ItemInscription | null {
  if (!ITEM_META[item]) return null;
  return {
    app: VAULT_APP,
    v: VAULT_VERSION,
    type: "item",
    item,
    label: ITEM_META[item].label,
    world: world.seed,
    hour: Math.floor(world.hour),
  };
}

/** Parse an on-chain JSON payload back into an item inscription, or null. */
export function decodeItemInscription(raw: unknown): ItemInscription | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.app !== VAULT_APP || o.type !== "item") return null;
  if (typeof o.item !== "string" || !ITEM_IDS.has(o.item)) return null;
  const item = o.item as ItemId;
  return {
    app: VAULT_APP,
    v: typeof o.v === "number" ? o.v : 0,
    type: "item",
    item,
    label: typeof o.label === "string" ? o.label : ITEM_META[item].label,
    world: typeof o.world === "number" ? o.world : 0,
    hour: typeof o.hour === "number" ? o.hour : 0,
  };
}

/** Remove one of an item from the pack — call only after the mint confirms. */
export function applyMint(world: World, item: ItemId): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  const have = world.player.pack[item] ?? 0;
  if (have < 1) return `No ${ITEM_META[item].label.toLowerCase()} to mint.`;
  world.player.pack[item] = have - 1;
  const note = `${ITEM_META[item].label} passes into the chain. It is yours — truly.`;
  log(world, note);
  return note;
}

/** Grant an item back after its ordinal burns in the redeem rite. */
export function applyRedeem(world: World, item: ItemId): string {
  world.player.pack[item] = (world.player.pack[item] ?? 0) + 1;
  const note = `${ITEM_META[item].label} returns from the chain.`;
  log(world, note);
  return note;
}

/** Base64 JSON payload for the 1Sat inscribe action (browser + node). */
export function inscriptionBase64(world: World, item: ItemId): string | null {
  const payload = encodeItemInscription(world, item);
  if (!payload) return null;
  const json = JSON.stringify(payload);
  if (typeof btoa !== "undefined") return btoa(unescape(encodeURIComponent(json)));
  return Buffer.from(json, "utf8").toString("base64");
}

/** Tolerant base64→JSON reader for ordfs content responses. */
export function decodeBase64Json(b64: string): unknown {
  try {
    if (typeof atob !== "undefined") return JSON.parse(decodeURIComponent(escape(atob(b64))));
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}
