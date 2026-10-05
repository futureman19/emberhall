import type { OneSatContext } from "@1sat/actions";
import type { WalletInterface, WalletOutput } from "@bsv/sdk";
import {
  VAULT_APP,
  decodeItemInscription,
  encodeItemInscription,
  encodeRareInscription,
  inscriptionBase64,
  type ItemInscription,
} from "@/game/vault";
import {
  CHAIN_ARTIFACT_APP,
  CHAIN_ARTIFACT_VERSION,
  artifactBase64,
  decodeChainArtifact,
  encodeCharacterLookInscription,
  encodePartInscription,
  type CharacterLookInscription,
  type EmberhallChainArtifact,
  type PartInscription,
} from "@/game/chain-artifacts";
import type { VoxelPartV1 } from "@/game/look/parts";
import type { ItemId, RareItem, World } from "@/game/types";
import { contentPointer, walletOrdinalIdentity } from "./ordinal-identity";
import { abortable, readBoundedJson, readOrdinalPages, WALLET_READ_LIMITS } from "./wallet-read-bounds";

/** Browser glue between Emberhall artifacts and a BRC-100 wallet. */
const CONTENT_URL = "https://api.1sat.app/content";
let cached: { wallet: WalletInterface; ctx: OneSatContext } | null = null;

export function oneSatCtx(wallet: WalletInterface): OneSatContext {
  if (cached && cached.wallet === wallet) return cached.ctx;
  // Keep @1sat/actions out of the SSR graph. Its current package export points
  // at an extensionless `dist/types` module that Node cannot resolve, while all
  // wallet rites are browser-only. This is the same context createContext makes.
  const ctx: OneSatContext = { wallet, chain: "main", isBaseWallet: true };
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

export async function mintItemNft(
  ctx: OneSatContext,
  world: World,
  item: ItemId,
): Promise<{ txid: string; payload: ItemInscription }> {
  const payload = encodeItemInscription(world, item);
  const base64Content = payload ? inscriptionBase64(world, item) : null;
  if (!payload || !base64Content) throw new Error("That item cannot be inscribed.");
  const { inscribe } = await import("@1sat/actions");
  const res = await inscribe.execute(ctx, {
    base64Content,
    contentType: "application/json",
    map: { app: VAULT_APP, type: "item", item: payload.item },
  });
  return { txid: await unwrap("The mint", res), payload };
}

export async function mintRareNft(
  ctx: OneSatContext,
  world: World,
  rare: RareItem,
): Promise<{ txid: string; payload: ItemInscription }> {
  const payload = encodeRareInscription(world, rare);
  const base64Content = payload ? inscriptionBase64(world, rare.base, rare) : null;
  if (!payload || !base64Content) throw new Error("That wonder cannot be inscribed.");
  const { inscribe } = await import("@1sat/actions");
  const res = await inscribe.execute(ctx, {
    base64Content,
    contentType: "application/json",
    map: { app: VAULT_APP, type: "item", item: payload.item, rare: "1", v: String(payload.v) },
  });
  return { txid: await unwrap("The mint", res), payload };
}

export interface VaultNft {
  id: string;
  origin: string;
  outpoint: string;
  listed: boolean;
  priceSats?: number;
  inscription: ItemInscription;
}

export interface LookNft {
  id: string;
  origin: string;
  outpoint: string;
  listed: boolean;
  priceSats?: number;
  inscription: CharacterLookInscription;
}

export interface PartNft {
  id: string;
  origin: string;
  outpoint: string;
  listed: boolean;
  priceSats?: number;
  inscription: PartInscription;
}

export type EmberhallNft = VaultNft | LookNft | PartNft;
type WalletInscription = ItemInscription | EmberhallChainArtifact;

export async function mintCharacterLookNft(
  ctx: OneSatContext,
  world: World,
  previous?: LookNft,
): Promise<{ txid: string; payload: CharacterLookInscription }> {
  const person = world.people.find(({ isPlayer }) => isPlayer);
  if (!person) throw new Error("The looking glass cannot find you.");
  const payload = encodeCharacterLookInscription(
    world,
    person,
    previous ? { revision: previous.inscription.revision, outpoint: previous.origin } : undefined,
  );
  if (!payload) throw new Error("That person cannot be inscribed.");
  const { inscribe } = await import("@1sat/actions");
  const res = await inscribe.execute(ctx, {
    base64Content: artifactBase64(payload),
    contentType: "application/json",
    map: {
      app: CHAIN_ARTIFACT_APP,
      type: "look",
      schema: payload.look.schema,
      v: String(payload.v),
      revision: String(payload.revision),
      ...(payload.predecessor ? { predecessor: payload.predecessor } : {}),
    },
  });
  return { txid: await unwrap("The look inscription", res), payload };
}

export async function mintPartNft(
  ctx: OneSatContext,
  world: World,
  part: VoxelPartV1,
): Promise<{ txid: string; payload: PartInscription }> {
  const payload = encodePartInscription(world, part);
  if (!payload) throw new Error("That sculpture cannot be inscribed.");
  const { inscribe } = await import("@1sat/actions");
  const res = await inscribe.execute(ctx, {
    base64Content: artifactBase64(payload),
    contentType: "application/json",
    map: {
      app: CHAIN_ARTIFACT_APP,
      type: "part",
      schema: payload.part.schema,
      slot: payload.part.slot,
      rarity: payload.part.rarity,
      v: String(CHAIN_ARTIFACT_VERSION),
    },
  });
  return { txid: await unwrap("The part inscription", res), payload };
}

const contentCache = new Map<string, WalletInscription>();

async function fetchInscription(outpointUs: string, signal: AbortSignal): Promise<WalletInscription | null> {
  signal.throwIfAborted();
  const hit = contentCache.get(outpointUs);
  if (hit) return hit;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new Error("Inscription read timed out; retry.")), WALLET_READ_LIMITS.contentMs);
  const bounded = AbortSignal.any([signal, timeout.signal]);
  try {
    const res = await abortable(fetch(`${CONTENT_URL}/${outpointUs}`, { signal: bounded }), bounded);
    const raw = await readBoundedJson(res, bounded);
    const found = decodeItemInscription(raw) ?? decodeChainArtifact(raw);
    bounded.throwIfAborted();
    if (found) {
      if (contentCache.size >= WALLET_READ_LIMITS.cacheEntries) contentCache.delete(contentCache.keys().next().value!);
      contentCache.set(outpointUs, found);
    }
    return found;
  } finally {
    clearTimeout(timer);
  }
}

