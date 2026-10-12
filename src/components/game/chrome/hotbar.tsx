import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { TOUCH_HOLD_MS } from "@/game/touch-hold";
import { ITEM_META } from "@/game/catalog";
import type { ItemId } from "@/game/types";
import { ItemIcon } from "@/components/game/item-icon";
import { cn } from "@/lib/utils";
import { HOTBAR_SLOTS, dockStorage, loadHotbar, saveHotbar, subscribeHotbar, unpinItem } from "./hotbar-dock";

/**
 * The quick bar — Direland's one good HUD idea, fitted to the vale's chrome.
 * Pin tools, weapons and flasks from the pack's action bar; tap a slot to
 * hold/wear/drink it without opening the drawer. A slot whose item ran out
 * greys but stays — the bar remembers what you wanted handy. Press-and-hold
 * (or right-click) a slot to let it go.
 */
export function Hotbar() {
  const phase = useGame((s) => s.phase);
  const snap = useGame((s) => s.snap);
  const equip = useGame((s) => s.equip);
  const [ids, setIds] = useState<ItemId[]>(() => {
    const storage = dockStorage();
    return storage ? loadHotbar(storage) : [];
  });
  useEffect(() => subscribeHotbar(() => {
    const storage = dockStorage();
    if (storage) setIds(loadHotbar(storage));
  }), []);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );
  if (phase !== "playing" || ids.length === 0) return null;
  const pack = snap.player?.pack ?? {};
  const wear = snap.player?.wear ?? {};
  const unpin = (id: ItemId) => {
    const storage = dockStorage();
    if (storage) saveHotbar(storage, unpinItem(ids, id));
  };
  const slots: (ItemId | null)[] = [...ids, ...Array<null>(HOTBAR_SLOTS - ids.length).fill(null)];
  return (
    <div
      data-testid="hotbar"
      className="hud-glass pointer-events-auto flex gap-1 rounded-[var(--radius-sm)] p-1"
    >
      {slots.map((id, i) => {
        if (!id) {
          return <span key={`empty-${i}`} className="size-11 rounded-[var(--radius-xs)] border border-dashed border-border/60 bg-surface/40" aria-hidden />;
        }
        const count = pack[id] ?? 0;
        const inHand = wear.main === id || wear.off === id;
        // In-hand stays live (tap puts it away, hold unpins). Only a slot
        // whose item is gone entirely greys out — and even then it must keep
        // taking pointer events, or you could never hold-to-unpin it.
        const usable = count > 0 || inHand;
        return (
          <button
            key={id}
            type="button"
            aria-label={`${ITEM_META[id].label} (quick slot)`}
            aria-disabled={!usable}
            title="Tap to use — hold to unpin"
            onClick={() => {
              if (usable) equip(id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              unpin(id);
            }}
            onPointerDown={() => {
              holdTimer.current = setTimeout(() => unpin(id), TOUCH_HOLD_MS);
            }}
            onPointerUp={() => {
              if (holdTimer.current) clearTimeout(holdTimer.current);
            }}
            onPointerCancel={() => {
              if (holdTimer.current) clearTimeout(holdTimer.current);
            }}
            className={cn(
              "relative grid size-11 place-items-center rounded-[var(--radius-xs)] border bg-surface-2 text-fg",
              inHand ? "border-gold" : "border-border",
              !usable && "opacity-40",
            )}
          >
            <ItemIcon id={id} className="size-7" />
            <span className="absolute right-0.5 bottom-0 text-[10px] text-muted tabular-nums">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
