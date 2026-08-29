import { ITEM_META } from "@/game/catalog";
import { maxMana } from "@/game/magery";
import { useGame } from "@/game/store";
import type { ItemId, WearSlot } from "@/game/types";
import { cn } from "@/lib/utils";

const SLOTS: { id: WearSlot; label: string }[] = [
  { id: "head", label: "Head" },
  { id: "neck", label: "Neck" },
  { id: "chest", label: "Chest" },
  { id: "cloak", label: "Cloak" },
  { id: "hands", label: "Hands" },
  { id: "finger", label: "Finger" },
  { id: "legs", label: "Legs" },
  { id: "feet", label: "Feet" },
];

export function ItemGlyph({ id, className }: { id: ItemId; className?: string }) {
  return (
    <span
      className={cn("inline-block size-3 rounded-[var(--radius-xs)] border border-border", className)}
      style={{ background: ITEM_META[id].fill }}
    />
  );
}

export function YouDressing() {
  const snap = useGame((s) => s.snap);
  const equip = useGame((s) => s.equip);
  const unequip = useGame((s) => s.unequip);
  const drop = useGame((s) => s.drop);
  const heal = useGame((s) => s.heal);
  const eat = useGame((s) => s.eat);
  const self = snap.people.find((p) => p.isPlayer);
  const pack = snap.player?.pack;
  const wear = snap.player?.wear ?? {};
  const skills = snap.player?.skills;
  if (!self || !pack) return null;
  const ghost = Boolean(self.ghost);
  const held = (Object.keys(pack) as ItemId[]).filter((id) => (pack[id] ?? 0) > 0);
  return (
    <div>
      <h2 className="font-display text-sm text-fg">{self.name}</h2>
      {ghost ? (
        <p className="mt-1 text-pretty text-xs leading-relaxed text-accent">
          You are a ghost. A healer can return you. Ione stands at the hall. Your corpse still holds what it took.
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">
          {Math.ceil(self.hp)}/{self.maxHp} health · mana {Math.floor(snap.player?.mana ?? 0)}/
          {maxMana(self.int, skills?.magery ?? 0)} · hunger {Math.round(self.hunger)}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-1">
        {SLOTS.map((s) => {
          const id = wear[s.id];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => id && unequip(s.id)}
              className="flex min-h-11 items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
            >
              <span className="text-xs text-muted">{s.label}</span>
              <span className="text-sm text-fg">{id ? ITEM_META[id].label : "—"}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 font-display text-xs tracking-wider text-muted uppercase">Pack</p>
      <ul className="mt-1 max-h-48 space-y-1 overflow-auto">
        {held.map((id) => (
          <li key={id} className="flex gap-1">
            <button
              type="button"
              onClick={() => equip(id)}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
            >
              <ItemGlyph id={id} />
              <span className="truncate text-sm text-fg">{ITEM_META[id].label}</span>
              <span className="ml-auto text-xs text-muted">{pack[id]}</span>
            </button>
            <button
              type="button"
              onClick={() => drop(id)}
              className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-xs)] border border-border bg-surface-2 text-muted"
            >
              Drop
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={heal} className="min-h-11 flex-1 rounded-[var(--radius-md)] border border-border bg-surface-2 text-sm text-fg">
          Bandage
        </button>
        <button type="button" onClick={eat} className="min-h-11 flex-1 rounded-[var(--radius-md)] border border-border bg-surface-2 text-sm text-fg">
          Eat
        </button>
      </div>
    </div>
  );
}