export function artifactLabel(nft: EmberhallNft): string {
  if (nft.inscription.type === "item") return nft.inscription.rare?.name || nft.inscription.label;
  if (nft.inscription.type === "look") return `${nft.inscription.name} · revision ${nft.inscription.revision}`;
  return nft.inscription.part.name;
}

/** Complete list or rejection: legacy array callers never receive silent partial data.
 * Cancellation stops observing SDK reads; it cannot dismiss an outstanding wallet prompt.
 */
export async function listEmberhallNfts(ctx: OneSatContext, options: { signal?: AbortSignal } = {}): Promise<EmberhallNft[]> {
  const stop = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, stop.signal]) : stop.signal;
  const timer = setTimeout(() => stop.abort(new Error("Wallet read budget expired; holdings are unavailable. Retry after any wallet permission prompt is resolved.")), WALLET_READ_LIMITS.scanMs);
  try {
    signal.throwIfAborted();
    const { listOrdinals } = await abortable(import("@1sat/actions"), signal);
    const outputs = await readOrdinalPages<WalletOutput>((input) => listOrdinals.execute(ctx, input), signal);
    const byOrigin = new Map<string, EmberhallNft>();
    const CONCURRENCY = 4;
    let cursor = 0;
    async function worker() {
      while (cursor < outputs.length) {
        signal.throwIfAborted();
        const output = outputs[cursor++]!;
        const identity = walletOrdinalIdentity(output);
        if (!identity) throw new Error("Wallet ordinal metadata could not be validated; holdings are incomplete.");
        const inscription = await fetchInscription(contentPointer(identity.origin), signal);
        signal.throwIfAborted();
        if (inscription) {
          byOrigin.set(identity.origin, {
            id: identity.trackingId,
            origin: identity.origin,
            outpoint: identity.outpoint,
            listed: identity.listed,
            ...(identity.priceSats !== undefined ? { priceSats: identity.priceSats } : {}),
            inscription,
          } as EmberhallNft);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, outputs.length) }, () => worker()));
    signal.throwIfAborted();
    return [...byOrigin.values()].sort((a, b) => artifactLabel(a).localeCompare(artifactLabel(b)));
  } finally {
    clearTimeout(timer);
    stop.abort();
  }
}

/** Backward-compatible item-only reader. */
export async function listVaultNfts(ctx: OneSatContext): Promise<VaultNft[]> {
  const all = await listEmberhallNfts(ctx);
  return all.filter((entry): entry is VaultNft => entry.inscription.type === "item");
}

export async function redeemItemNft(ctx: OneSatContext, id: string): Promise<string> {
  const { burnOrdinals } = await import("@1sat/actions");
  const res = await burnOrdinals.execute(ctx, { ids: [id], app: VAULT_APP });
  return unwrap("The redeem", res);
}

export async function sellItemNft(ctx: OneSatContext, id: string, priceSats: number): Promise<string> {
  if (!Number.isSafeInteger(priceSats) || priceSats < 1) throw new Error("Name a price in whole satoshis.");
  const { sellOrdinal } = await import("@1sat/actions");
  const res = await sellOrdinal.execute(ctx, { id, price: priceSats });
  return unwrap("The listing", res);
}

export async function cancelItemNft(ctx: OneSatContext, id: string): Promise<string> {
  const { cancelOrdinalListing } = await import("@1sat/actions");
  const res = await cancelOrdinalListing.execute(ctx, { id });
  return unwrap("The cancel", res);
}
