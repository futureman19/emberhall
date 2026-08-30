import { ITEM_META, SKILL_META } from "@/game/catalog";
import { maxMana } from "@/game/magery";
import { rareName } from "@/game/rare";
import { useGame } from "@/game/store";
import type { ItemId, SkillId, WearSlot } from "@/game/types";
import { ItemTipContent } from "@/components/game/item-tip";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

const SLOTS: { id: WearSlot; label: string }[] = [
  { id: "main", label: "Hand" },
  { id: "off", label: "Off hand" },
  { id: "head", label: "Head" },
  { id: "neck", label: "Neck" },
  { id: "chest", label: "Chest" },
  { id: "cloak", label: "Cloak" },
  { id: "hands", label: "Gloves" },
  { id: "finger", label: "Finger" },
  { id: "legs", label: "Legs" },
  { id: "feet", label: "Feet" },
];

function packHint(id: ItemId) {
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

function DollMark({ filled }: { filled: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-[var(--radius-xs)] border",
        filled ? "border-border-strong bg-accent" : "border-border bg-surface",
      )}
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
  const wearRare = snap.player?.wearRare ?? {};
  const rares = snap.player?.rares ?? [];
  const equipRare = useGame((s) => s.equipRare);
  const skills = snap.player?.skills;
  if (!self || !pack) return null;
  const ghost = Boolean(self.ghost);
  const held = (Object.keys(pack) as ItemId[]).filter((id) => (pack[id] ?? 0) > 0);
  const rareByUid = (uid: string | undefined) => (uid ? (rares.find((r) => r.uid === uid) ?? null) : null);
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
      <p className="mt-3 font-display text-xs tracking-wider text-muted uppercase">Paperdoll</p>
      <p className="mt-1 text-pretty text-xs leading-relaxed text-muted">
        Tap a tool or weapon in the pack to hold it. Tap a slot to put it away.
      </p>
      <div className="mt-2 flex gap-3">
        <div className="grid w-16 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-border bg-surface py-3">
          <div className="flex flex-col items-center gap-1">
            <DollMark filled={Boolean(wear.head)} />
            <span className="block h-3 w-5 rounded-[var(--radius-xs)] bg-surface-2" />
            <span className="block h-6 w-7 rounded-[var(--radius-xs)] bg-accent/80" />
            <div className="flex items-end gap-1">
              <span className={cn("block h-5 w-2 rounded-[var(--radius-xs)]", wear.main || wearRare.main ? "bg-muted" : "bg-surface-2")} />
              <span className="block h-4 w-4 rounded-[var(--radius-xs)] bg-surface-2" />
              <span className={cn("block h-5 w-2 rounded-[var(--radius-xs)]", wear.off || wearRare.off ? "bg-muted" : "bg-surface-2")} />
            </div>
            <span className="block h-5 w-5 rounded-[var(--radius-xs)] bg-surface-2" />
          </div>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
          {SLOTS.map((s) => {
            const id = wear[s.id];
            const rare = rareByUid(wearRare[s.id]);
            const filled = Boolean(id) || Boolean(rare);
            const tipId = rare ? rare.base : id;
            return (
              <Tip key={s.id} content={tipId ? <ItemTipContent id={tipId} rare={rare ?? undefined} /> : null} className="min-w-0">
                <button
                  type="button"
                  onClick={() => filled && unequip(s.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border px-2 text-left",
                    filled ? "border-border-strong bg-surface-2" : "border-border bg-surface-2",
                    (s.id === "main" || s.id === "off") && "border-border-strong",
                  )}
                >
                  <span className="text-xs text-muted">{s.label}</span>
                  <span className={cn("truncate pl-2 text-sm", rare ? "text-gold" : "text-fg")}>
                    {rare ? rareName(rare) : id ? ITEM_META[id].label : "—"}
                  </span>
                </button>
              </Tip>
            );
          })}
        </div>
      </div>
      <p className="mt-4 font-display text-xs tracking-wider text-muted uppercase">Skills</p>
      <ul className="mt-1 grid grid-cols-2 gap-1">
        {(Object.keys(SKILL_META) as SkillId[]).map((id) => (
          <li key={id} className="flex items-baseline justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-2 py-1">
            <span className="truncate text-xs text-muted">{SKILL_META[id].label}</span>
            <span className="text-xs text-fg">{(skills?.[id] ?? 0).toFixed(1)}</span>
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
                  <span className="ml-auto shrink-0 text-xs text-muted">{r.maker ? `by ${r.maker}` : "wonder"}</span>
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
