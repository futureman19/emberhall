/**
 * Persistence for the docked minimap's collapsed flag. Plain "1"/"0" storage —
 * anything unreadable falls back to the caller's default instead of breaking
 * the HUD (private mode, corrupted values, node tests with no window).
 */
export const MINIMAP_DOCK_KEY = "emberhall-minimap-dock-v1";

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export function dockStorage(): StorageAdapter | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadCollapsed(storage: StorageAdapter, fallback: boolean): boolean {
  try {
    const raw = storage.getItem(MINIMAP_DOCK_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveCollapsed(storage: StorageAdapter, collapsed: boolean): void {
  try {
    storage.setItem(MINIMAP_DOCK_KEY, collapsed ? "1" : "0");
  } catch {
    // Private mode or quota — the map still works, it just forgets.
  }
}
