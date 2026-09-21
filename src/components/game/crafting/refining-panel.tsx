import { Button } from "@/components/ui/button";
import { findProcessingRoute } from "@/game/refining";
import type { GradeResourceId, MaterialGrade, ResourceForm } from "@/game/resources/types";
import type { ResourceStackKey } from "@/game/types";
import type { ResourceInventoryRow } from "@/game/inventory/resources";

/** Forge panel: typed raw stacks with a processing route (ore → ingot, log → board). */
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
  const workable = rows.flatMap((row) => {
    const [resourceId, form, grade] = row.key.split(":") as [GradeResourceId, ResourceForm, MaterialGrade];
    const found = findProcessingRoute(resourceId, form);
    if (!found || found.route.station !== station) return [];
    return [{ row, grade, route: found.route, owner: found.owner }];
  });
  if (workable.length === 0) return null;
  return (
    <div className="mt-3" aria-label="Refining">
      <p className="font-display text-xs tracking-wider text-gold uppercase">Refine</p>
      <ul className="mt-2 space-y-1">
        {workable.map(({ row, grade, route, owner }) => {
          const outputLabel = `${owner.label} ${route.output.form}`;
          const short = row.count < route.input.quantity ? `needs ${route.input.quantity}` : null;
          const unskilled = skill < route.skill.minimum ? `${route.skill.id} ${route.skill.minimum}` : null;
          const reason = !atStation ? "stand at the fire" : short ?? unskilled;
          return (
            <li key={row.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-fg" title={`${owner.label} · ${grade}`}>
                {owner.label} <span className="text-muted">×{row.count} · {grade}</span>
                <span className="text-muted"> → {route.output.form}</span>
              </span>
              <Button
                variant="secondary"
                className="min-h-8 px-2 text-xs"
                disabled={reason !== null}
                title={reason ?? `Smelt into ${outputLabel}`}
                onClick={() => onRefine(row.key)}
              >
                {reason ?? "Smelt"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
