import { useEffect, useRef } from "react";

/**
 * Shared nonmodal panel behavior: focus enters on open, Escape closes only
 * this layer (propagation stopped), and focus returns to whatever opened it.
 * Not a focus trap — these panels are nonmodal game windows. Pass `active`
 * when the panel stays mounted and renders null while closed.
 */
export function usePanelA11y<T extends HTMLElement>(onEscape: () => void, active = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onEscape();
    };
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [onEscape, active]);
  return ref;
}
