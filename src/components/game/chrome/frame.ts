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

export type FrameMode = "L" | "band";

export function frameMode(viewportWidth: number): FrameMode {
  return viewportWidth >= FRAME_BREAKPOINT ? "L" : "band";
}

/** Small screens start with the map tucked away; the desktop L shows it. */
export function defaultMinimapCollapsed(viewportWidth: number): boolean {
  return frameMode(viewportWidth) === "band";
}
