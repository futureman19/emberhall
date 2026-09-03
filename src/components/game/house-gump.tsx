import { Button } from "@/components/ui/button";
import { ItemTipContent } from "@/components/game/item-tip";
import { ItemGlyph } from "@/components/game/paperdoll";
import { Tip } from "@/components/ui/tip";
import { BUILDING_META, ITEM_META, SECONDS_PER_HOUR } from "@/game/catalog";
import { isHouseKind } from "@/game/house";
import { useGame } from "@/game/store";
import { getWorld } from "@/game/live";
import { PERSONAL_ACTION_DURATION, getPersonalActionFx } from "@/game/personal-action-animation";
import type { ItemId } from "@/game/types";

function heldItems(bag?: Partial<Record<ItemId, number>>) {
  return (Object.keys(bag ?? {}) as ItemId[]).filter((id) => (bag?.[id] ?? 0) > 0);
}

function BagTransferIcon() {
  return <span aria-hidden className="relative h-8 w-8 rounded-b-xl border-2 border-white bg-sky-200"><span className="absolute -top-1 left-1/2 h-2 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-sky-300" /></span>;
}

function ChestTransferIcon() {
  return <span aria-hidden className="relative h-8 w-10 rounded-t-xl rounded-b-sm border-2 border-gold bg-amber-900"><span className="absolute top-3 left-0 h-0.5 w-full bg-gold" /><span className="absolute top-1/2 left-1/2 h-2.5 w-1.5 -translate-x-1/2 bg-gold" /></span>;
}

export function HouseGump() {
  const openHouseId = useGame((s) => s.openHouseId);
  const buildings = useGame((s) => s.snap.buildings);
  const pack = useGame((s) => s.snap.player?.pack);
  const houseItem = useGame((s) => s.houseItem);
  const houseTake = useGame((s) => s.houseTake);
  const ghost = useGame((s) => Boolean(s.snap.player?.ghost));
  const hour = useGame((s) => s.snap.hour);
  const house = buildings.find((b) => b.id === openHouseId);
  if (!house || !isHouseKind(house.kind) || !openHouseId) return null;
  const packHeld = heldItems(pack);
  const boxHeld = heldItems(house.chest);
  const transfer = getPersonalActionFx(getWorld());
  const transferAge = transfer ? (hour - transfer.at) * SECONDS_PER_HOUR : Infinity;
  const chestTransfer = transfer?.kind === "chest" && transfer.buildingId === house.id && transferAge >= 0 && transferAge < PERSONAL_ACTION_DURATION ? transfer : null;
  return (
    <div
      data-testid="house-chest"
      className="pointer-events-auto absolute top-16 left-3 w-[min(100%-1.5rem,28rem)] rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4"
    >
      <p className="font-display text-sm text-fg">{BUILDING_META[house.kind].label}</p>
      <p className="text-pretty text-xs leading-relaxed text-muted">
        A locked chest. Not as safe as the bank. Yours while you hold the dirt.
      </p>
      {chestTransfer ? (
        <div key={`${chestTransfer.at}:${chestTransfer.direction}`} className="pointer-events-none mt-3 flex items-center justify-center gap-3 rounded-[var(--radius-md)] border-2 border-gold bg-amber-950 px-3 py-3 shadow-lg" data-testid="house-transfer-fx">
          <span className="flex flex-col items-center gap-1 text-[9px] font-bold tracking-wider text-fg">
            <BagTransferIcon />
            PACK
          </span>
          <span className="flex items-center gap-1 text-xl font-bold text-gold">
            {chestTransfer.direction === "in" ? "››" : "‹‹"}
            <span className="flex flex-col items-center gap-1 text-[9px] tracking-wider text-fg">
              <ItemGlyph id={chestTransfer.item} className="size-7 animate-pulse border-2 border-white" />
              {ITEM_META[chestTransfer.item].label.toUpperCase()}
            </span>
            {chestTransfer.direction === "in" ? "››" : "‹‹"}
          </span>
          <span className="flex flex-col items-center gap-1 text-[9px] font-bold tracking-wider text-fg">
            <ChestTransferIcon />
            CHEST
          </span>
        </div>
      ) : null}
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
