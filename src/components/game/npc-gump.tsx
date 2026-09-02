import { Button } from "@/components/ui/button";
import { ItemTipContent } from "@/components/game/item-tip";
import { ItemGlyph } from "@/components/game/paperdoll";
import { Tip } from "@/components/ui/tip";
import { ITEM_META, NPC_META, SHOP_STOCK } from "@/game/catalog";
import { BANK_RANGE } from "@/game/npcs";
import { appraiseRare, rareName } from "@/game/rare";
import { useGame } from "@/game/store";
import type { ItemId } from "@/game/types";

function heldItems(bag?: Partial<Record<ItemId, number>>) {
  return (Object.keys(bag ?? {}) as ItemId[]).filter((id) => (bag?.[id] ?? 0) > 0);
}

/** The provisioner's counter — buy their stock, sell your finds, have wonders appraised. */
function ProvisionerShop() {
  const buy = useGame((s) => s.buy);
  const sell = useGame((s) => s.sell);
  const sellRare = useGame((s) => s.sellRare);
  const pack = useGame((s) => s.snap.player?.pack);
  const rares = useGame((s) => s.snap.player?.rares) ?? [];
  const sellables = (Object.keys(pack ?? {}) as ItemId[]).filter((id) => (pack?.[id] ?? 0) > 0 && ITEM_META[id].sell > 0);
  return (
    <div className="mt-3 max-h-64 space-y-3 overflow-auto">
      <div>
        <p className="font-display text-xs tracking-wider text-muted uppercase">The counter — buy</p>
        <ul className="mt-1 space-y-1">
          {SHOP_STOCK.slice(0, 10).map((id) => (
            <li key={id}>
              <Tip content={<ItemTipContent id={id} />} className="w-full min-w-0">
                <button
                  type="button"
                  onClick={() => buy(id)}
                  className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left text-sm text-fg"
                >
                  <span>{ITEM_META[id].label}</span>
                  <span className="text-muted">{ITEM_META[id].buy}g</span>
                </button>
              </Tip>
            </li>
          ))}
        </ul>
      </div>
      {sellables.length > 0 && (
        <div>
          <p className="font-display text-xs tracking-wider text-muted uppercase">Your pack — sell</p>
          <ul className="mt-1 space-y-1">
            {sellables.map((id) => (
              <li key={id}>
                <Tip content={<ItemTipContent id={id} />} className="w-full min-w-0">
                  <button
                    type="button"
                    onClick={() => sell(id)}
                    className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left text-sm text-fg"
                  >
                    <span>
                      {ITEM_META[id].label} <span className="text-xs text-muted">×{pack?.[id]}</span>
                    </span>
                    <span className="text-gold">{ITEM_META[id].sell}g</span>
                  </button>
                </Tip>
              </li>
            ))}
          </ul>
        </div>
      )}
      {rares.length > 0 && (
        <div>
          <p className="font-display text-xs tracking-wider text-gold uppercase">The loupe — appraise a wonder</p>
          <ul className="mt-1 space-y-1">
            {rares.map((r) => {
              const quote = appraiseRare(r);
              return (
                <li key={r.uid} className="rounded-[var(--radius-xs)] border border-gold/40 bg-surface-2 px-3 py-2">
                  <Tip
                    content={
                      <span className="block space-y-0.5">
                        {quote.lines.map((l, i) => (
                          <span key={i} className="flex justify-between gap-4 text-xs">
                            <span className="text-muted">{l.label}</span>
                            <span className="text-fg">{l.gold}g</span>
                          </span>
                        ))}
                        <span className="mt-1 flex justify-between gap-4 border-t border-border pt-1 text-xs">
                          <span className="text-fg">The offer</span>
                          <span className="text-gold">{quote.total}g</span>
                        </span>
                      </span>
                    }
                    className="w-full min-w-0"
                  >
                    <span className="block truncate text-sm text-gold">{rareName(r)}</span>
                  </Tip>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">offers {quote.total}g</span>
                    <Button className="h-7 px-2 text-[11px]" variant="secondary" onClick={() => sellRare(r.uid)}>
                      Take the coin
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** UO bank box — gold speech plus the container, opened at the banker. */
function BankBox() {
  const gold = useGame((s) => s.snap.gold);
  const vault = useGame((s) => s.snap.player?.vault ?? 0);
  const pack = useGame((s) => s.snap.player?.pack);
  const chest = useGame((s) => s.snap.player?.chest);
  const bankGold = useGame((s) => s.bankGold);
  const withdraw = useGame((s) => s.withdraw);
  const bankItem = useGame((s) => s.bankItem);
  const unbankItem = useGame((s) => s.unbankItem);
  const ghost = useGame((s) => Boolean(s.snap.player?.ghost));
  const packHeld = heldItems(pack);
  const boxHeld = heldItems(chest);
  return (
    <div className="mt-3 space-y-3" data-testid="bank-box">
      <p className="text-pretty text-xs leading-relaxed text-muted">
        The box is yours. Gold and goods left here stay when you die. Walk away and it closes.
      </p>
      <p className="font-display text-xs tracking-wider text-muted uppercase">
        Purse {gold} · Box {vault}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={ghost} onClick={() => bankGold()}>
          Bank gold
        </Button>
        <Button variant="secondary" disabled={ghost || vault < 1} onClick={() => withdraw(vault)}>
          Take all
        </Button>
        <Button variant="secondary" disabled={ghost || vault < 10} onClick={() => withdraw(Math.min(10, vault))}>
          Take 10
        </Button>
        <Button variant="secondary" disabled={ghost || vault < 100} onClick={() => withdraw(Math.min(100, vault))}>
          Take 100
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-display text-xs tracking-wider text-muted uppercase">Pack</p>
          {packHeld.length === 0 ? (
            <p className="mt-1 text-xs text-muted">Nothing to put in.</p>
          ) : (
            <ul className="mt-1 max-h-48 space-y-1 overflow-auto">
              {packHeld.map((id) => (
                <li key={id}>
                  <Tip content={<ItemTipContent id={id} />} className="w-full min-w-0">
                    <button
                      type="button"
                      disabled={ghost}
                      onClick={() => bankItem(id, pack?.[id] ?? 0)}
                      className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left text-sm text-fg disabled:opacity-50"
                    >
                      <ItemGlyph id={id} className="shrink-0" />
                      <span className="truncate">{ITEM_META[id].label}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">{pack?.[id]}</span>
                    </button>
                  </Tip>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="font-display text-xs tracking-wider text-muted uppercase">Box</p>
          {boxHeld.length === 0 ? (
            <p className="mt-1 text-xs text-muted">Empty.</p>
          ) : (
            <ul className="mt-1 max-h-48 space-y-1 overflow-auto">
              {boxHeld.map((id) => (
                <li key={id}>
                  <Tip content={<ItemTipContent id={id} />} className="w-full min-w-0">
                    <button
                      type="button"
                      disabled={ghost}
                      onClick={() => unbankItem(id, chest?.[id] ?? 0)}
                      className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left text-sm text-fg disabled:opacity-50"
                    >
                      <ItemGlyph id={id} className="shrink-0" />
                      <span className="truncate">{ITEM_META[id].label}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">{chest?.[id]}</span>
                    </button>
                  </Tip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function NpcGump() {
  const selectedId = useGame((s) => s.selectedId);
  const people = useGame((s) => s.snap.people);
  const youX = useGame((s) => s.snap.youX);
  const youZ = useGame((s) => s.snap.youZ);
  const talk = useGame((s) => s.talk);
  const select = useGame((s) => s.select);
  const ghost = useGame((s) => Boolean(s.snap.player?.ghost));
  const p = people.find((x) => x.id === selectedId);
  if (!p?.role) return null;
  const close = Math.hypot(youX - p.x, youZ - p.z) <= BANK_RANGE;
  return (
    <div
      className={
        p.role === "banker"
          ? "pointer-events-auto absolute top-16 left-3 w-[min(100%-1.5rem,28rem)] rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4"
          : "pointer-events-auto absolute top-16 left-3 w-[min(100%-1.5rem,20rem)] rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4"
      }
    >
      <p className="font-display text-sm text-fg">{p.name}</p>
      <p className="text-xs text-muted">{NPC_META[p.role].label}</p>
      <Button
        className="mt-3 w-full"
        variant="secondary"
        disabled={ghost && p.role === "healer" && !close}
        onClick={() => talk(p.id)}
      >
        {ghost && p.role === "healer" ? (close ? "Return me" : "Walking closer…") : "Talk"}
      </Button>
      {ghost && p.role === "healer" && !close && (
        <p className="mt-2 text-pretty text-xs text-muted">Ione must be within reach to return you.</p>
      )}
      {p.role === "banker" && (close ? <BankBox /> : <p className="mt-3 text-pretty text-xs text-muted">Walk closer to open the box.</p>)}
      {p.role === "provisioner" && <ProvisionerShop />}
      <Button className="mt-3 w-full" variant="ghost" onClick={() => select(null)}>
        Close
      </Button>
    </div>
  );
}
