import { Maximize2, Minimize2, MoveDiagonal2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MiniVale } from "@/components/game/vale-map";
import {
  clampMinimapLayout,
  defaultMinimapLayout,
  loadMinimapLayout,
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
  const suppressMapClick = useRef(false);
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
    event.stopPropagation();
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
    if (!active.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      active.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

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
    event.stopPropagation();
    if (active.kind === "drag") {
      if (active.layout.minimized) suppressRestore.current = active.moved;
      else suppressMapClick.current = active.moved;
    }
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

  const toggleVisual = (expanded: boolean) => (
    <span
      data-testid="minimap-toggle-visual"
      className="flex size-6 items-center justify-center rounded-full border border-border-strong bg-bg/90 text-fg shadow-md backdrop-blur-sm transition-colors hover:text-gold"
    >
      {expanded ? <Minimize2 className="size-3" aria-hidden /> : <Maximize2 className="size-3" aria-hidden />}
    </span>
  );

  if (layout.minimized) {
    return (
      <button
        type="button"
        aria-label="Maximize mini-map"
        title="Maximize mini-map · drag to reposition"
        data-testid="minimap-restore"
        className="pointer-events-auto absolute flex size-11 touch-none items-center justify-center rounded-full bg-transparent"
        style={{
          left: layout.x,
          top: layout.y,
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
        {toggleVisual(false)}
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
        height: layout.size,
        visibility: ready ? "visible" : "hidden",
      }}
    >
      <div
        data-testid="minimap-drag-surface"
        className="size-full cursor-grab touch-none select-none active:cursor-grabbing"
        title="Tap to walk · drag to reposition"
        onPointerDown={begin("drag")}
        onClickCapture={(event) => {
          if (!suppressMapClick.current) return;
          suppressMapClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        {...gestureProps}
      >
        <MiniVale />
      </div>

      <button
        type="button"
        aria-label="Minimize mini-map"
        title="Minimize mini-map"
        className="absolute top-0 right-0 z-30 flex size-11 items-center justify-center rounded-full bg-transparent"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setLayout((current) => clampMinimapLayout({ ...current, minimized: true }, viewport()));
        }}
      >
        {toggleVisual(true)}
      </button>

      <button
        type="button"
        aria-label="Resize mini-map"
        title="Drag to resize mini-map"
        data-testid="minimap-resize-handle"
        className="absolute right-0 bottom-0 z-30 flex size-11 touch-none items-end justify-end bg-gradient-to-tl from-bg/80 to-transparent p-2 text-fg drop-shadow-md"
        onPointerDown={begin("resize")}
        {...gestureProps}
      >
        <MoveDiagonal2 className="size-4" aria-hidden />
      </button>
    </section>
  );
}
