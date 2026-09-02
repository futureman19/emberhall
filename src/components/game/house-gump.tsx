import { Button } from "@/components/ui/button";
import { ItemTipContent } from "@/components/game/item-tip";
import { ItemGlyph } from "@/components/game/paperdoll";
import { Tip } from "@/components/ui/tip";
import { BUILDING_META, ITEM_META } from "@/game/catalog";
import { isHouseKind } from "@/game/house";
import { useGame } from "@/game/store";
import type { ItemId } from "@/game/types";

function heldItems(bag?: Partial<Record<ItemId, number>>) {
  return (Object.keys(bag ?? {}) as ItemId[]).filter((id) => (bag?.[id] ?? 0) > 0);
}

export function HouseGump() {
  const openHouseId = useGame((s) => s.openHouseId);
  const buildings = useGame((s) => s.snap.buildings);
  const pack = useGame((s) => s.snap.player?.pack);
  const houseItem = useGame((s) => s.houseItem);
  const houseTake = useGame((s) => s.houseTake);
  const ghost = useGame((s) => Boolean(s.snap.player?.ghost));
  const house = buildings.find((b) => b.id === openHouseId);
  if (!house || !isHouseKind(house.kind) || !openHouseId) return null;
  const packHeld = heldItems(pack);
  const boxHeld = heldItems(house.chest);
  return (
    <div
      data-testid="house-chest"
      className="pointer-events-auto absolute top-16 left-3 w-[min(100%-1.5rem,28rem)] rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4"
    >
      <p className="font-display text-sm text-fg">{BUILDING_META[house.kind].label}</p>
      <p className="text-pretty text-xs leading-relaxed text-muted">
        A locked chest. Not as safe as the bank. Yours while you hold the dirt.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
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
                      onClick={() => houseItem(id, pack?.[id] ?? 0)}
                      className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left text-sm text-fg disabled:opacity-50"
                    >
                      <ItemGlyph id={id} />
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
          <p className="font-display text-xs tracking-wider text-muted uppercase">Chest</p>
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
                      onClick={() => houseTake(id, house.chest?.[id] ?? 0)}
                      className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left text-sm text-fg disabled:opacity-50"
                    >
                      <ItemGlyph id={id} />
                      <span className="truncate">{ITEM_META[id].label}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">{house.chest?.[id]}</span>
                    </button>
                  </Tip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Button className="mt-3 w-full" variant="ghost" onClick={() => useGame.setState({ openHouseId: null })}>
        Close
      </Button>
    </div>
  );
}
