import type { ResourceInventoryRow } from "@/game/inventory/resources";
import type { ResourceStackKey } from "@/game/types";

export function ConfirmCraft({
  selected,
  rows,
  disabledReason,
  onConfirm,
}: {
  selected: Readonly<Record<"body" | "binding", ResourceStackKey | null>>;
  rows: readonly ResourceInventoryRow[];
  disabledReason: string | null;
  onConfirm: () => void;
}) {
  const label = (key: ResourceStackKey | null) => rows.find((row) => row.key === key)?.label ?? "not selected";
  return (
    <section className="rounded-[var(--radius-sm)] border border-border bg-surface p-2" aria-label="Confirm bow craft">
      <p className="font-display text-xs tracking-wide text-muted uppercase">Confirm</p>
      <p className="mt-1 text-xs text-fg">Body: {label(selected.body)}</p>
      <p className="text-xs text-fg">Binding: {label(selected.binding)}</p>
      <p className="mt-1 text-[11px] text-muted">One bow. Exact selected stacks are consumed only after every check passes.</p>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        onClick={onConfirm}
        className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-gold/50 bg-gold/10 px-3 text-sm text-gold disabled:opacity-50"
      >
        {disabledReason ?? "Craft selected bow"}
      </button>
    </section>
  );
}
