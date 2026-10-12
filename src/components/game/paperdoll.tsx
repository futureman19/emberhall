import { ITEM_META, LIVE_SKILLS, NOTORIETY_META, SKILL_META } from "@/game/catalog";
import { getWorld } from "@/game/live";
import { listResourceInventory } from "@/game/inventory/resources";
import { maxMana } from "@/game/magery";
import { dressedStats } from "@/game/iteminfo";
import { rareName } from "@/game/rare";
import { useGame } from "@/game/store";
import type { MaterialQuality, ResourceId } from "@/game/resources/types";
import type { ItemId, RareItem, SkillId, WearSlot } from "@/game/types";
import { ItemTipContent } from "@/components/game/item-tip";
import { GlyphIcon, ItemIcon, ResourceIcon } from "@/components/game/item-icon";
import { GRADE_RING, SLOT_ICON_KIND } from "@/components/game/item-icon-catalog";
import { LivingDoll } from "@/components/game/living-doll";
import { HOTBAR_SLOTS, dockStorage, loadHotbar, pinItem, saveHotbar, subscribeHotbar, unpinItem } from "@/components/game/chrome/hotbar-dock";
import { useGraphicsSettings } from "@/game/graphics-settings";
import { Tip } from "@/components/ui/tip";
import { Bandage, Drumstick, Hand, Heart, Pin, PinOff, Shield, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Slot order — the left flank and the right flank of the living doll. */
const LEFT_SLOTS: { id: WearSlot; label: string }[] = [
  { id: "head", label: "Head" },
  { id: "neck", label: "Neck" },
  { id: "chest", label: "Chest" },
  { id: "cloak", label: "Cloak" },
  { id: "finger", label: "Finger" },
];
const RIGHT_SLOTS: { id: WearSlot; label: string }[] = [
  { id: "main", label: "Hand" },
  { id: "off", label: "Off hand" },
  { id: "hands", label: "Gloves" },
  { id: "legs", label: "Legs" },
  { id: "feet", label: "Feet" },
];

/** Direland backpack: five columns, nine rows of dark cells, always visible. */
const PACK_COLUMNS = 5;
const PACK_CELLS = 45;

/** Quick-bar membership toggle for the selected pack cell. */
function PinButton({ id }: { id: ItemId }) {
  const [ids, setIds] = useState<ItemId[]>(() => {
    const storage = dockStorage();
    return storage ? loadHotbar(storage) : [];
  });
  useEffect(
    () =>
      subscribeHotbar(() => {
        const storage = dockStorage();
        if (storage) setIds(loadHotbar(storage));
      }),
    [],
  );
  const pinned = ids.includes(id);
  const full = !pinned && ids.length >= HOTBAR_SLOTS;
  return (
    <button
      type="button"
      aria-disabled={full}
      onClick={() => {
        if (full) return;
        const storage = dockStorage();
        if (storage) saveHotbar(storage, pinned ? unpinItem(ids, id) : pinItem(ids, id));
      }}
      aria-label={pinned ? `Unpin ${ITEM_META[id].label} from the quick bar` : full ? `Pin ${ITEM_META[id].label} — quick bar full` : `Pin ${ITEM_META[id].label} to the quick bar`}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-[var(--radius-xs)] border",
        pinned ? "border-gold/50 bg-gold/10 text-gold" : full ? "border-border bg-surface-2 text-muted/40" : "border-border bg-surface-2 text-muted",
      )}
    >
      {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
    </button>
  );
}

/** The pack cell's primary action verb — deeds place, potions drink,
 *  weapons hold, the rest wear. Everything else is inspect-only. */
function packHint(id: ItemId) {
  if (id === "deed_porch" || id === "deed_hut" || id === "deed_homestead") return "Place";
  if (id === "potion_heal" || id === "potion_night") return "Drink";
  const slot = ITEM_META[id].slot;
  if (slot === "main" || slot === "off") return "Hold";
  if (slot) return "Wear";
  return null;
}

export function ItemGlyph({ id, className }: { id: ItemId; className?: string }) {
  // One glyph, every surface: the old color chip grew up into the drawn icon.
  return <ItemIcon id={id} className={cn("inline-block size-3 rounded-[var(--radius-xs)] border border-border", className)} />;
}

