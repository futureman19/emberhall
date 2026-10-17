import { useEffect, useRef, useState } from "react";
import "./equipment-controls.css";
import type { DragEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";
import { equipmentAction, equipmentTarget } from "@/game/equipment-transfer";
import type { EquipmentSource, EquipmentTarget } from "@/game/equipment-transfer";
import { useGame } from "@/game/store";

type Selection = { source: EquipmentSource; label: string };

/** Native desktop dragging leaves phone scrolling alone; every transfer also has a tap/key button. */
export function useEquipmentControls() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [drag, setDrag] = useState<EquipmentSource | null>(null);
  const dragRef = useRef<EquipmentSource | null>(null);
  const [over, setOver] = useState<EquipmentTarget | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const menuAction = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (menu) menuAction.current?.focus(); }, [menu]);

  const snap = useGame((s) => s.snap);
  const ghost = Boolean(snap.people.find((p) => p.isPlayer)?.ghost);
  const actionFor = (source: EquipmentSource, target: EquipmentTarget | null) =>
    snap.player ? equipmentAction(snap.player, ghost, source, target) : null;
  const defaultTarget = (source: EquipmentSource) => snap.player ? equipmentTarget(snap.player, source) : null;
  const closeMenu = () => { setMenu(null); origin.current?.focus(); };
  const commit = (source: EquipmentSource, target = defaultTarget(source)) => {
    const state = useGame.getState();
    const player = state.snap.player;
    const action = player && equipmentAction(player, Boolean(state.snap.people.find((p) => p.isPlayer)?.ghost), source, target);
    if (!action) return;
    if (action.kind === "equip") state.equip(action.id);
    else if (action.kind === "rare") state.equipRare(action.uid);
    else state.unequip(action.slot);
    setSelection(null);
    closeMenu();
  };
  const endDrag = () => { dragRef.current = null; setDrag(null); setOver(null); };
  const sourceProps = (source: EquipmentSource, label: string, select?: () => void) => ({
    draggable: Boolean(actionFor(source, defaultTarget(source))),
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      origin.current = event.currentTarget;
      setSelection({ source, label });
      select?.();
    },
    onDoubleClick: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault(); event.stopPropagation(); commit(source);
    },
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault(); event.stopPropagation();
      if (!actionFor(source, defaultTarget(source))) return;
      origin.current = event.currentTarget;
      setSelection({ source, label });
      // Native event fields are prototype getters: never spread the event.
      const rect = event.currentTarget.getBoundingClientRect();
      setMenu({ x: Math.max(8, Math.min(event.clientX || rect.left, window.innerWidth - 200)), y: Math.max(8, Math.min(event.clientY || rect.bottom, window.innerHeight - 200)) });
    },
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!actionFor(source, defaultTarget(source))) { event.preventDefault(); return; }
      dragRef.current = source; setDrag(source); setMenu(null);

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", label);
    },
    onDragEnd: endDrag,
  });
  const targetProps = (target: EquipmentTarget) => ({
    "data-equipment-target": target,
    "data-drop-state": drag ? actionFor(drag, target) ? "valid" : "invalid" : undefined,
    "data-drop-over": over === target ? "true" : undefined,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.stopPropagation();
      if (!dragRef.current) return;
      event.preventDefault(); setOver(target);
      event.dataTransfer.dropEffect = actionFor(dragRef.current, target) ? "move" : "none";
    },
    onDragLeave: () => setOver(null),
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault(); event.stopPropagation();
      const source = dragRef.current;
      endDrag();
      if (source) commit(source, target);
    },
  });
  const available = selection && actionFor(selection.source, defaultTarget(selection.source));
  const verb = selection?.source.kind === "worn" ? "Stow" : "Equip";
  const controls = <>
    <p className="mt-2 text-xs text-muted">Drag gear to its slot or back to the backpack. Double-click or right-click for Equip / Stow. Tap to select; with a keyboard, Tab then Enter. Use the Equip / Stow button.</p>
    <div data-testid="equipment-actions" className="sticky top-0 z-10 mt-2 flex min-h-16 items-center gap-2 rounded border border-border bg-surface-2 p-2">
      <span className="min-w-0 flex-1 text-xs text-fg">{available && selection ? selection.label : "Select gear to equip or stow in your backpack."}</span>
      {available && selection && <button type="button" className="min-h-11 shrink-0 rounded border border-gold/50 px-3 text-sm text-gold" onClick={() => commit(selection.source)}>{verb}</button>}
    </div>
    {menu && selection && createPortal(<div className="fixed inset-0 z-[100]" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) closeMenu(); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); closeMenu(); }}>
      <div role="menu" aria-label={`Equipment actions for ${selection.label}`} className="fixed max-h-48 w-48 overflow-y-auto rounded border border-border-strong bg-surface p-1 shadow-xl" style={{ left: menu.x, top: menu.y }} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); closeMenu(); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + 1) % buttons.length]?.focus();
        }
      }}>
        <button type="button" role="menuitem" ref={menuAction} disabled={!available} className="min-h-11 w-full rounded px-3 text-left text-sm text-gold disabled:opacity-40" onClick={() => commit(selection.source)}>{verb} {selection.label}</button>
        <button type="button" role="menuitem" className="min-h-11 w-full rounded px-3 text-left text-sm text-muted" onClick={closeMenu}>Cancel</button>
      </div>
    </div>, document.body)}
  </>;
  return { sourceProps, targetProps, controls, active: Boolean(drag || menu), cancel: () => { endDrag(); closeMenu(); }, };
}
