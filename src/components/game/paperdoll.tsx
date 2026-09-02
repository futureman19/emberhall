import { ITEM_META, LIVE_SKILLS, NOTORIETY_META, SKILL_META } from "@/game/catalog";
import { getWorld } from "@/game/live";
import { listResourceInventory } from "@/game/inventory/resources";
import { maxMana } from "@/game/magery";
import { dressedStats } from "@/game/iteminfo";
import { rareName } from "@/game/rare";
import { useGame } from "@/game/store";
import type { ItemId, RareItem, SkillId, WearSlot } from "@/game/types";
import { ItemTipContent } from "@/components/game/item-tip";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

/** Slot layout — the left flank, the right flank, and where each hangs on the body. */
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

function packHint(id: ItemId) {
  if (id === "deed_porch" || id === "deed_hut" || id === "deed_homestead") return "Place";
  const slot = ITEM_META[id].slot;
  if (slot === "main" || slot === "off") return "Hold";
  if (slot) return "Wear";
  return null;
}

export function ItemGlyph({ id, className }: { id: ItemId; className?: string }) {
  return (
    <span
      className={cn("inline-block size-3 rounded-[var(--radius-xs)] border border-border", className)}
      style={{ background: ITEM_META[id].fill }}
    />
  );
}

function VitalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5" title={`${label} ${Math.round(value)}/${max}`}>
      <span className="w-11 shrink-0 text-[10px] tracking-wide text-muted uppercase">{label}</span>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span className={cn("block h-full", color)} style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 text-[11px] text-fg tabular-nums">{Math.round(value)}</span>
    </span>
  );
}

/** One slot chip — glyph, what it holds (or the slot's name), tap to take off. */
function SlotChip({
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
  return (
    <Tip content={tipId ? <ItemTipContent id={tipId} rare={rare ?? undefined} skipCompare /> : null} className="min-w-0">
      <button
        type="button"
        onClick={() => filled && onUnequip(slot)}
        className={cn(
          "flex min-h-9 w-full min-w-0 items-center gap-1.5 rounded-[var(--radius-xs)] border px-1.5 text-left",
          rare ? "border-gold/50 bg-surface-2" : filled ? "border-border-strong bg-surface-2" : "border-border bg-surface",
        )}
      >
        {tipId ? <ItemGlyph id={tipId} className="shrink-0" /> : <span className="inline-block size-3 shrink-0 rounded-[var(--radius-xs)] border border-dashed border-border" />}
        <span className={cn("truncate text-xs", rare ? "text-gold" : filled ? "text-fg" : "text-muted")}>
          {rare ? rareName(rare) : id ? ITEM_META[id].label : label}
        </span>
      </button>
    </Tip>
  );
}

/** The little body — each part tints when dressed, gold when a wonder covers it. */
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
    <div className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface py-3">
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
        <div className="mt-2 space-y-1.5">
          <VitalBar label="Health" value={self.hp} max={self.maxHp} color="bg-red-500/80" />
          <VitalBar label="Mana" value={mana} max={manaMax} color="bg-sky-500/80" />
          <VitalBar label="Belly" value={self.hunger} max={100} color="bg-amber-500/80" />
        </div>
      )}

      <p className="mt-3 font-display text-xs tracking-wider text-muted uppercase">Paperdoll</p>
      <p className="mt-1 text-xs text-muted">
        <span className="text-fg">{dressed.mainLabel}</span> · {dressed.dmg} damage · {dressed.armor} armor
      </p>
      <div className="mt-2 flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {LEFT_SLOTS.map((s) => (
            <SlotChip key={s.id} slot={s.id} label={s.label} id={wear[s.id]} rare={rareByUid(wearRare[s.id])} onUnequip={unequip} />
          ))}
        </div>
        <DollFigure wear={wear} rareSlots={rareSlots} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {RIGHT_SLOTS.map((s) => (
            <SlotChip key={s.id} slot={s.id} label={s.label} id={wear[s.id]} rare={rareByUid(wearRare[s.id])} onUnequip={unequip} />
          ))}
        </div>
      </div>
      <p className="mt-2 text-pretty text-xs leading-relaxed text-muted">
        Tap a tool or weapon in the pack to hold it. Tap a worn slot to put it away.
      </p>

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

      <p className="mt-4 font-display text-xs tracking-wider text-muted uppercase">Pack</p>
      {rares.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {rares.map((r) => (
            <li key={r.uid}>
              <Tip content={<ItemTipContent id={r.base} rare={r} />} className="w-full min-w-0">
                <button
                  type="button"
                  onClick={() => equipRare(r.uid)}
                  className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[var(--radius-xs)] border border-gold/40 bg-surface-2 px-3 text-left"
                >
                  <ItemGlyph id={r.base} />
                  <span className="truncate text-sm text-gold">{rareName(r)}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted">
                    {r.workmanship ? `${r.workmanship} · ` : ""}{r.maker ? `by ${r.maker}` : "wonder"}
                  </span>
                </button>
              </Tip>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-1 max-h-48 space-y-1 overflow-auto">
        {held.map((id) => {
          const hint = packHint(id);
          return (
            <li key={id} className="flex gap-1">
              <Tip content={<ItemTipContent id={id} />} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => equip(id)}
                  className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
                >
                  <ItemGlyph id={id} />
                  <span className="truncate text-sm text-fg">{ITEM_META[id].label}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted">
                    {pack[id]}
                    {hint ? ` · ${hint}` : ""}
                  </span>
                </button>
              </Tip>
              <button
                type="button"
                onClick={() => drop(id)}
                className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-xs)] border border-border bg-surface-2 text-muted"
              >
                Drop
              </button>
            </li>
          );
        })}
      </ul>
      {resourceRows.length > 0 ? (
        <ul className="mt-1 max-h-48 space-y-1 overflow-auto" aria-label="Resources">
          {resourceRows.map((resource) => (
            <li
              key={resource.key}
              className="flex min-h-9 min-w-0 items-center gap-2 rounded-[var(--radius-xs)] border border-border bg-surface px-3"
            >
              <span className="inline-block size-3 shrink-0 rounded-full border border-border-strong bg-surface-2" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{resource.label}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{resource.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
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
