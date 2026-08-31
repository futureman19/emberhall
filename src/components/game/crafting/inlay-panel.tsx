import { useState } from "react";
import { previewItemInlay } from "@/game/inlay";
import { getWorld } from "@/game/live";
import { rareName } from "@/game/rare";
import { RESOURCE_CATALOG } from "@/game/resources/catalog";
import type { ResourceInventoryRow } from "@/game/inventory/resources";
import type { RareItem, ResourceStackKey } from "@/game/types";

export function InlayPanel({
  items,
  rows,
  onInlay,
}: {
  items: readonly RareItem[];
  rows: readonly ResourceInventoryRow[];
  onInlay: (uid: string, key: ResourceStackKey) => void;
}) {
  const eligible = items.filter((item) => item.formId && item.components && item.inlays);
  const gemRows = rows.filter(({ key }) => {
    const resourceId = key.split(":")[0]!;
    return Object.hasOwn(RESOURCE_CATALOG, resourceId)
      && RESOURCE_CATALOG[resourceId as keyof typeof RESOURCE_CATALOG].qualityType === "clarity";
  });
  const [itemUid, setItemUid] = useState<string>(eligible[0]?.uid ?? "");
  const [gemKey, setGemKey] = useState<ResourceStackKey | "">(gemRows[0]?.key ?? "");
  const selectedItemUid = itemUid || eligible[0]?.uid || "";
  const selectedGemKey = gemKey || gemRows[0]?.key || "";
  const preview = selectedItemUid && selectedGemKey
    ? previewItemInlay(getWorld().player, selectedItemUid, selectedGemKey)
    : null;

  return (
    <section className="rounded-[var(--radius-sm)] border border-border bg-surface p-2" aria-label="Gem inlay">
      <p className="font-display text-xs tracking-wide text-muted uppercase">Inlay</p>
      <p className="mt-1 text-[11px] text-muted">Choose one crafted item and one exact gem. The result is guaranteed.</p>
      {eligible.length === 0 || gemRows.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Carry a unique crafted item and a gem to inlay.</p>
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
          <label className="mt-2 block text-xs text-muted">
            Gem
            <select
              value={selectedGemKey}
              onChange={(event) => setGemKey(event.target.value as ResourceStackKey)}
              className="mt-1 min-h-11 w-full rounded border border-border bg-bg px-2 text-fg"
            >
              {gemRows.map((row) => <option key={row.key} value={row.key}>{row.label} ({row.count})</option>)}
            </select>
          </label>
          <p className="mt-2 text-xs text-fg">
            {preview?.status === "ready"
              ? `${preview.effect.label}: ${preview.effect.scope === "local" ? `Fortune ${preview.local.fortune}` : `+${preview.effect.amount} ${preview.effect.stat}`}`
              : preview?.message ?? "Choose an item and gem."}
          </p>
          <button
            type="button"
            disabled={preview?.status !== "ready"}
            onClick={() => selectedGemKey && onInlay(selectedItemUid, selectedGemKey)}
            className="mt-2 min-h-11 w-full rounded border border-gold/50 bg-gold/10 px-3 text-sm text-gold disabled:opacity-50"
          >
            Inlay exact result
          </button>
        </>
      )}
    </section>
  );
}
