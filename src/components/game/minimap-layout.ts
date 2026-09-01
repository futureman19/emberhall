export const MINIMAP_STORAGE_KEY = "emberhall-minimap-layout-v1";
export const MIN_MINIMAP_SIZE = 128;
export const MAX_MINIMAP_SIZE = 320;
export const DEFAULT_MINIMAP_SIZE = 160;
export const MINIMAP_HEADER_SIZE = 44;
export const MINIMAP_ICON_SIZE = 44;
export const MINIMAP_VIEWPORT_PADDING = 12;

export type MinimapLayout = {
  x: number;
  y: number;
  size: number;
  minimized: boolean;
};

type Viewport = { width: number; height: number };
type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

const fallbackLayout: MinimapLayout = {
  x: MINIMAP_VIEWPORT_PADDING,
  y: MINIMAP_VIEWPORT_PADDING,
  size: DEFAULT_MINIMAP_SIZE,
  minimized: false,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function isLayout(value: unknown): value is MinimapLayout {
  if (!value || typeof value !== "object") return false;
  const layout = value as Partial<MinimapLayout>;
  return (
    Number.isFinite(layout.x) &&
    Number.isFinite(layout.y) &&
    Number.isFinite(layout.size) &&
    typeof layout.minimized === "boolean"
  );
}

export function clampMinimapLayout(layout: MinimapLayout, viewport: Viewport): MinimapLayout {
  const size = clamp(layout.size, MIN_MINIMAP_SIZE, MAX_MINIMAP_SIZE);
  const width = layout.minimized ? MINIMAP_ICON_SIZE : size;
  const height = layout.minimized ? MINIMAP_ICON_SIZE : size + MINIMAP_HEADER_SIZE;
  return {
    ...layout,
    x: clamp(layout.x, MINIMAP_VIEWPORT_PADDING, viewport.width - width - MINIMAP_VIEWPORT_PADDING),
    y: clamp(layout.y, MINIMAP_VIEWPORT_PADDING, viewport.height - height - MINIMAP_VIEWPORT_PADDING),
    size,
  };
}

export function defaultMinimapLayout(viewport: Viewport): MinimapLayout {
  return clampMinimapLayout(
    {
      x: viewport.width - DEFAULT_MINIMAP_SIZE - MINIMAP_VIEWPORT_PADDING,
      y: viewport.height - DEFAULT_MINIMAP_SIZE - MINIMAP_HEADER_SIZE - 80,
      size: DEFAULT_MINIMAP_SIZE,
      minimized: false,
    },
    viewport,
  );
}

export function loadMinimapLayout(storage: Pick<Storage, "getItem">): MinimapLayout {
  try {
    const raw = storage.getItem(MINIMAP_STORAGE_KEY);
    if (!raw) return { ...fallbackLayout };
    const parsed: unknown = JSON.parse(raw);
    return isLayout(parsed) ? parsed : { ...fallbackLayout };
  } catch {
    return { ...fallbackLayout };
  }
}

export function saveMinimapLayout(storage: Pick<StorageAdapter, "setItem">, layout: MinimapLayout) {
  try {
    storage.setItem(MINIMAP_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // A full or disabled local store must not interrupt the game.
  }
}
