import { useWallet } from "@1sat/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemGlyph } from "@/components/game/paperdoll";
import { ITEM_META } from "@/game/catalog";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import type { ItemId, RareItem } from "@/game/types";
import {
  listVaultNfts,
  mintItemNft,
  mintRareNft,
  oneSatCtx,
  redeemItemNft,
  sellItemNft,
  cancelItemNft,
  type VaultNft,
} from "@/chain/oneSat";
import { rareName } from "@/game/rare";
import {
  appendLedger,
  suggestSats,
  trackListing,
  untrackListing,
  type ItemInscription,
  type LedgerEntry,
  type TrackedListing,
} from "@/game/vault";
import { ItemTipContent } from "@/components/game/item-tip";
import { Tip } from "@/components/ui/tip";

const LISTINGS_KEY = "emberhall-vault-listings";
const LEDGER_KEY = "emberhall-vault-ledger";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* the vault forgives a full coffer */
  }
}

/** A rare tooltip needs a RareItem shape — rebuild it from the inscription. */
function rareFromInscription(nft: VaultNft): RareItem | undefined {
  const r = nft.inscription.rare;
  if (!r) return undefined;
  return { uid: nft.id, base: nft.inscription.item, affixes: r.affixes, maker: r.maker, seed: nft.inscription.world, hour: nft.inscription.hour };
}

/**
 * The Vault — mint pack items into 1Sat ordinal NFTs, trade them for real
 * BSV on the global orderbook, and redeem them back into the vale.
 * Keys never leave the player's wallet; every rite is one signed action.
 */
export function VaultGump() {
  const open = useGame((s) => s.openVault);
  if (!open) return null;
  return <VaultInner />;
}

