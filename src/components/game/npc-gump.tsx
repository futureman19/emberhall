import { Button } from "@/components/ui/button";
import { ItemTipContent } from "@/components/game/item-tip";
import { Tip } from "@/components/ui/tip";
import { ITEM_META, NPC_META, SHOP_STOCK } from "@/game/catalog";
import { useGame } from "@/game/store";

export function NpcGump() {
  const selectedId = useGame((s) => s.selectedId);
  const people = useGame((s) => s.snap.people);
  const gold = useGame((s) => s.snap.gold);
  const vault = useGame((s) => s.snap.player?.vault ?? 0);
  const talk = useGame((s) => s.talk);
  const buy = useGame((s) => s.buy);
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
        <ul className="mt-3 max-h-48 space-y-1 overflow-auto">
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
      )}
      <Button className="mt-3 w-full" variant="ghost" onClick={() => select(null)}>
        Close
      </Button>
    </div>
  );
}
