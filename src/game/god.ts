/**
 * God mode — a QA lantern, not a game rule. `?god=1` lights it and the
 * choice is written down, so a plain refresh keeps it; `?god=0` lays it
 * down. While lit, the world's keeper (live.ts) tops every skill to 100 on
 * load and tickMana keeps the well full.
 */
const KEY = "ember-god";

/** Durable provenance: switching the URL cannot turn sandbox goods real. */
export function isSandbox(world: object): boolean {
  return "sandbox" in world && world.sandbox === true;
}

export interface GodStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  clear(key: string): void;
}

let override: boolean | null = null;

/** Test hook: pin the flag (null hands it back to the URL and storage). */
export function setGodOverride(value: boolean | null): void {
  override = value;
}

function browserStorage(): GodStorage | null {
  if (typeof window === "undefined") return null;
  return {
    get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* URL still selects the isolated slot. */ } },
    clear: (k) => { try { window.localStorage.removeItem(k); } catch { /* Explicit URL takes precedence. */ } },
  };
}

export function godModeEnabled(search?: string, storage?: GodStorage): boolean {
  if (override != null) return override;
  const q = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const store = storage ?? browserStorage();
  const params = new URLSearchParams(q);
  if (params.get("god") === "1") {
    store?.set(KEY, "1");
    return true;
  }
  if (params.get("god") === "0") {
    store?.clear(KEY);
    return false;
  }
  return store?.get(KEY) === "1";
}
