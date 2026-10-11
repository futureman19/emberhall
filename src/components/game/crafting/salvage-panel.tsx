import { useState } from "react";
import { resourceStackLabel } from "@/game/crafting/recipes";
import { getWorld } from "@/game/live";
import { rareName } from "@/game/rare";
import { previewSalvage, SALVAGE_GEM_SKILL_MIN } from "@/game/salvage";
import { RESOURCE_CATALOG } from "@/game/resources/catalog";
import type { RareItem } from "@/game/types";

export function SalvagePanel({
  items,
  onSalvage,
}: {
  items: readonly RareItem[];
  onSalvage: (uid: string) => void;
}) {
  const worn = new Set(Object.values(getWorld().player.wearRare).filter(Boolean));
  const eligible = items.filter(
    (item) => item.formId && item.components && item.components.length > 0 && !worn.has(item.uid),
  );
  const [itemUid, setItemUid] = useState<string>(eligible[0]?.uid ?? "");
  const selectedItemUid = itemUid || eligible[0]?.uid || "";
  const preview = selectedItemUid ? previewSalvage(getWorld(), selectedItemUid) : null;

  return (
    <section className="rounded-[var(--radius-sm)] border border-border bg-surface p-2" aria-label="Salvage">
      <p className="font-display text-xs tracking-wide text-muted uppercase">Salvage</p>
      <p className="mt-1 text-[11px] text-muted">
        Break one crafted item down for half its materials, rounded down. The item is destroyed.
      </p>
      {eligible.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Carry an unworn crafted item to break down.</p>
      ) : (
        <>
          <label className="mt-2 block text-xs text-muted">
            Crafted item
            <select
              value={selectedItemUid}
              onChange={(event) => setItemUid(event.target.value)}
              className="mt-1 min-h-11 w-full rounded border border-border bg-bg px-2 text-fg"
            >
              {eligible.map((item) => <option key={item.uid} value={item.uid}>{rareName(item)}</option>)}
            </select>
          </label>
          <div className="mt-2 text-xs text-fg">
            {preview?.status === "ready" ? (
              <>
                {preview.recovered.length > 0 ? (
                  <ul>
                    {preview.recovered.map((row) => (
                      <li key={row.key}>{resourceStackLabel(row.key)} ×{row.amount}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Nothing recoverable — every part is too small.</p>
                )}
                {preview.gems.length > 0 && (
                  <p className="mt-1 text-muted">
                    {preview.gemsRecovered
                      ? `Recovered: ${preview.gems.map((gem) => `${RESOURCE_CATALOG[gem.resourceId].label} (${gem.clarity})`).join(", ")}.`
                      : `The inlaid ${preview.gems.length === 1 ? "gem is" : "gems are"} lost — only a master of the craft (${SALVAGE_GEM_SKILL_MIN}+ skill) keeps it.`}
                  </p>
                )}
              </>
            ) : (
              <p>{preview?.message ?? "Choose an item."}</p>
            )}
          </div>
          <button
            type="button"
            disabled={preview?.status !== "ready"}
            onClick={() => onSalvage(selectedItemUid)}
            className="mt-2 min-h-11 w-full rounded border border-gold/50 bg-gold/10 px-3 text-sm text-gold disabled:opacity-50"
          >
            Break down — the item is destroyed
          </button>
        </>
      )}
    </section>
  );
}
