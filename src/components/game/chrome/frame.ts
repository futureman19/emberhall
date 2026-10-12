/**
 * Floating chrome geometry: no carved frame — glass plates hover over the 3D
 * view and the only fixed block is the docked mini-map corner. Keep Tailwind
 * classes in the chrome components in agreement with these constants — the
 * breakpoint mirrors `md:`.
 */
export const RAIL_WIDTH = 60;
export const CHROME_GAP = 8;
export const FRAME_BREAKPOINT = 768;
/** The mini-map's corner block: the only fixed chrome, bottom-right. */
export const MINIMAP_CORNER = 112;

export type FrameMode = "L" | "band";

export function frameMode(viewportWidth: number): FrameMode {
  return viewportWidth >= FRAME_BREAKPOINT ? "L" : "band";
}

/** Small screens start with the map tucked away; the desktop L shows it. */
export function defaultMinimapCollapsed(viewportWidth: number): boolean {
  return frameMode(viewportWidth) === "band";
}

/**
 * How far floating chrome (panels, cards, banners) must stay off the bottom
 * edge: just the gap when the map is tucked away, above the corner block
 * when it is docked. Backs the `--corner-clear` variable on the overlay root.
 */
export function cornerClearance(mapOpen: boolean): number {
  return (mapOpen ? MINIMAP_CORNER : 0) + CHROME_GAP;
}
