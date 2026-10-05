import { Button } from "@/components/ui/button";
import { findProcessingRoute } from "@/game/refining";
import { RESOURCE_CATALOG } from "@/game/resources/catalog";
import type { GradeResourceId, MaterialGrade, ProcessingRoute, ResourceForm } from "@/game/resources/types";
import type { ResourceStackKey } from "@/game/types";
import type { ResourceInventoryRow } from "@/game/inventory/resources";

/** Forge/bench panel: typed raw stacks with a processing route (ore → ingot,
 * log → board, ingots → alloy). Alloy routes show their secondary metals. */
export function RefiningPanel({
  rows,
  station,
  atStation,
  skill,
  onRefine,
}: {
  rows: readonly ResourceInventoryRow[];
  station: "forge" | "bench";
  atStation: boolean;
  skill: number;
  onRefine: (key: ResourceStackKey) => void;
}) {
  const countOf = (resourceId: GradeResourceId, form: ResourceForm) =>
    rows.reduce((sum, row) => {
      const [id, f] = row.key.split(":") as [GradeResourceId, ResourceForm, MaterialGrade];
      return id === resourceId && f === form ? sum + row.count : sum;
    }, 0);

  const workable = rows.flatMap((row) => {
    const [resourceId, form, grade] = row.key.split(":") as [GradeResourceId, ResourceForm, MaterialGrade];
    const found = findProcessingRoute(resourceId, form);
    if (!found || found.route.station !== station) return [];
    return [{ row, grade, route: found.route, owner: found.owner }];
  });
  if (workable.length === 0) return null;

  const requirement = (route: ProcessingRoute) =>
    route.inputs
      .slice(1)
      .map((input) => `+ ${input.quantity} ${RESOURCE_CATALOG[input.resourceId].label.toLowerCase()}`)
      .join(" ");

  return (
    <div className="mt-3" aria-label="Refining">
      <p className="font-display text-xs tracking-wider text-gold uppercase">Refine</p>
      <ul className="mt-2 space-y-1">
        {workable.map(({ row, grade, route, owner }) => {
          const primary = route.inputs[0]!;
          const secondaries = route.inputs.slice(1);
          const alloy = secondaries.length > 0;
          const shortPrimary = row.count < primary.quantity ? `needs ${primary.quantity}` : null;
          const shortSecondary = secondaries.find((input) => countOf(input.resourceId, input.form) < input.quantity);
          const unskilled = skill < route.skill.minimum ? `${route.skill.id} ${route.skill.minimum}` : null;
          const reason = !atStation
            ? "stand at the fire"
            : shortPrimary ?? (shortSecondary ? `needs ${shortSecondary.quantity} ${RESOURCE_CATALOG[shortSecondary.resourceId].label.toLowerCase()}` : null) ?? unskilled;
          const verb = route.operation === "saw" ? "Saw" : "Smelt";
          return (
            <li key={row.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-fg" title={`${owner.label} · ${grade}${alloy ? ` · ${requirement(route)}` : ""}`}>
                {owner.label} <span className="text-muted">×{row.count} · {grade}</span>
                <span className="text-muted"> → {route.output.form}{alloy ? ` (${requirement(route)})` : ""}</span>
              </span>
              <Button
                variant="secondary"
                className="min-h-8 px-2 text-xs"
                disabled={reason !== null}
                title={reason ?? `${verb} into ${owner.label} ${route.output.form}`}
                onClick={() => onRefine(row.key)}
              >
                {reason ?? verb}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