function VaultInner() {
  const close = useGame((s) => s.closeVault);
  const pack = useGame((s) => s.snap.player?.pack);
  const rares = useGame((s) => s.snap.player?.rares) ?? [];
  const mintApplied = useGame((s) => s.mintApplied);
  const mintRareApplied = useGame((s) => s.mintRareApplied);
  const redeemApplied = useGame((s) => s.redeemApplied);
  const flash = useGame((s) => s.flash);
  const { wallet, status, connect, error: walletError } = useWallet();

  const [nfts, setNfts] = useState<VaultNft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [listings, setListings] = useState<TrackedListing[]>(() => loadJson(LISTINGS_KEY, []));
  const [ledger, setLedger] = useState<LedgerEntry[]>(() => loadJson(LEDGER_KEY, []));

  const connected = status === "connected" && wallet;

  const remember = useCallback((e: Omit<LedgerEntry, "at">) => {
    setLedger((cur) => {
      const next = appendLedger(cur, { ...e, at: Date.now() });
      saveJson(LEDGER_KEY, next);
      return next;
    });
  }, []);

  const track = useCallback((t: TrackedListing) => {
    setListings((cur) => {
      const next = trackListing(cur, t);
      saveJson(LISTINGS_KEY, next);
      return next;
    });
  }, []);

  const untrack = useCallback((id: string) => {
    setListings((cur) => {
      const next = untrackListing(cur, id);
      saveJson(LISTINGS_KEY, next);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setError(null);
    try {
      setNfts(await listVaultNfts(oneSatCtx(wallet)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The chain did not answer.");
    }
  }, [wallet]);

  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The rite failed.");
    } finally {
      setBusy(null);
    }
  }

  const packItems = (Object.entries(pack ?? {}) as [ItemId, number][]).filter(([, n]) => n > 0);
  const walletIds = new Set((nfts ?? []).map((n) => n.id));
  /** Listings we remember that the wallet no longer holds — locked on the orderbook. */
  const awayListings = listings.filter((t) => !walletIds.has(t.id));
  const suggestFor = (inscription: ItemInscription) => suggestSats(inscription);

  return (
    <div className="pointer-events-auto absolute top-16 right-3 max-h-[min(70vh,36rem)] w-[min(100%-1.5rem,22rem)] overflow-auto rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4 sm:right-4">
      <p className="font-display text-sm text-fg">The Vault</p>
      <p className="mt-2 text-pretty text-xs leading-relaxed text-muted">
        Mint an item into the chain — an NFT in your wallet, tradable for true coin. Redeem it, and it returns to the vale.
      </p>

      {!connected ? (
        <div className="mt-4">
          <Button
            className="w-full"
            disabled={busy !== null || status === "connecting" || status === "detecting"}
            onClick={() => void run("connect", () => connect())}
          >
            {status === "connecting" || status === "detecting" ? "Seeking the wallet…" : "Connect a BSV wallet"}
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Yours Wallet, or any BRC-100 wallet. Keys stay with you — the vale only ever asks.
          </p>
          {(walletError || error) && <p className="mt-2 text-xs text-accent">{walletError?.message ?? error}</p>}
        </div>
      ) : (
        <>
          <div className="mt-4">
            <p className="font-display text-xs tracking-wider text-muted uppercase">In your pack — mint</p>
            {packItems.length === 0 ? (
              <p className="mt-1 text-xs text-muted">An empty pack has nothing to give the chain.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {packItems.map(([id, n]) => (
                  <li key={id} className="flex items-center justify-between gap-2 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 py-2">
                    <Tip content={<ItemTipContent id={id} />} className="min-w-0">
                      <span className="flex items-center gap-2 text-sm text-fg">
                        <ItemGlyph id={id} className="size-4" />
                        {ITEM_META[id].label}
                        <span className="text-xs text-muted">×{n}</span>
                      </span>
                    </Tip>
                    <Button
                      className="h-8 px-2 text-xs"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`mint:${id}`, async () => {
                          const w = getWorld();
                          await mintItemNft(oneSatCtx(wallet!), w, id);
                          mintApplied(id);
                          remember({ kind: "mint", label: ITEM_META[id].label });
                          await refresh();
                        })
                      }
                    >
                      {busy === `mint:${id}` ? "Minting…" : "Mint"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {rares.length > 0 ? (
            <div className="mt-4">
              <p className="font-display text-xs tracking-wider text-gold uppercase">Rarities — mint a wonder</p>
              <ul className="mt-2 space-y-1">
                {rares.map((r) => (
                  <li key={r.uid} className="flex items-center justify-between gap-2 rounded-[var(--radius-xs)] border border-gold/40 bg-surface-2 px-3 py-2">
                    <Tip content={<ItemTipContent id={r.base} rare={r} />} className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2 text-sm text-gold">
                        <ItemGlyph id={r.base} className="size-4 shrink-0" />
                        <span className="truncate">{rareName(r)}</span>
                      </span>
                    </Tip>
                    <Button
                      className="h-8 shrink-0 px-2 text-xs"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`mint:${r.uid}`, async () => {
                          const w = getWorld();
                          await mintRareNft(oneSatCtx(wallet!), w, r);
                          mintRareApplied(r.uid);
                          remember({ kind: "mint", label: rareName(r) });
                          await refresh();
                        })
                      }
                    >
                      {busy === `mint:${r.uid}` ? "Minting…" : "Mint"}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-xs tracking-wider text-muted uppercase">On the chain — yours</p>
              <button type="button" className="text-xs text-muted underline" disabled={busy !== null} onClick={() => void refresh()}>
                {nfts === null ? "Loading…" : "Refresh"}
              </button>
            </div>
            {nfts === null ? (
              <p className="mt-1 text-xs text-muted">Reading the chain…</p>
            ) : nfts.length === 0 && awayListings.length === 0 ? (
              <p className="mt-1 text-xs text-muted">No Emberhall items in this wallet yet. Mint one above.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {nfts.map((nft) => {
                  const tracked = listings.find((t) => t.id === nft.id);
                  const rare = rareFromInscription(nft);
                  const suggest = suggestFor(nft.inscription);
                  return (
                    <li key={nft.id} className="rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <Tip content={<ItemTipContent id={nft.inscription.item} rare={rare} />} className="min-w-0">
                          <span className={`flex min-w-0 items-center gap-2 text-sm ${rare ? "text-gold" : "text-fg"}`}>
                            <ItemGlyph id={nft.inscription.item} className="size-4 shrink-0" />
                            <span className="truncate">{nft.inscription.rare?.name || nft.inscription.label}</span>
                          </span>
                        </Tip>
                        <Button
                          className="h-8 shrink-0 px-2 text-xs"
                          variant="secondary"
                          disabled={busy !== null}
                          onClick={() =>
                            void run(`redeem:${nft.id}`, async () => {
                              await redeemItemNft(oneSatCtx(wallet!), nft.id);
                              redeemApplied(nft.inscription.item, nft.inscription.rare);
                              untrack(nft.id);
                              remember({ kind: "redeem", label: nft.inscription.rare?.name || nft.inscription.label });
                              await refresh();
                            })
                          }
                        >
                          {busy === `redeem:${nft.id}` ? "Burning…" : "Redeem"}
                        </Button>
                      </div>
                      {tracked ? (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-gold">Listed · {tracked.sats} sats</span>
                          <Button
                            className="h-8 px-2 text-xs"
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() =>
                              void run(`cancel:${nft.id}`, async () => {
                                await cancelItemNft(oneSatCtx(wallet!), nft.id);
                                untrack(nft.id);
                                remember({ kind: "cancel", label: tracked.label, sats: tracked.sats });
                                flash(`${tracked.label} is off the market.`);
                                await refresh();
                              })
                            }
                          >
                            {busy === `cancel:${nft.id}` ? "Opening…" : "Cancel listing"}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            placeholder={`≈ ${suggest} sats`}
                            value={prices[nft.id] ?? ""}
                            onChange={(e) => setPrices((p) => ({ ...p, [nft.id]: e.target.value }))}
                            className="h-8 w-24 rounded-[var(--radius-xs)] border border-border bg-bg px-2 text-xs text-fg"
                          />
                          <button
                            type="button"
                            className="text-xs text-muted underline"
                            title="The vault's whisper of a price"
                            onClick={() => setPrices((p) => ({ ...p, [nft.id]: String(suggest) }))}
                          >
                            ≈{suggest}
                          </button>
                          <Button
                            className="h-8 px-2 text-xs"
                            variant="secondary"
                            disabled={busy !== null || !Number(prices[nft.id])}
                            onClick={() =>
                              void run(`sell:${nft.id}`, async () => {
                                const price = Math.floor(Number(prices[nft.id]));
                                const label = nft.inscription.rare?.name || nft.inscription.label;
                                await sellItemNft(oneSatCtx(wallet!), nft.id, price);
                                track({ id: nft.id, label, sats: price, at: Date.now() });
                                remember({ kind: "list", label, sats: price });
                                flash(`${label} is listed for ${price} sats — any 1Sat market can sell it now.`);
                                await refresh();
                              })
                            }
                          >
                            {busy === `sell:${nft.id}` ? "Listing…" : "List for sale"}
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
                {awayListings.map((t) => (
                  <li key={t.id} className="rounded-[var(--radius-xs)] border border-gold/30 bg-surface-2 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm text-fg">{t.label}</span>
                      <span className="shrink-0 text-xs text-gold">Listed · {t.sats} sats</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted">Locked on the orderbook</span>
                      <Button
                        className="h-8 px-2 text-xs"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`cancel:${t.id}`, async () => {
                            await cancelItemNft(oneSatCtx(wallet!), t.id);
                            untrack(t.id);
                            remember({ kind: "cancel", label: t.label, sats: t.sats });
                            flash(`${t.label} is off the market.`);
                            await refresh();
                          })
                        }
                      >
                        {busy === `cancel:${t.id}` ? "Opening…" : "Cancel listing"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {ledger.length > 0 ? (
            <div className="mt-4">
              <p className="font-display text-xs tracking-wider text-muted uppercase">The ledger</p>
              <ul className="mt-2 space-y-1">
                {[...ledger].slice(-8).reverse().map((e, i) => (
                  <li key={`${e.at}:${i}`} className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="min-w-0 truncate">
                      {e.kind === "mint" ? "Minted" : e.kind === "list" ? "Listed" : e.kind === "redeem" ? "Redeemed" : "Took back"}{" "}
                      <span className="text-fg">{e.label}</span>
                      {e.sats ? ` · ${e.sats} sats` : ""}
                    </span>
                    <span className="shrink-0">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-muted">This browser remembers; the chain forgets nothing.</p>
            </div>
          ) : null}

          {error && <p className="mt-3 text-xs text-accent">{error}</p>}
        </>
      )}

      <Button className="mt-3 w-full" variant="secondary" onClick={close}>
        Close
      </Button>
    </div>
  );
}
