import { cloneElement, isValidElement, useId, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tip — a hover/focus tooltip wrapper. The trigger keeps its own
 * click behavior (equip, buy, mint...); the card just rides along.
 * Hover shows it, keyboard focus shows it (focus-within), Escape
 * dismisses it, and the trigger names it via aria-describedby.
 * Touch users get a separate Inspect affordance from the row —
 * pass `pin` to hold the card open without overloading the action.
 */
export function Tip({
  content,
  children,
  className,
  side = "top",
  pin = false,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom";
  pin?: boolean;
}) {
  const [pinned, setPinned] = useState(false);
  const tipId = useId();
  if (!content) return <>{children}</>;
  const open = pinned || pin;
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { "aria-describedby": tipId })
    : children;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && pinned) {
      e.stopPropagation();
      setPinned(false);
    }
  };
  return (
    <span
      className={cn("group/tip relative inline-flex min-w-0", className)}
      onPointerEnter={() => setPinned(true)}
      onPointerLeave={() => setPinned(false)}
      onFocusCapture={() => setPinned(true)}
      onBlurCapture={() => setPinned(false)}
      onKeyDown={onKeyDown}
    >
      {trigger}
      {open && (
        <span
          id={tipId}
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2 rounded-[var(--radius-md)] border border-border-strong bg-bg/95 px-3 py-2 text-left shadow-lg",
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  );
}
