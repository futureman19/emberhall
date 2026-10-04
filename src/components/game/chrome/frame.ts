/**
 * L-frame geometry: a bottom band that turns the corner and continues up the
 * right edge as a vertical rail. Below the breakpoint the rail folds away and
 * only the band remains. Keep Tailwind classes in the chrome components in
 * agreement with these constants — the breakpoint mirrors `md:`.
 */
export const BAND_HEIGHT = 60;
export const RAIL_WIDTH = 60;
export const CHROME_GAP = 8;
export const FRAME_BREAKPOINT = 768;
/** The mini-map's corner block: the band ends at its left edge, the rail at its top. */
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
 * edge: just above the band when the map is tucked away, above the corner
 * block when it is docked. Mirrors the `bottom-[68px]` / `bottom-[120px]`
 * classes and the `--corner-clear` variable on the overlay root.
 */
export function cornerClearance(mapOpen: boolean): number {
  return (mapOpen ? MINIMAP_CORNER : BAND_HEIGHT) + CHROME_GAP;
}
