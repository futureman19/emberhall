import { Color, ColorManagement } from "three";

/** Fixed palette only: callers copy entries, never mutate them. */
export function createTerrainPalette<K extends string>(colors: Readonly<Record<K, string>>) {
  const values = { ...colors };
  let palette: Record<K, Color> | undefined;
  let enabled: boolean | undefined;
  let space: string | undefined;
  return () => {
    if (!palette || enabled !== ColorManagement.enabled || space !== ColorManagement.workingColorSpace) {
      enabled = ColorManagement.enabled;
      space = ColorManagement.workingColorSpace;
      palette = Object.fromEntries(
        Object.entries<string>(values).map(([key, value]) => [key, new Color().set(value)]),
      ) as Record<K, Color>;
    }
    return palette;
  };
}
