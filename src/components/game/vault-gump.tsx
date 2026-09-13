import { useWallet } from "@1sat/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createReadEpoch, isLedgerEntry, isTrackedListing, loadWalletRecords, walletRecordKey, walletScope, walletSessionKey } from "@/chain/wallet-read-state";
import { Button } from "@/components/ui/button";
import { ItemGlyph } from "@/components/game/paperdoll";
import { ITEM_META } from "@/game/catalog";
import { getWorld } from "@/game/live";
import { preflightItemRedeem } from "@/chain/vault-preflight";
import { useGame } from "@/game/store";
import type { ItemId, RareItem } from "@/game/types";
import {
  artifactLabel,
  listEmberhallNfts,
  mintCharacterLookNft,
  mintItemNft,
  mintPartNft,
  mintRareNft,
  oneSatCtx,
  redeemItemNft,
  sellItemNft,
  cancelItemNft,
  type EmberhallNft,
  type LookNft,
  type PartNft,
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
import { latestCharacterLook, previewRedeemPart } from "@/game/chain-artifacts";
import { listParts } from "@/game/look/parts";

// History is scoped only to a validated provider identity; legacy keys stay untouched.

/** A rare tooltip needs a RareItem shape — rebuild it from the inscription. */
function rareFromInscription(nft: VaultNft): RareItem | undefined {
  const r = nft.inscription.rare;
  if (!r) return undefined;
  return { uid: nft.origin, base: nft.inscription.item, affixes: r.affixes, maker: r.maker, seed: nft.inscription.world, hour: nft.inscription.hour };
}

/**
 * The Vault — mint pack items into 1Sat ordinal NFTs, trade them for real
 * BSV on the global orderbook, and redeem them back into the vale.
 * Keys never leave the player's wallet; every rite is one signed action.
 */
export function VaultGump() {
  const open = useGame((s) => s.openVault);
  const walletState = useWallet();
  const { wallet, identityKey, status } = walletState;
  const scope = status === "connected" ? walletScope(identityKey) : null;
  const session = walletSessionKey(wallet, scope, status);
  if (!open) return null;
  // Remount before painting, so no old holdings, prices or history cross accounts.
  return <VaultInner key={session} walletState={walletState} scope={scope} />;
}

function VaultInner({ walletState, scope }: { walletState: ReturnType<typeof useWallet>; scope: string | null }) {
  const close = useGame((s) => s.closeVault);
  const pack = useGame((s) => s.snap.player?.pack);
  const self = useGame((s) => s.snap.people.find(({ isPlayer }) => isPlayer));
  const rares = useGame((s) => s.snap.player?.rares) ?? [];
  const mintApplied = useGame((s) => s.mintApplied);
  const mintRareApplied = useGame((s) => s.mintRareApplied);
  const redeemApplied = useGame((s) => s.redeemApplied);
  const restoreLookApplied = useGame((s) => s.restoreLookApplied);
  const mintPartApplied = useGame((s) => s.mintPartApplied);
  const redeemPartApplied = useGame((s) => s.redeemPartApplied);
  const togglePartWorn = useGame((s) => s.togglePartWorn);
  const flash = useGame((s) => s.flash);
  const { wallet, status, connect, disconnect, error: walletError } = walletState;

  const [artifacts, setArtifacts] = useState<EmberhallNft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [listings, setListings] = useState<TrackedListing[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [readState, setReadState] = useState<"loading" | "complete" | "unavailable">("loading");
  const [readError, setReadError] = useState<string | null>(null);
  const ledgerRef = useRef<LedgerEntry[]>([]);
  const listingsRef = useRef<TrackedListing[]>([]);
  const alive = useRef(true);
  const actionBusy = useRef(false);
  const [reads] = useState(createReadEpoch);
  const connected = status === "connected" && wallet;
  const actionsDisabled = busy !== null || !scope || readState !== "complete";

  useLayoutEffect(() => {
    alive.current = true;
    return () => { alive.current = false; reads.invalidate(); };
  }, [reads]);

  useEffect(() => {
    if (!scope) return;
    try {
      const history = loadWalletRecords(localStorage, scope, "ledger", isLedgerEntry);
      const tracked = loadWalletRecords(localStorage, scope, "listings", isTrackedListing);
      ledgerRef.current = history;
      listingsRef.current = tracked;
      setLedger(history);
      setListings(tracked);
    } catch {
      setRecordError("This account's browser history could not be read. It was not adopted or repaired.");
    }
  }, [scope]);

  const persist = useCallback((kind: "ledger" | "listings", value: unknown) => {
    if (!scope || !alive.current) return;
    try {
      localStorage.setItem(walletRecordKey(scope, kind), JSON.stringify(value));
    } catch {
      setRecordError("Wallet activity occurred, but this browser could not save its display history. This is not a transaction journal.");
    }
  }, [scope]);

  const remember = useCallback((e: Omit<LedgerEntry, "at">) => {
    if (!scope || !alive.current) return;
    const next = appendLedger(ledgerRef.current, { ...e, at: Date.now() });
    ledgerRef.current = next;
    setLedger(next);
    persist("ledger", next);
  }, [scope, persist]);

  const track = useCallback((t: TrackedListing) => {
    if (!scope || !alive.current) return;
    const next = trackListing(listingsRef.current, t);
    listingsRef.current = next;
    setListings(next);
    persist("listings", next);
  }, [scope, persist]);

  const untrack = useCallback((id: string) => {
    if (!scope || !alive.current) return;
    const next = untrackListing(listingsRef.current, id);
    listingsRef.current = next;
    setListings(next);
    persist("listings", next);
  }, [scope, persist]);

  const refresh = useCallback(async () => {
    if (!wallet || !scope || !alive.current) return;
    const ticket = reads.begin();
    setReadError(null);
    setReadState("loading");
    try {
      const next = await listEmberhallNfts(oneSatCtx(wallet), { signal: ticket.signal });
      if (!alive.current || !ticket.current()) return;
      setArtifacts(next);
      setReadState("complete");
    } catch (e) {
      if (!alive.current || !ticket.current()) return;
      setReadState("unavailable");
      setReadError(e instanceof Error ? e.message : "The chain did not answer.");
    }
  }, [wallet, scope, reads]);

  useEffect(() => {
    if (connected) void refresh();
    return () => reads.invalidate();
  }, [connected, refresh, reads]);

  async function run(label: string, fn: (assertCurrent: () => void) => Promise<void>) {
    if (actionBusy.current || !alive.current || (label !== "connect" && actionsDisabled)) return;
    actionBusy.current = true;
    setBusy(label);
    setError(null);
    const startedWorld = getWorld();
    const assertCurrent = () => {
      if (!alive.current || getWorld() !== startedWorld) throw new Error("Wallet or world changed; local completion was not applied. Chain recovery requires reconciliation.");
    };
    try {
      await fn(assertCurrent);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "The rite failed.");
    } finally {
      actionBusy.current = false;
      if (alive.current) setBusy(null);
    }
  }

  const packItems = (Object.entries(pack ?? {}) as [ItemId, number][]).filter(([, n]) => n > 0);
  const nfts = (artifacts ?? []).filter((entry): entry is VaultNft => entry.inscription.type === "item");
  const lookNfts = (artifacts ?? []).filter((entry): entry is LookNft => entry.inscription.type === "look");
  const partNfts = (artifacts ?? []).filter((entry): entry is PartNft => entry.inscription.type === "part");
  const latestLook = latestCharacterLook(lookNfts);
  const localParts = listParts();
  const walletOrigins = new Set((artifacts ?? []).map((n) => n.origin));
  /** Listings we remember that the wallet no longer holds — location unknown, not presumed sold. */
  const awayListings = readState === "complete" ? listings.filter((t) => !walletOrigins.has(t.id)) : [];
  const suggestFor = (inscription: ItemInscription) => suggestSats(inscription);

  return (
    <div data-testid="vault-panel" className="pointer-events-auto absolute top-16 right-3 z-20 max-h-[calc(100dvh-5rem)] w-[min(100%-1.5rem,22rem)] touch-pan-y overflow-y-auto overscroll-contain rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4 sm:right-4">
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
          <div className="mt-3 flex gap-3 text-xs">
            <button type="button" className="underline" disabled={busy !== null} onClick={disconnect}>Disconnect wallet</button>
            <button type="button" className="underline" disabled={busy !== null || !scope} onClick={() => {
              if (!scope) return;
              try {
                localStorage.removeItem(walletRecordKey(scope, "ledger"));
                localStorage.removeItem(walletRecordKey(scope, "listings"));
                ledgerRef.current = [];
                listingsRef.current = [];
                setLedger([]);
                setListings([]);
                setRecordError(null);
              } catch { setRecordError("This account's browser history could not be cleared."); }
            }}>Clear this account's history</button>
          </div>
          <p className="mt-2 text-xs text-muted">Older unscoped browser history is not assigned to this account. Clearing history does not change the chain or your game save.</p>
          {!scope && <p role="alert" className="mt-2 text-xs text-accent">The wallet has not supplied a valid public identity. Reconnect before reading holdings or using chain actions.</p>}
          {readState !== "complete" && artifacts !== null && <p role="status" className="mt-2 text-xs text-accent">Showing this account's last successful read. Holdings may have changed; chain actions are disabled until refresh succeeds.</p>}
          {readError && <p role="alert" className="mt-2 text-xs text-accent">Holdings unavailable: {readError}</p>}
          {recordError && <p role="alert" className="mt-2 text-xs text-accent">{recordError}</p>}
          {self ? (
            <div className="mt-4" data-testid="vault-look-section">
              <p className="font-display text-xs tracking-wider text-gold uppercase">Your person — the chain remembers</p>
              <div className="mt-2 rounded-[var(--radius-xs)] border border-gold/40 bg-surface-2 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-sm leading-snug text-fg" title={`${self.name} · ${self.cls}${latestLook ? ` · revision ${latestLook.inscription.revision}` : ""}`}>
                    {self.name} · {self.cls}{latestLook ? ` · revision ${latestLook.inscription.revision}` : ""}
                  </span>
                  <Button
                    className="h-8 shrink-0 px-2 text-xs"
                    variant="secondary"
                    disabled={actionsDisabled}
                    data-testid="vault-mint-look"
                    onClick={() =>
                      void run("mint:look", async (assertCurrent) => {
                        await mintCharacterLookNft(oneSatCtx(wallet!), getWorld(), latestLook ?? undefined);
                        assertCurrent();
                        remember({ kind: "mint", label: `${self.name}'s look` });
                        flash(latestLook ? "A new reflection succeeds the old on chain." : "Your reflection now rides the chain.");
                        await refresh();
                      })
                    }
                  >
                    {busy === "mint:look" ? "Inscribing…" : latestLook ? "Inscribe new revision" : "Inscribe person"}
                  </Button>
                </div>
                {latestLook ? (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">Wallet: {latestLook.inscription.name} · {latestLook.inscription.calling}</span>
                    <Button
                      className="h-8 px-2 text-xs"
                      variant="secondary"
                      disabled={actionsDisabled}
                      data-testid="vault-restore-look"
                      onClick={() => {
                        restoreLookApplied(latestLook.inscription);
                        remember({ kind: "redeem", label: `${latestLook.inscription.name}'s look` });
                      }}
                    >
                      Restore from chain
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">Your local face stays free. Inscribing gives this wallet a portable copy.</p>
                )}
              </div>
            </div>
          ) : null}

          {localParts.length > 0 ? (
            <div className="mt-4" data-testid="vault-local-parts">
              <p className="font-display text-xs tracking-wider text-gold uppercase">Sculptor's bench — mint a part</p>
              <ul className="mt-2 space-y-1">
                {localParts.map((part) => (
                  <li key={part.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-xs)] border border-gold/30 bg-surface-2 px-3 py-2">
                    <span className="min-w-0 text-sm leading-snug text-fg" title={`${part.name} · ${part.slot} · ${part.rarity ?? "common"}`}>
                      {part.name} · {part.slot} · {part.rarity ?? "common"}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <Button
                        className="h-8 px-2 text-xs"
                        variant="secondary"
                        disabled={actionsDisabled}
                        data-testid={`vault-wear-part-${part.id}`}
                        onClick={() => togglePartWorn(part.id)}
                      >
                        {self?.look?.parts?.includes(part.id) ? "Remove" : "Wear"}
                      </Button>
                      <Button
                        className="h-8 px-2 text-xs"
                        variant="secondary"
                        disabled={actionsDisabled}
                        data-testid={`vault-mint-part-${part.id}`}
                        onClick={() =>
                          void run(`mint:part:${part.id}`, async (assertCurrent) => {
                            await mintPartNft(oneSatCtx(wallet!), getWorld(), part);
                            assertCurrent();
                            mintPartApplied(part.id);
                            remember({ kind: "mint", label: part.name });
                            await refresh();
                          })
                        }
                      >
                        {busy === `mint:part:${part.id}` ? "Minting…" : "Mint part"}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
                      disabled={actionsDisabled}
                      onClick={() =>
                        void run(`mint:${id}`, async (assertCurrent) => {
                          const w = getWorld();
                          await mintItemNft(oneSatCtx(wallet!), w, id);
                          assertCurrent();
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
                      disabled={actionsDisabled}
                      onClick={() =>
                        void run(`mint:${r.uid}`, async (assertCurrent) => {
                          const w = getWorld();
                          await mintRareNft(oneSatCtx(wallet!), w, r);
                          assertCurrent();
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

          {partNfts.length > 0 ? (
            <div className="mt-4" data-testid="vault-chain-parts">
              <p className="font-display text-xs tracking-wider text-gold uppercase">Sculpted parts — yours on chain</p>
              <ul className="mt-2 space-y-1">
                {partNfts.map((nft) => {
                  const label = artifactLabel(nft);
                  const tracked = nft.listed ? { id: nft.origin, label, sats: nft.priceSats!, at: 0 } : undefined;
                  return (
                    <li key={nft.origin} className="rounded-[var(--radius-xs)] border border-gold/30 bg-surface-2 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm text-fg">
                          {nft.inscription.part.name} · {nft.inscription.part.slot} · {nft.inscription.part.rarity}
                        </span>
                        {!nft.listed ? (
                          <Button
                            className="h-8 shrink-0 px-2 text-xs"
                            variant="secondary"
                            disabled={actionsDisabled}
                            data-testid={`vault-redeem-part-${nft.inscription.part.id}`}
                            onClick={() =>
                              void run(`redeem:${nft.id}`, async (assertCurrent) => {
                                const blocked = previewRedeemPart(nft.inscription, nft.origin);
                                if (blocked) throw new Error(blocked);
                                await redeemItemNft(oneSatCtx(wallet!), nft.id);
                                assertCurrent();
                                redeemPartApplied(nft.inscription, nft.origin);
                                untrack(nft.origin);
                                remember({ kind: "redeem", label });
                                await refresh();
                              })
                            }
                          >
                            {busy === `redeem:${nft.id}` ? "Burning…" : "Redeem to bench"}
                          </Button>
                        ) : null}
                      </div>
                      {tracked ? (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-gold">Listed · {tracked.sats} sats</span>
                          <Button
                            className="h-8 px-2 text-xs"
                            variant="secondary"
                            disabled={actionsDisabled}
                            onClick={() =>
                              void run(`cancel:${nft.id}`, async (assertCurrent) => {
                                await cancelItemNft(oneSatCtx(wallet!), nft.id);
                                assertCurrent();
                                untrack(nft.origin);
                                remember({ kind: "cancel", label, sats: tracked.sats });
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
                            placeholder="sats"
                            value={prices[nft.origin] ?? ""}
                            onChange={(event) => setPrices((current) => ({ ...current, [nft.origin]: event.target.value }))}
                            className="h-8 w-24 rounded-[var(--radius-xs)] border border-border bg-bg px-2 text-xs text-fg"
                          />
                          <Button
                            className="h-8 px-2 text-xs"
                            variant="secondary"
                            disabled={actionsDisabled || !Number(prices[nft.origin])}
                            data-testid={`vault-list-part-${nft.inscription.part.id}`}
                            onClick={() =>
                              void run(`sell:${nft.id}`, async (assertCurrent) => {
                                const price = Math.floor(Number(prices[nft.origin]));
                                await sellItemNft(oneSatCtx(wallet!), nft.id, price);
                                assertCurrent();
                                track({ id: nft.origin, label, sats: price, at: Date.now() });
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
              </ul>
            </div>
          ) : null}

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-xs tracking-wider text-muted uppercase">On the chain — yours</p>
              <button type="button" className="text-xs text-muted underline" disabled={busy !== null || !scope} onClick={() => void refresh()}>
                              {readState === "loading" ? "Restart read" : readState === "unavailable" ? "Retry" : "Refresh"}
              </button>
            </div>
            {artifacts === null ? (
              <p className="mt-1 text-xs text-muted">{!scope ? "Wallet identity unavailable." : readState === "unavailable" ? "Holdings could not be read. Retry; this is not an empty inventory." : "Reading the chain…"}</p>
            ) : readState === "complete" && nfts.length === 0 && awayListings.length === 0 ? (
              <p className="mt-1 text-xs text-muted">No Emberhall items in this wallet yet. Mint one above.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {nfts.map((nft) => {
                  const label = nft.inscription.rare?.name || nft.inscription.label;
                  const tracked = nft.listed ? { id: nft.origin, label, sats: nft.priceSats!, at: 0 } : undefined;
                  const rare = rareFromInscription(nft);
                  const suggest = suggestFor(nft.inscription);
                  return (
                    <li key={nft.origin} className="rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <Tip content={<ItemTipContent id={nft.inscription.item} rare={rare} />} className="min-w-0">
                          <span className={`flex min-w-0 items-center gap-2 text-sm ${rare ? "text-gold" : "text-fg"}`}>
                            <ItemGlyph id={nft.inscription.item} className="size-4 shrink-0" />
                            <span className="truncate">{nft.inscription.rare?.name || nft.inscription.label}</span>
                          </span>
                        </Tip>
                        {!nft.listed ? (
                          <Button
                            className="h-8 shrink-0 px-2 text-xs"
                            variant="secondary"
                            disabled={actionsDisabled}
                            onClick={() =>
                              void run(`redeem:${nft.id}`, async (assertCurrent) => {
                                preflightItemRedeem(getWorld(), nft.inscription);
                                if (!useGame.getState().saveNow()) throw new Error("Save your current progress before redeeming.");
                                await redeemItemNft(oneSatCtx(wallet!), nft.id);
                                assertCurrent();
                                redeemApplied(nft.inscription.item, nft.inscription.rare);
                                untrack(nft.origin);
                                remember({ kind: "redeem", label });
                                await refresh();
                              })
                            }
                          >
                            {busy === `redeem:${nft.id}` ? "Burning…" : "Redeem"}
                          </Button>
                        ) : null}
                      </div>
                      {tracked ? (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-gold">Listed · {tracked.sats} sats</span>
                          <Button
                            className="h-8 px-2 text-xs"
                            variant="secondary"
                            disabled={actionsDisabled}
                            onClick={() =>
                              void run(`cancel:${nft.id}`, async (assertCurrent) => {
                                await cancelItemNft(oneSatCtx(wallet!), nft.id);
                                assertCurrent();
                                untrack(nft.origin);
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
                            value={prices[nft.origin] ?? ""}
                            onChange={(e) => setPrices((p) => ({ ...p, [nft.origin]: e.target.value }))}
                            className="h-8 w-24 rounded-[var(--radius-xs)] border border-border bg-bg px-2 text-xs text-fg"
                          />
                          <button
                            type="button"
                            className="text-xs text-muted underline"
                            title="The vault's whisper of a price"
                            onClick={() => setPrices((p) => ({ ...p, [nft.origin]: String(suggest) }))}
                          >
                            ≈{suggest}
                          </button>
                          <Button
                            className="h-8 px-2 text-xs"
                            variant="secondary"
                            disabled={actionsDisabled || !Number(prices[nft.origin])}
                            onClick={() =>
                              void run(`sell:${nft.id}`, async (assertCurrent) => {
                                const price = Math.floor(Number(prices[nft.origin]));
                                await sellItemNft(oneSatCtx(wallet!), nft.id, price);
                                assertCurrent();
                                track({ id: nft.origin, label, sats: price, at: Date.now() });
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
                    <p className="mt-2 text-xs text-muted">No longer in this wallet. Refresh after any market or wallet transfer settles.</p>
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
