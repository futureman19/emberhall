import { useState } from "react";
import { RECIPES } from "@/game/craft";
import { ITEM_FORM_CATALOG } from "@/game/crafting/forms";
import type { ResourceInventoryRow } from "@/game/inventory/resources";
import type { MaterialGrade } from "@/game/resources/types";
import { useGame } from "@/game/store";
import type { ResourceStackKey } from "@/game/types";
import { MaterialSelector } from "./material-selector";
import { WorkmanshipPreview } from "./workmanship-preview";
import { ConfirmCraft } from "./confirm-craft";

/** Each mounted form owns its selection and radio groups independently. */
export function ForgedWeaponForm({ id, rows, atForge, skill }: {
  id: "dagger" | "spear" | "war_axe";
  rows: readonly ResourceInventoryRow[];
  atForge: boolean;
  skill: number;
}) {
  const [edge, setEdge] = useState<ResourceStackKey | null>(null);
  const [hilt, setHilt] = useState<ResourceStackKey | null>(null);
  const makeExact = useGame(s => s.makeExactRecipe);
  const form = ITEM_FORM_CATALOG[id];
  const edgeRole = form.roles[0]!;
  const hiltRole = form.roles[1]!;
  const count = (key: ResourceStackKey | null) => rows.find(row => row.key === key)?.count ?? 0;
  const disabledReason = !atForge ? "Stand at the forge"
    : !edge || !hilt ? "Choose edge and hilt"
      : count(edge) < edgeRole.amount || count(hilt) < hiltRole.amount ? "Not enough selected material" : null;
  return <div className="mt-4 space-y-2 border-t border-border pt-3" aria-label={`Advanced ${form.label.toLowerCase()} work`}>
    <p className="font-display text-xs tracking-wider text-gold uppercase">Form · {form.label}</p>
    <MaterialSelector role={edgeRole} rows={rows} selected={edge} onSelect={setEdge} group={`${id}-edge`} />
    <MaterialSelector role={hiltRole} rows={rows} selected={hilt} onSelect={setHilt} group={`${id}-hilt`} />
    <WorkmanshipPreview skill={skill} difficulty={RECIPES.find(r => r.exactRecipeId === id)!.diff}
      primaryGrade={edge ? edge.split(":")[2] as MaterialGrade : undefined} />
    <ConfirmCraft selected={{ edge, hilt }} rows={rows} disabledReason={disabledReason}
      formLabel={form.label.toLowerCase()}
      onConfirm={() => { if (edge && hilt) makeExact(id, [{ role: "edge", key: edge }, { role: "hilt", key: hilt }]); }} />
  </div>;
}
