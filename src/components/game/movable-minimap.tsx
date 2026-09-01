import { GripHorizontal, Map, Minimize2, MoveDiagonal2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MiniVale } from "@/components/game/vale-map";
import {
  clampMinimapLayout,
  defaultMinimapLayout,
  loadMinimapLayout,
  MINIMAP_HEADER_SIZE,
  MINIMAP_ICON_SIZE,
  MINIMAP_STORAGE_KEY,
  saveMinimapLayout,
  type MinimapLayout,
} from "@/components/game/minimap-layout";
import { useGame } from "@/game/store";

type Gesture = {
  kind: "drag" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  layout: MinimapLayout;
  moved: boolean;
};

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

export function MovableMinimap() {
  const panel = useGame((s) => s.panel);
  const openBook = useGame((s) => s.openBook);
  const openCraft = useGame((s) => s.openCraft);
  const [layout, setLayout] = useState<MinimapLayout>({ x: 12, y: 12, size: 160, minimized: false });
  const [ready, setReady] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const suppressRestore = useRef(false);

  useEffect(() => {
    const hasSavedLayout = localStorage.getItem(MINIMAP_STORAGE_KEY) !== null;
    const initial = hasSavedLayout ? loadMinimapLayout(localStorage) : defaultMinimapLayout(viewport());
    setLayout(clampMinimapLayout(initial, viewport()));
    setReady(true);

    const onResize = () => setLayout((current) => clampMinimapLayout(current, viewport()));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (ready) saveMinimapLayout(localStorage, layout);
  }, [layout, ready]);

  if (panel === "vale" || openBook || openCraft) return null;

  const begin = (kind: Gesture["kind"]) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      layout,
      moved: false,
    };
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) active.moved = true;

    setLayout(
      clampMinimapLayout(
        active.kind === "drag"
          ? { ...active.layout, x: active.layout.x + dx, y: active.layout.y + dy }
          : { ...active.layout, size: active.layout.size + Math.max(dx, dy) },
        viewport(),
      ),
    );
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    suppressRestore.current = active.moved;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const gestureProps = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  };

  if (layout.minimized) {
    return (
      <button
        type="button"
        aria-label="Restore mini-map"
        title="Restore mini-map · drag to reposition"
        data-testid="minimap-restore"
        className="pointer-events-auto absolute flex items-center justify-center rounded-[var(--radius-md)] border border-border-strong bg-bg/90 text-gold shadow-lg backdrop-blur-sm touch-none"
        style={{
          left: layout.x,
          top: layout.y,
          width: MINIMAP_ICON_SIZE,
          height: MINIMAP_ICON_SIZE,
          visibility: ready ? "visible" : "hidden",
        }}
        onPointerDown={begin("drag")}
        {...gestureProps}
        onClick={(event) => {
          event.stopPropagation();
          if (suppressRestore.current) {
            suppressRestore.current = false;
            return;
          }
          setLayout((current) => clampMinimapLayout({ ...current, minimized: false }, viewport()));
        }}
      >
        <Map className="size-5" aria-hidden />
      </button>
    );
  }

  return (
    <section
      aria-label="Mini-map"
      data-testid="movable-minimap"
      className="pointer-events-auto absolute overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-bg/90 shadow-lg backdrop-blur-sm"
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.size,
        height: layout.size + MINIMAP_HEADER_SIZE,
        visibility: ready ? "visible" : "hidden",
      }}
    >
      <div
        data-testid="minimap-drag-handle"
        className="flex h-11 touch-none items-center justify-between border-b border-border bg-surface/95 pl-3 text-muted select-none"
        title="Drag to reposition mini-map"
        onPointerDown={begin("drag")}
        {...gestureProps}
      >
        <span className="flex items-center gap-2 font-display text-xs tracking-wider uppercase">
          <GripHorizontal className="size-4" aria-hidden />
          Vale
        </span>
        <button
          type="button"
          aria-label="Minimize mini-map"
          title="Minimize mini-map"
          className="flex size-11 items-center justify-center text-muted transition-colors hover:text-fg"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setLayout((current) => clampMinimapLayout({ ...current, minimized: true }, viewport()));
          }}
        >
          <Minimize2 className="size-4" aria-hidden />
        </button>
      </div>

      <div style={{ width: layout.size, height: layout.size }}>
        <MiniVale />
      </div>

      <button
        type="button"
        aria-label="Resize mini-map"
        title="Drag to resize mini-map"
        data-testid="minimap-resize-handle"
        className="absolute right-0 bottom-0 flex size-11 touch-none items-end justify-end bg-gradient-to-tl from-bg/80 to-transparent p-2 text-fg drop-shadow-md"
        onPointerDown={begin("resize")}
        {...gestureProps}
      >
        <MoveDiagonal2 className="size-4" aria-hidden />
      </button>
    </section>
  );
}
