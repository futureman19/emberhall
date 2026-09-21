import type { ResourceInventoryRow } from "@/game/inventory/resources";
import type { ResourceStackKey } from "@/game/types";

export function ConfirmCraft({
  selected,
  rows,
  disabledReason,
  onConfirm,
  formLabel,
}: {
  selected: Readonly<Record<string, ResourceStackKey | null>>;
  rows: readonly ResourceInventoryRow[];
  disabledReason: string | null;
  onConfirm: () => void;
  formLabel: string;
}) {
  const label = (key: ResourceStackKey | null) => rows.find((row) => row.key === key)?.label ?? "not selected";
  return (
    <section className="rounded-[var(--radius-sm)] border border-border bg-surface p-2" aria-label={`Confirm ${formLabel} craft`}>
      <p className="font-display text-xs tracking-wide text-muted uppercase">Confirm</p>
      {Object.entries(selected).map(([role, key]) => (
        <p key={role} className="mt-1 text-xs text-fg first:mt-1">
          {role[0]!.toUpperCase() + role.slice(1)}: {label(key)}
        </p>
      ))}
      <p className="mt-1 text-[11px] text-muted">One {formLabel}. Exact selected stacks are consumed only after every check passes.</p>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        onClick={onConfirm}
        className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-gold/50 bg-gold/10 px-3 text-sm text-gold disabled:opacity-50"
      >
        {disabledReason ?? `Craft selected ${formLabel}`}
      </button>
    </section>
  );
}
