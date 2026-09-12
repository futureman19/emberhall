import { verbsFor } from "@/game/context";
import { ITEM_META } from "@/game/catalog";
import { useGame } from "@/game/store";
import type { ItemId } from "@/game/types";

export function ContextMenu() {
  const ctx = useGame((s) => s.ctx);
  const doVerb = useGame((s) => s.doVerb);
  const close = useGame((s) => s.closeCtx);
  if (!ctx) return null;
  const verbs = verbsFor(ctx.target);
  return (
    <div
      className="pointer-events-auto absolute z-20 min-w-40 rounded-[var(--radius-md)] border border-border bg-bg/95 p-1"
      style={{ left: Math.min(ctx.x, window.innerWidth - 180), top: Math.min(ctx.y, window.innerHeight - 220) }}
    >
      <p className="px-3 py-1 font-display text-xs tracking-wider text-muted uppercase">{ctx.target.label}</p>
      {verbs.map((v) => (
        <button
          key={v.verb}
          type="button"
          onClick={() => doVerb(v.verb, ctx.target)}
          className="flex min-h-11 w-full items-center px-3 text-left text-sm text-fg hover:bg-surface-2"
        >
          {v.label}
        </button>
      ))}
      <button type="button" onClick={close} className="flex min-h-11 w-full items-center px-3 text-left text-sm text-muted">
        Cancel
      </button>
    </div>
  );
}

export function PileGump() {
  const toast = useGame((s) => s.toast);
  const id = useGame((s) => s.openPileId);
  const piles = useGame((s) => s.snap.piles);
  const take = useGame((s) => s.takePile);
  const takeGold = useGame((s) => s.takePileGold);
  const pile = piles.find((p) => p.id === id);
  if (!pile) return null;
  const items = (Object.keys(pile.items) as ItemId[]).filter((k) => (pile.items[k] ?? 0) > 0);
  return (
    <div className="pointer-events-auto absolute top-16 left-3 flex max-h-[calc(100dvh-5rem)] w-[min(100%-1.5rem,18rem)] flex-col rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <p className="min-w-0 pt-2 font-display text-sm break-words text-fg">{pile.label}</p>
        <button type="button" aria-label="Close loot" onClick={() => useGame.setState({ openPileId: null })} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {toast && <p role="status" className="mt-2 max-h-20 shrink-0 overflow-y-auto rounded-[var(--radius-xs)] border border-border bg-surface-2 px-2 py-1.5 text-xs break-words text-fg">{toast}</p>}
      <ul className="mt-2 min-h-0 space-y-1 overflow-y-auto overscroll-contain">
        {pile.gold > 0 && (
          <li>
            <button
              type="button"
              onClick={() => takeGold(pile.id)}
              className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-gold/40 bg-surface-2 px-3 text-sm text-gold"
            >
              <span>Gold</span>
              <span>{pile.gold}g</span>
            </button>
          </li>
        )}
        {items.map((item) => (
          <li key={item}>
            <button
              type="button"
              onClick={() => take(pile.id, item)}
              className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-sm text-fg"
            >
              <span>{ITEM_META[item].label}</span>
              <span className="text-muted">{pile.items[item]}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => take(pile.id)}
        className="mt-2 flex min-h-11 w-full shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-accent text-sm text-accent-fg"
      >
        Take all
      </button>
    </div>
  );
}
