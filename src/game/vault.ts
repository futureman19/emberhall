import { ITEM_META } from "./catalog.ts";
import { AFFIXES, rareName, rareUid } from "./rare.ts";
import { log } from "./world.ts";
import type { ItemId, RareItem, World } from "./types.ts";

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
export const VAULT_VERSION = 2;

/** A rare's identity, written into the chain — the affixes ARE the value. */
export interface RareInscription {
  name: string;
  affixes: string[];
  maker?: string;
}

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
  /** Present only for rares (payload v2+). */
  rare?: RareInscription;
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

/** A rare mints with its full identity — name, affixes, maker's mark. */
export function encodeRareInscription(world: World, rare: RareItem): ItemInscription | null {
  if (!ITEM_META[rare.base]) return null;
  return {
    app: VAULT_APP,
    v: VAULT_VERSION,
    type: "item",
    item: rare.base,
    label: ITEM_META[rare.base].label,
    world: world.seed,
    hour: Math.floor(world.hour),
    rare: { name: rareName(rare), affixes: [...rare.affixes], ...(rare.maker ? { maker: rare.maker } : {}) },
  };
}

/** Parse an on-chain JSON payload back into an item inscription, or null. */
export function decodeItemInscription(raw: unknown): ItemInscription | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.app !== VAULT_APP || o.type !== "item") return null;
  if (typeof o.item !== "string" || !ITEM_IDS.has(o.item)) return null;
  const item = o.item as ItemId;
  const out: ItemInscription = {
    app: VAULT_APP,
    v: typeof o.v === "number" ? o.v : 0,
    type: "item",
    item,
    label: typeof o.label === "string" ? o.label : ITEM_META[item].label,
    world: typeof o.world === "number" ? o.world : 0,
    hour: typeof o.hour === "number" ? o.hour : 0,
  };
  // v2+: a rare block rides along — validate loosely, trust the affix list.
  if (o.rare && typeof o.rare === "object") {
    const r = o.rare as Record<string, unknown>;
    if (Array.isArray(r.affixes) && r.affixes.every((a) => typeof a === "string")) {
      out.rare = {
        name: typeof r.name === "string" ? r.name : "",
        affixes: r.affixes as string[],
        ...(typeof r.maker === "string" ? { maker: r.maker } : {}),
      };
    }
  }
  return out;
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

/** Remove a rare from the keeping — call only after the mint confirms. */
export function applyMintRare(world: World, uid: string): string | null {
  if (world.player.ghost) return "A ghost cannot.";
  const rare = world.player.rares.find((r) => r.uid === uid);
  if (!rare) return "No such wonder.";
  world.player.rares = world.player.rares.filter((r) => r.uid !== uid);
  for (const [slot, link] of Object.entries(world.player.wearRare)) {
    if (link === uid) world.player.wearRare[slot as keyof typeof world.player.wearRare] = undefined;
  }
  const note = `${rareName(rare)} passes into the chain. It is yours — truly.`;
  log(world, note);
  return note;
}

/** Grant an item back after its ordinal burns in the redeem rite. */
export function applyRedeem(world: World, item: ItemId, rare?: { name: string; affixes: string[]; maker?: string }): string {
  if (rare && rare.affixes.length > 0) {
    const restored: RareItem = {
      uid: rareUid(world.seed, world.hour),
      base: item,
      affixes: [...rare.affixes],
      ...(rare.maker ? { maker: rare.maker } : {}),
      seed: world.seed,
      hour: Math.floor(world.hour),
    };
    world.player.rares.push(restored);
    const note = `${rare.name || rareName(restored)} returns from the chain.`;
    log(world, note);
    return note;
  }
  world.player.pack[item] = (world.player.pack[item] ?? 0) + 1;
  const note = `${ITEM_META[item].label} returns from the chain.`;
  log(world, note);
  return note;
}

/** Base64 JSON payload for the 1Sat inscribe action (browser + node). */
export function inscriptionBase64(world: World, item: ItemId, rare?: RareItem): string | null {
  const payload = rare ? encodeRareInscription(world, rare) : encodeItemInscription(world, item);
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

/**
 * The vault's whisper of a price, in sats — half the shop's gold for the
 * base, doubled for a wonder, more for rank and a maker's mark. A hint to
 * start from, never an oracle: the chain pays what the chain pays.
 */
export function suggestSats(inscription: ItemInscription): number {
  const meta = ITEM_META[inscription.item];
  if (!meta) return 10;
  let sats = Math.max(5, Math.round(meta.buy / 2));
  if (inscription.rare) {
    sats *= 2;
    for (const a of inscription.rare.affixes) sats += 15 * (AFFIXES[a]?.rank ?? 1);
    if (inscription.rare.maker) sats += 10;
  }
  return Math.max(5, Math.round(sats / 5) * 5);
}

/** A rite the vault remembers — mints, listings, burns (this browser only). */
export interface LedgerEntry {
  at: number;
  kind: "mint" | "list" | "redeem" | "cancel";
  label: string;
  sats?: number;
}
export const LEDGER_MAX = 24;

export function appendLedger(entries: LedgerEntry[], e: LedgerEntry): LedgerEntry[] {
  return [...entries, e].slice(-LEDGER_MAX);
}

/** A listing made from this browser — the chain holds the lock, we hold the note. */
export interface TrackedListing {
  id: string;
  label: string;
  sats: number;
  at: number;
}

export function trackListing(list: TrackedListing[], t: TrackedListing): TrackedListing[] {
  return [...list.filter((x) => x.id !== t.id), t];
}

export function untrackListing(list: TrackedListing[], id: string): TrackedListing[] {
  return list.filter((x) => x.id !== id);
}
