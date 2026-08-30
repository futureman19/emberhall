import { Button } from "@/components/ui/button";
import { ItemTipContent } from "@/components/game/item-tip";
import { Tip } from "@/components/ui/tip";
import { ITEM_META, NPC_META, SHOP_STOCK } from "@/game/catalog";
import { appraiseRare, rareName } from "@/game/rare";
import { useGame } from "@/game/store";
import type { ItemId } from "@/game/types";

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

export function NpcGump() {
  const selectedId = useGame((s) => s.selectedId);
  const people = useGame((s) => s.snap.people);
  const gold = useGame((s) => s.snap.gold);
  const vault = useGame((s) => s.snap.player?.vault ?? 0);
  const talk = useGame((s) => s.talk);
  const deposit = useGame((s) => s.deposit);
  const withdraw = useGame((s) => s.withdraw);
  const select = useGame((s) => s.select);
  const ghost = useGame((s) => Boolean(s.snap.player?.ghost));
  const p = people.find((x) => x.id === selectedId);
  if (!p?.role) return null;
  return (
    <div className="pointer-events-auto absolute top-16 left-3 w-[min(100%-1.5rem,20rem)] rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4">
      <p className="font-display text-sm text-fg">{p.name}</p>
      <p className="text-xs text-muted">{NPC_META[p.role].label}</p>
      <Button className="mt-3 w-full" variant="secondary" onClick={() => talk(p.id)}>
        {ghost && p.role === "healer" ? "Return me" : "Talk"}
      </Button>
      {p.role === "banker" && (
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" variant="secondary" onClick={() => deposit(Math.min(10, gold))}>
            Deposit 10
          </Button>
          <Button className="flex-1" variant="secondary" onClick={() => withdraw(Math.min(10, vault))}>
            Take 10
          </Button>
        </div>
      )}
      {p.role === "provisioner" && (
        <ProvisionerShop />
      )}
      <Button className="mt-3 w-full" variant="ghost" onClick={() => select(null)}>
        Close
      </Button>
    </div>
  );
}
