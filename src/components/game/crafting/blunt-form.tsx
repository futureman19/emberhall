import { useState } from "react";
import { RECIPES } from "@/game/craft";
import { ITEM_FORM_CATALOG } from "@/game/crafting/forms";
import type { MaterialRole } from "@/game/crafting/types";
import type { ResourceInventoryRow } from "@/game/inventory/resources";
import type { MaterialGrade } from "@/game/resources/types";
import { useGame } from "@/game/store";
import type { ResourceStackKey } from "@/game/types";
import { MaterialSelector } from "./material-selector";
import { WorkmanshipPreview } from "./workmanship-preview";
import { ConfirmCraft } from "./confirm-craft";

export function BluntForm({ id, rows, atStation, skill }: {
  id: "mace" | "war_hammer" | "quarterstaff" | "tower_shield";
  rows: readonly ResourceInventoryRow[]; atStation: boolean; skill: number;
}) {
  const [selected, setSelected] = useState<Partial<Record<MaterialRole, ResourceStackKey>>>({});
  const makeExact = useGame(s => s.makeExactRecipe);
  const form = ITEM_FORM_CATALOG[id];
  const disabledReason = !atStation ? `Stand at the ${id === "quarterstaff" ? "bench" : "forge"}`
    : form.roles.some(r => !selected[r.role]) ? "Choose every material"
      : form.roles.some(r => (rows.find(row => row.key === selected[r.role])?.count ?? 0) < r.amount) ? "Not enough selected material" : null;
  const primary = selected[form.roles[0]!.role];
  return <div className="mt-4 space-y-2 border-t border-border pt-3" aria-label={`Advanced ${form.label.toLowerCase()} work`}>
    <p className="font-display text-xs tracking-wider text-gold uppercase">Form · {form.label}</p>
    {form.roles.map(role => <MaterialSelector key={role.role} role={role} rows={rows} selected={selected[role.role] ?? null}
      onSelect={key => setSelected(previous => ({ ...previous, [role.role]: key }))} group={`${id}-${role.role}`} />)}
    <WorkmanshipPreview skill={skill} difficulty={RECIPES.find(r => r.exactRecipeId === id)!.diff}
      primaryGrade={primary ? primary.split(":")[2] as MaterialGrade : undefined} />
    <ConfirmCraft selected={Object.fromEntries(form.roles.map(r => [r.role, selected[r.role] ?? null]))}
      rows={rows} disabledReason={disabledReason} formLabel={form.label.toLowerCase()}
      onConfirm={() => { if (!disabledReason) makeExact(id, form.roles.map(r => ({ role: r.role, key: selected[r.role]! }))); }} />
  </div>;
}
