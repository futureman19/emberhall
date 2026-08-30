import { useWallet } from "@1sat/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemGlyph } from "@/components/game/paperdoll";
import { ITEM_META } from "@/game/catalog";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import type { ItemId } from "@/game/types";
import { listVaultNfts, mintItemNft, oneSatCtx, redeemItemNft, sellItemNft, type VaultNft } from "@/chain/oneSat";

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
  const mintApplied = useGame((s) => s.mintApplied);
  const redeemApplied = useGame((s) => s.redeemApplied);
  const flash = useGame((s) => s.flash);
  const { wallet, status, connect, error: walletError } = useWallet();

  const [nfts, setNfts] = useState<VaultNft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const connected = status === "connected" && wallet;

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
                    <span className="flex items-center gap-2 text-sm text-fg">
                      <ItemGlyph id={id} className="size-4" />
                      {ITEM_META[id].label}
                      <span className="text-xs text-muted">×{n}</span>
                    </span>
                    <Button
                      className="h-8 px-2 text-xs"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`mint:${id}`, async () => {
                          const w = getWorld();
                          await mintItemNft(oneSatCtx(wallet!), w, id);
                          mintApplied(id);
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

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-xs tracking-wider text-muted uppercase">On the chain — yours</p>
              <button type="button" className="text-xs text-muted underline" disabled={busy !== null} onClick={() => void refresh()}>
                {nfts === null ? "Loading…" : "Refresh"}
              </button>
            </div>
            {nfts === null ? (
              <p className="mt-1 text-xs text-muted">Reading the chain…</p>
            ) : nfts.length === 0 ? (
              <p className="mt-1 text-xs text-muted">No Emberhall items in this wallet yet. Mint one above.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {nfts.map((nft) => (
                  <li key={nft.id} className="rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm text-fg">
                        <ItemGlyph id={nft.inscription.item} className="size-4" />
                        {nft.inscription.label}
                      </span>
                      <Button
                        className="h-8 px-2 text-xs"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`redeem:${nft.id}`, async () => {
                            await redeemItemNft(oneSatCtx(wallet!), nft.id);
                            redeemApplied(nft.inscription.item);
                            await refresh();
                          })
                        }
                      >
                        {busy === `redeem:${nft.id}` ? "Burning…" : "Redeem"}
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="sats"
                        value={prices[nft.id] ?? ""}
                        onChange={(e) => setPrices((p) => ({ ...p, [nft.id]: e.target.value }))}
                        className="h-8 w-24 rounded-[var(--radius-xs)] border border-border bg-bg px-2 text-xs text-fg"
                      />
                      <Button
                        className="h-8 px-2 text-xs"
                        variant="secondary"
                        disabled={busy !== null || !Number(prices[nft.id])}
                        onClick={() =>
                          void run(`sell:${nft.id}`, async () => {
                            const price = Math.floor(Number(prices[nft.id]));
                            await sellItemNft(oneSatCtx(wallet!), nft.id, price);
                            flash(`${nft.inscription.label} is listed for ${price} sats — any 1Sat market can sell it now.`);
                            await refresh();
                          })
                        }
                      >
                        {busy === `sell:${nft.id}` ? "Listing…" : "List for sale"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <p className="mt-3 text-xs text-accent">{error}</p>}
        </>
      )}

      <Button className="mt-3 w-full" variant="secondary" onClick={close}>
        Close
      </Button>
    </div>
  );
}
