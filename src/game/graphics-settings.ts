import { useEffect, useState } from "react";

export const GRAPHICS_STORAGE_KEY = "emberhall-graphics-v1";
export const HORIZON_TREE_REDUCTIONS = [0, 15, 30] as const;
export type HorizonTreeReduction = (typeof HORIZON_TREE_REDUCTIONS)[number];

export type GraphicsSettings = {
  shadows: boolean;
  horizonTreeReduction: HorizonTreeReduction;
  /** Calmer presentation: no storm flashes, suppressed transient action FX. */
  reducedEffects: boolean;
  /** Eye-height look. Click-to-walk stays. Default is the tactical orbit. */
  firstPerson: boolean;
};

export const DEFAULT_GRAPHICS_SETTINGS: Readonly<GraphicsSettings> = Object.freeze({
  shadows: true,
  horizonTreeReduction: 0,
  reducedEffects: false,
  firstPerson: false,
});

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

function isGraphicsSettings(value: unknown): value is GraphicsSettings {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  // Saves written before reducedEffects / firstPerson existed load with
  // the approved defaults (effects on, tactical orbit).
  return (
    keys.every(
      (key) =>
        key === "shadows" ||
        key === "horizonTreeReduction" ||
        key === "reducedEffects" ||
        key === "firstPerson",
    ) &&
    typeof record.shadows === "boolean" &&
    HORIZON_TREE_REDUCTIONS.includes(record.horizonTreeReduction as HorizonTreeReduction) &&
    (record.reducedEffects === undefined || typeof record.reducedEffects === "boolean") &&
    (record.firstPerson === undefined || typeof record.firstPerson === "boolean")
  );
}

export function loadGraphicsSettings(storage: ReadStorage): GraphicsSettings {
  try {
    const raw = storage.getItem(GRAPHICS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GRAPHICS_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    return isGraphicsSettings(parsed)
      ? {
          ...parsed,
          reducedEffects: parsed.reducedEffects ?? false,
          firstPerson: parsed.firstPerson ?? false,
        }
      : { ...DEFAULT_GRAPHICS_SETTINGS };
  } catch {
    return { ...DEFAULT_GRAPHICS_SETTINGS };
  }
}

export function saveGraphicsSettings(storage: WriteStorage, settings: GraphicsSettings) {
  try {
    storage.setItem(GRAPHICS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Graphics preferences are optional when storage is unavailable or full.
  }
}

let current: GraphicsSettings = { ...DEFAULT_GRAPHICS_SETTINGS };
let hydrated = false;
const listeners = new Set<(settings: GraphicsSettings) => void>();

function publish() {
  for (const listener of listeners) listener(current);
}

export function hydrateGraphicsSettings() {
  if (hydrated || typeof window === "undefined") return current;
  current = loadGraphicsSettings(window.localStorage);
  hydrated = true;
  publish();
  return current;
}

export function getGraphicsSettings() {
  return current;
}

export function updateGraphicsSettings(patch: Partial<GraphicsSettings>) {
  const next: GraphicsSettings = {
    shadows: typeof patch.shadows === "boolean" ? patch.shadows : current.shadows,
    horizonTreeReduction: HORIZON_TREE_REDUCTIONS.includes(patch.horizonTreeReduction as HorizonTreeReduction)
      ? (patch.horizonTreeReduction as HorizonTreeReduction)
      : current.horizonTreeReduction,
    reducedEffects: typeof patch.reducedEffects === "boolean" ? patch.reducedEffects : current.reducedEffects,
    firstPerson: typeof patch.firstPerson === "boolean" ? patch.firstPerson : current.firstPerson,
  };
  current = next;
  hydrated = true;
  if (typeof window !== "undefined") saveGraphicsSettings(window.localStorage, next);
  publish();
  return next;
}

export function useGraphicsSettings() {
  const [settings, setSettings] = useState<GraphicsSettings>(DEFAULT_GRAPHICS_SETTINGS);
  useEffect(() => {
    const listener = (next: GraphicsSettings) => setSettings({ ...next });
    listeners.add(listener);
    listener(hydrateGraphicsSettings());
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return settings;
}
