import { ITEM_META } from "@/game/catalog";
import { RESOURCE_CATALOG } from "@/game/resources/catalog";
import type { ResourceId } from "@/game/resources/types";
import type { ItemId } from "@/game/types";
import { ICON_PATHS, ITEM_ICON_KIND, RESOURCE_ICON_KIND } from "./item-icon-catalog";

/**
 * The vale's items, drawn as bold flat silhouettes (Direland-grade shape
 * language, zero asset pipeline). Body takes the item's own theme color;
 * the accent path rides currentColor so the cell controls contrast.
 */
export function ItemIcon({ id, className }: { id: ItemId; className?: string }) {
  const glyph = ICON_PATHS[ITEM_ICON_KIND[id]];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path d={glyph.body} style={{ fill: ITEM_META[id].fill }} />
      {glyph.accent ? <path d={glyph.accent} fill="currentColor" opacity={0.55} /> : null}
    </svg>
  );
}

/** Resource stacks reuse the family silhouette in the family's own palette. */
export function ResourceIcon({ id, className }: { id: ResourceId; className?: string }) {
  const definition = RESOURCE_CATALOG[id];
  const glyph = ICON_PATHS[RESOURCE_ICON_KIND[definition.kind]];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path d={glyph.body} fill={definition.visual.primary} />
      {glyph.accent ? <path d={glyph.accent} fill={definition.visual.secondary} /> : null}
    </svg>
  );
}
