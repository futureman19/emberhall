import type { ReactNode } from "react";
import { usePanelA11y } from "@/components/game/use-panel-a11y";

/** One nonmodal frame: owns focus, Escape, return-to-opener and corner clearance. */
export function DrawerShell({ children, onClose, parchment = false, ...attributes }: {
  children: ReactNode;
  onClose: () => void;
  parchment?: boolean;
  role: "dialog" | "region";
  "aria-label": string;
  "data-testid"?: string;
}) {
  const ref = usePanelA11y<HTMLDivElement>(onClose);
  return (
    <div {...attributes} ref={ref} tabIndex={-1}
      className={`classic-frame drawer-shell drawer-in pointer-events-auto absolute top-3 right-0 bottom-[var(--corner-clear)] w-[min(100%-1rem,22rem)] overflow-auto rounded-l-[var(--radius-lg)] p-4 outline-none${parchment ? " parchment-panel" : ""}`}>
      {children}
    </div>
  );
}
