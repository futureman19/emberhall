import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tip — a hover/focus tooltip wrapper. The trigger keeps its own
 * click behavior (equip, buy, mint...); the card just rides along.
 * Hover on desktop, focus-within covers keyboard; touch users get the
 * same info from the row's own text, so nothing is gated behind it.
 */
export function Tip({
  content,
  children,
  className,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom";
}) {
  const [pinned, setPinned] = useState(false);
  if (!content) return <>{children}</>;
  return (
    <span
      className={cn("group/tip relative inline-flex min-w-0", className)}
      onPointerEnter={() => setPinned(true)}
      onPointerLeave={() => setPinned(false)}
    >
      {children}
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2 rounded-[var(--radius-md)] border border-border-strong bg-bg/95 px-3 py-2 text-left shadow-lg transition-opacity duration-100",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          pinned ? "opacity-100" : "opacity-0",
        )}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
