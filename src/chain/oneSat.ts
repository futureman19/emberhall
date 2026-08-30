import { burnOrdinals, createContext, inscribe, listOrdinals, sellOrdinal, type OneSatContext } from "@1sat/actions";
import type { WalletInterface } from "@bsv/sdk";
import {
  VAULT_APP,
  decodeItemInscription,
  encodeItemInscription,
  encodeRareInscription,
  inscriptionBase64,
  type ItemInscription,
} from "@/game/vault";
import type { ItemId, RareItem, World } from "@/game/types";

/**
 * Browser glue between the Vault and the user's BRC-100 wallet via the
 * 1Sat action stack — the same packages Grydbound ships in production.
 * The wallet keeps the keys; every rite below is one signed action.
 */

/** 1Sat content CDN (mainnet) — same constant Grydbound hardcodes in nftPreview. */
const CONTENT_URL = "https://api.1sat.app/content";

let cached: { wallet: WalletInterface; ctx: OneSatContext } | null = null;

export function oneSatCtx(wallet: WalletInterface): OneSatContext {
  if (cached && cached.wallet === wallet) return cached.ctx;
  const ctx = createContext(wallet, { chain: "main" });
  cached = { wallet, ctx };
  return ctx;
}

/** `<txid>.<vout>` (BRC-100) → `<txid>_<vout>` (1Sat indexer/CDN). */
export function toOneSatOutpoint(outpoint: string): string {
  return outpoint.replace(/\.(\d+)$/, "_$1");
}

async function unwrap(label: string, result: { txid?: string; error?: string }): Promise<string> {
  if (result.error) throw new Error(`${label} failed: ${result.error}`);
  if (!result.txid) throw new Error(`${label} failed: the wallet returned no txid`);
  return result.txid;
}

/** Mint a pack item into a 1Sat ordinal carrying its essence as JSON. */
export async function mintItemNft(
  ctx: OneSatContext,
  world: World,
  item: ItemId,
): Promise<{ txid: string; payload: ItemInscription }> {
  const payload = encodeItemInscription(world, item);
  const base64Content = payload ? inscriptionBase64(world, item) : null;
  if (!payload || !base64Content) throw new Error("That item cannot be inscribed.");
  const res = await inscribe.execute(ctx, {
    base64Content,
    contentType: "application/json",
    map: { app: VAULT_APP, type: "item", item: payload.item },
  });
  const txid = await unwrap("The mint", res);
  return { txid, payload };
}

/** Mint a rare — its name, affixes, and maker's mark go onto the chain. */
export async function mintRareNft(
  ctx: OneSatContext,
  world: World,
  rare: RareItem,
): Promise<{ txid: string; payload: ItemInscription }> {
  const payload = encodeRareInscription(world, rare);
  const base64Content = payload ? inscriptionBase64(world, rare.base, rare) : null;
  if (!payload || !base64Content) throw new Error("That wonder cannot be inscribed.");
  const res = await inscribe.execute(ctx, {
    base64Content,
    contentType: "application/json",
    map: { app: VAULT_APP, type: "item", item: payload.item, rare: "1" },
  });
  const txid = await unwrap("The mint", res);
  return { txid, payload };
}

export interface VaultNft {
  /** Basket tracking id (underscore outpoint) — the handle for burn/sell. */
  id: string;
  outpoint: string;
  inscription: ItemInscription;
}

const contentCache = new Map<string, ItemInscription | null>();

async function fetchInscription(outpointUs: string): Promise<ItemInscription | null> {
  if (contentCache.has(outpointUs)) return contentCache.get(outpointUs) ?? null;
  let found: ItemInscription | null = null;
  try {
    const res = await fetch(`${CONTENT_URL}/${outpointUs}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const text = await res.text();
      try {
        found = decodeItemInscription(JSON.parse(text));
      } catch {
        found = null;
      }
    }
  } catch {
    found = null;
  }
  contentCache.set(outpointUs, found);
  return found;
}

/**
 * List the wallet's ordinals and keep only Emberhall item-NFTs, reading
 * each origin's JSON content from the 1Sat CDN. Concurrency-capped; results
 * cache by outpoint so repeat opens of the Vault cost nothing.
 */
export async function listVaultNfts(ctx: OneSatContext): Promise<VaultNft[]> {
  const result = await listOrdinals.execute(ctx, { includeTags: true, limit: 200 });
  const outputs = result.outputs ?? [];
  const out: VaultNft[] = [];
  const CONCURRENCY = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < outputs.length) {
      const o = outputs[cursor++]!;
      const id = toOneSatOutpoint(o.outpoint);
      const inscription = await fetchInscription(id);
      if (inscription) out.push({ id, outpoint: o.outpoint, inscription });
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, outputs.length) }, () => worker()));
  out.sort((a, b) => a.inscription.label.localeCompare(b.inscription.label));
  return out;
}

/** Burn an item ordinal — the rite that lets the game grant the item back. */
export async function redeemItemNft(ctx: OneSatContext, id: string): Promise<string> {
  const res = await burnOrdinals.execute(ctx, { ids: [toOneSatOutpoint(id)], app: VAULT_APP });
  return unwrap("The redeem", res);
}

/**
 * List an item ordinal for sale on the global 1Sat orderbook (OrdLock).
 * Returns the listing txid; anyone can buy it from any 1Sat market —
 * the buyer pays real satoshis straight to the seller's wallet.
 */
export async function sellItemNft(ctx: OneSatContext, id: string, priceSats: number): Promise<string> {
  if (!Number.isSafeInteger(priceSats) || priceSats < 1) throw new Error("Name a price in whole satoshis.");
  const res = await sellOrdinal.execute(ctx, { id: toOneSatOutpoint(id), price: priceSats });
  return unwrap("The listing", res);
}
