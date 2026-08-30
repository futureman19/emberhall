import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FAUNA_META } from "@/game/catalog";
import { petLabel } from "@/game/pets";
import { useGame } from "@/game/store";
import type { Creature } from "@/game/types";

function LoyaltyBar({ loyalty }: { loyalty: number }) {
  const color = loyalty >= 50 ? "bg-emerald-500" : loyalty >= 20 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <span className={`block h-full ${color}`} style={{ width: `${Math.round(loyalty)}%` }} />
    </span>
  );
}

function PetRow({ c, youX, youZ, renaming }: { c: Creature; youX: number; youZ: number; renaming: boolean }) {
  const stayPet = useGame((s) => s.stayPet);
  const followPet = useGame((s) => s.followPet);
  const feedPet = useGame((s) => s.feedPet);
  const releasePet = useGame((s) => s.releasePet);
  const namePet = useGame((s) => s.namePet);
  const [editing, setEditing] = useState(renaming);
  const [draft, setDraft] = useState(c.name ?? "");
  const dist = Math.hypot(c.x - youX, c.z - youZ);
  const where = dist < 5 ? "at heel" : dist < 20 ? "nearby" : "far off";
  const meta = FAUNA_META[c.kind];
  return (
    <li className="rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 py-2">
      <span className="flex items-center justify-between gap-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={20}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                namePet(c.id, draft);
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={() => {
              namePet(c.id, draft);
              setEditing(false);
            }}
            className="w-28 rounded-[var(--radius-xs)] border border-border bg-bg px-1.5 py-0.5 text-sm text-fg outline-none"
            aria-label="Pet name"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(c.name ?? "");
              setEditing(true);
            }}
            className="min-w-0 truncate text-left text-sm text-gold hover:underline"
            title="Rename"
          >
            {petLabel(c)}
          </button>
        )}
        <span className="shrink-0 text-[11px] text-muted">
          {meta.label} · {c.stay ? "staying" : "following"} · {where}
        </span>
      </span>
      <span className="mt-1.5 flex items-center gap-2">
        <LoyaltyBar loyalty={c.loyalty} />
        <span className={`shrink-0 text-[11px] ${c.loyalty < 15 ? "text-red-400" : "text-muted"}`}>
          {c.loyalty < 15 ? "restless" : `${Math.round(c.loyalty)}`}
        </span>
      </span>
      <span className="mt-2 flex gap-1.5">
        {c.stay ? (
          <Button className="h-7 px-2 text-[11px]" onClick={() => followPet(c.id)}>Follow</Button>
        ) : (
          <Button className="h-7 px-2 text-[11px]" onClick={() => stayPet(c.id)}>Stay</Button>
        )}
        <Button className="h-7 px-2 text-[11px]" onClick={() => feedPet(c.id)}>Feed</Button>
        <Button className="h-7 px-2 text-[11px]" onClick={() => releasePet(c.id)}>Release</Button>
      </span>
    </li>
  );
}

/** The companions panel — every beast bonded to you, its love and its whereabouts. */
export function PetsGump() {
  const open = useGame((s) => s.openPets);
  const close = useGame((s) => s.closePets);
  const renamePetId = useGame((s) => s.renamePetId);
  const fauna = useGame((s) => s.snap.fauna);
  const playerId = useGame((s) => s.snap.player.id);
  const youX = useGame((s) => s.snap.youX);
  const youZ = useGame((s) => s.snap.youZ);
  if (!open) return null;
  const pets = fauna.filter((c) => c.ownerId === playerId && c.task !== "dead");
  return (
    <div className="pointer-events-auto absolute top-16 right-3 max-h-[min(70vh,36rem)] w-[min(100%-1.5rem,20rem)] overflow-auto rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4 sm:right-4">
      <p className="font-display text-sm text-fg">Companions</p>
      <p className="mt-0.5 text-xs text-muted">Feed them, and they are yours forever. Forget, and the wild takes them back.</p>
      {pets.length === 0 ? (
        <p className="mt-3 text-xs text-muted">No companions yet — tame a beast of the vale.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pets.map((c) => (
            <PetRow key={c.id} c={c} youX={youX} youZ={youZ} renaming={renamePetId === c.id} />
          ))}
        </ul>
      )}
      <Button className="mt-3 w-full" onClick={close}>Done</Button>
    </div>
  );
}
