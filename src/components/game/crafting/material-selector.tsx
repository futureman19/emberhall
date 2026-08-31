import { resourceStackMatchesRole } from "@/game/crafting/recipes";
import type { RecipeRole } from "@/game/crafting/types";
import type { ResourceInventoryRow } from "@/game/inventory/resources";
import type { ResourceStackKey } from "@/game/types";
import { cn } from "@/lib/utils";

export function MaterialSelector({
  role,
  rows,
  selected,
  onSelect,
}: {
  role: RecipeRole;
  rows: readonly ResourceInventoryRow[];
  selected: ResourceStackKey | null;
  onSelect: (key: ResourceStackKey) => void;
}) {
  const compatible = rows.filter(({ key }) => resourceStackMatchesRole(role, key));
  return (
    <fieldset className="rounded-[var(--radius-sm)] border border-border bg-surface p-2">
      <legend className="px-1 font-display text-xs tracking-wide text-muted uppercase">
        {role.role} · need {role.amount}
      </legend>
      {compatible.length === 0 ? (
        <p className="text-xs text-accent">No compatible material in your Pack.</p>
      ) : (
        <div className="space-y-1">
          {compatible.map((row) => {
            const enough = row.count >= role.amount;
            return (
              <label
                key={row.key}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-xs)] border px-2",
                  selected === row.key ? "border-gold bg-surface-2" : "border-border bg-bg",
                  !enough && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="radio"
                  name={`material-${role.role}`}
                  value={row.key}
                  checked={selected === row.key}
                  disabled={!enough}
                  onChange={() => onSelect(row.key)}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-fg">{row.label}</span>
                <span className="text-xs text-muted tabular-nums">{row.count}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
