import { useCallback, useMemo } from "react";
import { verbsFor } from "@/game/context";
import { useGame } from "@/game/store";
import { nearbyTargets } from "@/components/game/actions-targets";
import { usePanelA11y } from "@/components/game/use-panel-a11y";

/**
 * Nearby actions — the keyboard and switch path to the world's verbs.
 * Native buttons in document order: Tab moves, Enter does, Escape closes.
 */
export function ActionsPanel({ onClose }: { onClose: () => void }) {
  const snap = useGame((s) => s.snap);
  const doVerb = useGame((s) => s.doVerb);
  const close = useCallback(() => onClose(), [onClose]);
  const dialog = usePanelA11y<HTMLDivElement>(close);
  const groups = useMemo(() => {
    void snap; // refresh with each snapshot cadence
    return nearbyTargets()
      .map((entry) => ({ ...entry, verbs: verbsFor(entry.target) }))
      .filter((entry) => entry.verbs.length > 0);
  }, [snap]);
  return (
    <div
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-label="Nearby actions"
      data-testid="actions-panel"
      className="pointer-events-auto absolute top-16 right-3 bottom-20 z-10 flex w-[min(100%-1.5rem,16rem)] flex-col rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4 outline-none"
    >
      <p className="shrink-0 font-display text-xs tracking-wider text-muted uppercase">What do you do?</p>
      <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
        {groups.length === 0 && <p className="text-pretty text-xs leading-relaxed text-muted">Nothing near enough. Walk closer.</p>}
        {groups.map(({ target, distance, verbs }) => (
          <section key={`${target.kind}:${target.id}`} aria-label={target.label}>
            <p className="text-xs text-muted">
              <span className="text-fg">{target.label}</span> · {Math.round(distance)} pace{Math.round(distance) === 1 ? "" : "s"}
            </p>
            <div className="mt-1 space-y-1">
              {verbs.map((v) => (
                <button
                  key={v.verb}
                  type="button"
                  onClick={() => doVerb(v.verb, target)}
                  className="flex min-h-11 w-full items-center rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left text-sm text-fg hover:bg-surface"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <button
        type="button"
        onClick={close}
        className="mt-2 flex min-h-11 w-full shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border text-sm text-muted hover:text-fg"
      >
        Close
      </button>
    </div>
  );
}