/** An icon + number chip — vitals and stats speak in symbols. */
function StatChip({ icon: Icon, label, value, max, className }: { icon: typeof Heart; label: string; value: number; max?: number; className?: string }) {
  return (
    <span
      className={cn("flex items-center gap-1 text-xs text-fg tabular-nums", className)}
      title={max ? `${label} ${Math.round(value)}/${max}` : `${label} ${Math.round(value)}`}
      aria-label={max ? `${label} ${Math.round(value)} of ${max}` : `${label} ${Math.round(value)}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.round(value)}
    </span>
  );
}

/** One gear cell — the item's glyph when dressed, the slot's own glyph when bare. */
function SlotCell({
  slot,
  label,
  id,
  rare,
  onUnequip,
}: {
  slot: WearSlot;
  label: string;
  id: ItemId | undefined;
  rare: RareItem | null;
  onUnequip: (slot: WearSlot) => void;
}) {
  const filled = Boolean(id) || Boolean(rare);
  const tipId = rare ? rare.base : id;
  const name = rare ? rareName(rare) : id ? ITEM_META[id].label : null;
  return (
    <Tip content={tipId ? <ItemTipContent id={tipId} rare={rare ?? undefined} skipCompare /> : null}>
      <button
        type="button"
        onClick={() => filled && onUnequip(slot)}
        aria-label={filled ? `Unequip ${name}` : `${label} — empty`}
        className={cn(
          "grid size-11 place-items-center rounded-[var(--radius-xs)] border",
          rare ? "border-gold/50 bg-surface-2 text-gold" : filled ? "border-border-strong bg-surface-2 text-fg" : "border-border/60 bg-bg text-muted/40",
        )}
      >
        {tipId ? <ItemIcon id={tipId} className="size-6" /> : <GlyphIcon kind={SLOT_ICON_KIND[slot]} className="size-5" />}
      </button>
    </Tip>
  );
}

/** The static body for reduced effects — each part tints when dressed. */
function DollFigure({
  wear,
  rareSlots,
}: {
  wear: Partial<Record<WearSlot, ItemId>>;
  rareSlots: Partial<Record<WearSlot, boolean>>;
}) {
  const tint = (slot: WearSlot) =>
    rareSlots[slot] ? "bg-gold/70" : wear[slot] ? "bg-accent/70" : "bg-surface-2";
  return (
    <div className="flex w-20 shrink-0 flex-col items-center gap-1 py-3">
      <span className={cn("block size-3.5 rounded-full", tint("head"))} />
      <span className={cn("block h-1.5 w-4 rounded-[var(--radius-xs)]", tint("neck"))} />
      <span className={cn("block h-5 w-9 rounded-[var(--radius-xs)]", tint("chest"))} />
      <div className="flex items-end gap-1">
        <span className={cn("block h-6 w-2 rounded-[var(--radius-xs)]", tint("main"))} />
        <span className={cn("block h-4 w-5 rounded-[var(--radius-xs)]", tint("hands"))} />
        <span className={cn("block h-6 w-2 rounded-[var(--radius-xs)]", tint("off"))} />
      </div>
      <span className={cn("block h-5 w-6 rounded-[var(--radius-xs)]", tint("legs"))} />
      <span className={cn("block h-1.5 w-7 rounded-[var(--radius-xs)]", tint("feet"))} />
    </div>
  );
}

export function YouDressing() {
  const snap = useGame((s) => s.snap);
  const equip = useGame((s) => s.equip);
  const unequip = useGame((s) => s.unequip);
  const drop = useGame((s) => s.drop);
  const heal = useGame((s) => s.heal);
  const eat = useGame((s) => s.eat);
  const equipRare = useGame((s) => s.equipRare);
  const [selected, setSelected] = useState<ItemId | null>(null);
  const reducedEffects = useGraphicsSettings().reducedEffects;
  const self = snap.people.find((p) => p.isPlayer);
  const pack = snap.player?.pack;
  const wear = snap.player?.wear ?? {};
  const wearRare = snap.player?.wearRare ?? {};
  const rares = snap.player?.rares ?? [];
  const skills = snap.player?.skills;
  if (!self || !pack) return null;
  const resourceRows = listResourceInventory(snap.player?.resources ?? { stacks: {} });
  const ghost = Boolean(self.ghost);
  const held = (Object.keys(pack) as ItemId[]).filter((id) => (pack[id] ?? 0) > 0);
  // Dressed first, then food, then the rest — the pack answers "what can I use?" before "what do I carry?".
  held.sort((a, b) => {
    const sa = ITEM_META[a].slot ? 0 : ITEM_META[a].tags.includes("food") ? 1 : 2;
    const sb = ITEM_META[b].slot ? 0 : ITEM_META[b].tags.includes("food") ? 1 : 2;
    return sa - sb || ITEM_META[a].label.localeCompare(ITEM_META[b].label);
  });
  const rareByUid = (uid: string | undefined) => (uid ? (rares.find((r) => r.uid === uid) ?? null) : null);
  const rareSlots: Partial<Record<WearSlot, boolean>> = {};
  for (const [slot, uid] of Object.entries(wearRare)) if (uid) rareSlots[slot as WearSlot] = true;
  const dressed = dressedStats(getWorld());
  const mana = snap.player?.mana ?? 0;
  const manaMax = maxMana(self.int, skills?.magery ?? 0);
  const filledCells = rares.length + held.length;
  const cellCount = Math.max(PACK_CELLS, Math.ceil(filledCells / PACK_COLUMNS) * PACK_COLUMNS);
  return (
    <div>
      <h2 className="font-display text-sm text-fg">{self.name}</h2>
      <p className="mt-0.5 text-xs text-muted tabular-nums">
        <span className="text-gold">{snap.gold} gold</span> · {NOTORIETY_META[snap.player?.notoriety ?? "innocent"].label}
      </p>
      {ghost ? (
        <p className="mt-1 text-pretty text-xs leading-relaxed text-accent">
          You are a ghost. A healer can return you. Ione stands at the hall. Your corpse still holds what it took.
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-3" aria-label="Vitals and gear">
          <StatChip icon={Heart} label="Health" value={self.hp} max={self.maxHp} className="text-red-400" />
          <StatChip icon={Sparkles} label="Mana" value={mana} max={manaMax} className="text-sky-400" />
          <StatChip icon={Drumstick} label="Belly" value={self.hunger} max={100} className="text-amber-400" />
          <span className="flex-1" aria-hidden />
          <StatChip icon={Hand} label={`${dressed.mainLabel} — damage`} value={dressed.dmg} className="text-fg" />
          <StatChip icon={Shield} label="Armor" value={dressed.armor} className="text-fg" />
        </div>
      )}

      {/* The Direland block: the living doll with its gear cells, wired
          straight into the dark backpack grid beneath — one connected surface. */}
      <div data-testid="doll-pack" className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
        <div className="flex items-center justify-center gap-2 px-2 py-2">
          <div className="flex flex-col gap-1">
            {LEFT_SLOTS.map((s) => (
              <SlotCell key={s.id} slot={s.id} label={s.label} id={wear[s.id]} rare={rareByUid(wearRare[s.id])} onUnequip={unequip} />
            ))}
          </div>
          {reducedEffects ? (
            <DollFigure wear={wear} rareSlots={rareSlots} />
          ) : (
            <div className="h-52 w-32 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-bg">
              <LivingDoll wear={wear} rareByUid={(slot) => rareByUid(wearRare[slot])} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            {RIGHT_SLOTS.map((s) => (
              <SlotCell key={s.id} slot={s.id} label={s.label} id={wear[s.id]} rare={rareByUid(wearRare[s.id])} onUnequip={unequip} />
            ))}
          </div>
        </div>
        <ul className="grid grid-cols-5 gap-1 border-t border-border bg-bg p-1.5" data-testid="pack-grid">
          {rares.map((r) => (
            <li key={r.uid} data-filled="true">
              <Tip content={<ItemTipContent id={r.base} rare={r} />}>
                <button
                  type="button"
                  onClick={() => equipRare(r.uid)}
                  aria-label={rareName(r)}
                  className="relative grid aspect-square w-full place-items-center rounded-[var(--radius-xs)] border border-gold/60 bg-surface-2 text-fg"
                >
                  <ItemIcon id={r.base} className="size-7" />
                </button>
              </Tip>
            </li>
          ))}
          {held.map((id) => (
            <li key={id} data-filled="true">
              <Tip content={<ItemTipContent id={id} />}>
                <button
                  type="button"
                  onClick={() => setSelected(id)}
                  aria-label={`${ITEM_META[id].label} ×${pack[id]}`}
                  aria-pressed={selected === id}
                  className={cn(
                    "relative grid aspect-square w-full place-items-center rounded-[var(--radius-xs)] border text-fg",
                    selected === id ? "border-gold bg-surface-2" : "border-border",
                  )}
                >
                  <ItemIcon id={id} className="size-7" />
                  <span className="absolute right-1 bottom-0.5 text-[10px] text-muted tabular-nums">{pack[id]}</span>
                </button>
              </Tip>
            </li>
          ))}
          {Array.from({ length: cellCount - filledCells }, (_, i) => (
            <li key={`empty-${i}`} aria-hidden>
              <span className="block aspect-square w-full rounded-[var(--radius-xs)] border border-border/50" />
            </li>
          ))}
        </ul>
      </div>
      {selected && (pack[selected] ?? 0) > 0 ? (
        <div className="mt-1 flex items-center gap-1.5 rounded-[var(--radius-xs)] border border-border bg-surface px-1.5 py-1" data-testid="pack-actions">
          <ItemIcon id={selected} className="size-6 shrink-0" />
          <span className="min-w-0 flex-1" aria-hidden />
          {packHint(selected) ? (
            <button
              type="button"
              onClick={() => equip(selected)}
              aria-label={`${packHint(selected)} ${ITEM_META[selected].label}`}
              className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-xs)] border border-gold/50 bg-gold/10 text-gold"
            >
              <Hand className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => drop(selected)}
            aria-label={`Drop ${ITEM_META[selected].label}`}
            className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-xs)] border border-border bg-surface-2 text-muted"
          >
            <Trash2 className="size-4" />
          </button>
          <PinButton id={selected} />
        </div>
      ) : null}
      {resourceRows.length > 0 ? (
        <ul className="mt-2 grid grid-cols-5 gap-1" aria-label="Resources" data-testid="resource-grid">
          {resourceRows.map((resource) => {
            const [resourceId, , grade] = resource.key.split(":") as [ResourceId, string, MaterialQuality];
            return (
              <li key={resource.key}>
                <Tip content={resource.label}>
                  <span
                    aria-label={`${resource.label} ×${resource.count}`}
                    className={cn(
                      "relative grid aspect-square w-full place-items-center rounded-[var(--radius-xs)] border-2 bg-surface text-fg",
                      GRADE_RING[grade],
                    )}
                  >
                    <ResourceIcon id={resourceId} className="size-7" />
                    <span className="absolute right-1 bottom-0.5 text-[10px] text-muted tabular-nums">{resource.count}</span>
                  </span>
                </Tip>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={heal} aria-label="Bandage" title="Bandage" className="grid min-h-11 flex-1 place-items-center rounded-[var(--radius-md)] border border-border bg-surface-2 text-fg">
          <Bandage className="size-4" />
        </button>
        <button type="button" onClick={eat} aria-label="Eat" title="Eat" className="grid min-h-11 flex-1 place-items-center rounded-[var(--radius-md)] border border-border bg-surface-2 text-fg">
          <Drumstick className="size-4" />
        </button>
      </div>

      <p className="mt-4 font-display text-xs tracking-wider text-muted uppercase">Skills</p>
      <ul className="mt-1 grid grid-cols-2 gap-1">
        {LIVE_SKILLS.map((id) => {
          const v = skills?.[id] ?? 0;
          return (
            <li key={id} className="rounded-[var(--radius-xs)] border border-border bg-surface-2 px-2 py-1">
              <span className="flex items-baseline justify-between">
                <span className="truncate text-xs text-muted">{SKILL_META[id].label}</span>
                <span className="text-xs text-fg tabular-nums">{v.toFixed(1)}</span>
              </span>
              <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-surface">
                <span className={cn("block h-full", v >= 100 ? "bg-gold" : "bg-accent/70")} style={{ width: `${Math.min(100, v)}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
      <Tip content="On the books — the vale has not taught these yet. Their mechanics arrive one window at a time.">
        <p className="mt-3 font-display text-xs tracking-wider text-muted/70 uppercase">Not yet taught</p>
      </Tip>
      <ul className="mt-1 flex flex-wrap gap-1">
        {(Object.keys(SKILL_META) as SkillId[])
          .filter((id) => !LIVE_SKILLS.includes(id))
          .map((id) => (
            <li
              key={id}
              className="rounded-[var(--radius-xs)] border border-border/60 bg-surface px-2 py-1 text-[11px] text-muted/70"
            >
              {SKILL_META[id].label}
            </li>
          ))}
      </ul>
    </div>
  );
}
