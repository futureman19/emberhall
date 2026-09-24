import { useState } from "react";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";

export function BlueprintGump() {
  const holdRev = useGame((s) => s.holdRev);
  const captureHold = useGame((s) => s.captureHold);
  const stampBlueprint = useGame((s) => s.stampBlueprint);
  const [name, setName] = useState("Lean-to");
  void holdRev;
  const plans = getWorld().blueprints;
  return (
    <div data-testid="blueprint-gump" className="mt-6">
      <h3 className="font-display text-xs text-fg">Plans</h3>
      <p className="mt-1 text-pretty text-xs leading-relaxed text-muted">
        Capture the hold as a bill. Stamp spends the whole bill or nothing.
      </p>
      <label className="mt-3 block text-xs text-muted">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-sm text-fg"
        />
      </label>
      <button
        type="button"
        onClick={() => captureHold(name)}
        className="mt-2 flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left text-sm text-fg"
      >
        Capture this hold
      </button>
      <ul className="mt-3 space-y-1">
        {plans.map((bp) => (
          <li key={bp.id}>
            <button
              type="button"
              onClick={() => stampBlueprint(bp.id)}
              className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
            >
              <span className="text-sm text-fg">{bp.name}</span>
              <span className="text-xs text-muted">
                {bp.billOfMaterials.map((c) => `${c.n} ${c.id}`).join(", ") || "Stamp"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
