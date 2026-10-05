/** Measured context-menu placement: clamp both edges to the usable viewport. */

export type MenuPoint = { x: number; y: number };
export type MenuSize = { width: number; height: number };
export type MenuViewport = { width: number; height: number };

export const MENU_VIEWPORT_MARGIN = 8;
/** Pre-measurement fallback bounds (replaced by real measurements on mount). */
export const MENU_FALLBACK_WIDTH = 180;
export const MENU_FALLBACK_HEIGHT = 220;

export function clampMenuPosition(
  point: MenuPoint,
  size: MenuSize,
  viewport: MenuViewport,
  margin = MENU_VIEWPORT_MARGIN,
): MenuPoint {
  const maxX = Math.max(margin, viewport.width - size.width - margin);
  const maxY = Math.max(margin, viewport.height - size.height - margin);
  return {
    x: Math.min(Math.max(point.x, margin), maxX),
    y: Math.min(Math.max(point.y, margin), maxY),
  };
}

/** Tallest list the menu may show before its own scroll takes over. */
export function menuMaxHeight(viewport: MenuViewport, margin = MENU_VIEWPORT_MARGIN) {
  return Math.max(0, viewport.height - margin * 2);
}
