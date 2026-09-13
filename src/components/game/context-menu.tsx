import { verbsFor } from "@/game/context";
import { ITEM_META } from "@/game/catalog";
import { useGame } from "@/game/store";
import type { ItemId } from "@/game/types";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  clampMenuPosition,
  MENU_FALLBACK_HEIGHT,
  MENU_FALLBACK_WIDTH,
  menuMaxHeight,
} from "@/components/game/menu-bounds";
import { usePanelA11y } from "@/components/game/use-panel-a11y";

export function ContextMenu() {
  const ctx = useGame((s) => s.ctx);
  const doVerb = useGame((s) => s.doVerb);
  const close = useGame((s) => s.closeCtx);
  const menuA11y = usePanelA11y<HTMLDivElement>(close, Boolean(ctx));
  const box = useRef<HTMLDivElement>(null);
  const setBox = (el: HTMLDivElement | null) => {
    box.current = el;
    menuA11y.current = el;
  };
  const [measured, setMeasured] = useState({ width: MENU_FALLBACK_WIDTH, height: MENU_FALLBACK_HEIGHT });
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight, x: 0, y: 0 });
  useLayoutEffect(() => {
    if (!ctx) return;
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const visual = window.visualViewport;
      setViewport({ width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight, x: visual?.offsetLeft ?? 0, y: visual?.offsetTop ?? 0 });
      const rect = el.getBoundingClientRect();
      setMeasured((current) => current.width === rect.width && current.height === rect.height ? current : { width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [ctx]);
  if (!ctx) return null;
  const verbs = verbsFor(ctx.target);

  const pos = clampMenuPosition({ x: ctx.x - viewport.x, y: ctx.y - viewport.y }, measured, viewport);
  return (
    <div
      ref={setBox}
      tabIndex={-1}
      className="pointer-events-auto absolute z-20 flex min-w-0 flex-col overflow-y-auto break-words rounded-[var(--radius-md)] border border-border bg-bg/95 p-1 outline-none"
      style={{ left: pos.x + viewport.x, top: pos.y + viewport.y, width: "max-content", maxWidth: Math.max(0, viewport.width - 16), maxHeight: menuMaxHeight(viewport), overflowWrap: "anywhere" }}
      role="menu"
      aria-label={`Actions for ${ctx.target.label}`}
    >
      <p className="shrink-0 px-3 py-1 font-display text-xs tracking-wider text-muted uppercase">{ctx.target.label}</p>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        {verbs.map((v) => (
          <button
            key={v.verb}
            type="button"
            role="menuitem"
            onClick={() => doVerb(v.verb, ctx.target)}
            className="flex min-h-11 w-full items-center px-3 text-left text-sm text-fg hover:bg-surface-2"
          >
            {v.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={close}
        className="flex min-h-11 w-full shrink-0 items-center border-t border-border px-3 text-left text-sm text-muted"
      >
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
  const closePile = useCallback(() => useGame.setState({ openPileId: null }), []);
  const dialog = usePanelA11y<HTMLDivElement>(closePile, Boolean(pile));
  if (!pile) return null;
  const items = (Object.keys(pile.items) as ItemId[]).filter((k) => (pile.items[k] ?? 0) > 0);
  return (
    <div
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-label={`Loot — ${pile.label}`}
      className="pointer-events-auto absolute top-16 left-3 flex max-h-[calc(100dvh-5rem)] w-[min(100%-1.5rem,18rem)] flex-col rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4 outline-none"
    >
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
