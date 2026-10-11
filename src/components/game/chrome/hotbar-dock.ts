/**
 * The hotbar's assignments — which items sit in the quick slots. Pure UI
 * layout, kept in guarded localStorage like the minimap dock: never world
 * state, so a stale slot can only grey out, never corrupt a save.
 * A tiny pub/sub lets the pack's Pin button and the bar stay in step
 * without dragging a store into chrome.
 */
import { ITEM_META } from "../../../game/catalog.ts";
import type { ItemId } from "../../../game/types.ts";

export const HOTBAR_KEY = "emberhall-hotbar-v1";
export const HOTBAR_SLOTS = 6;

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export function dockStorage(): StorageAdapter | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function pinItem(ids: readonly ItemId[], id: string): ItemId[] {
  if (!Object.hasOwn(ITEM_META, id)) return [...ids];
  if (ids.includes(id as ItemId) || ids.length >= HOTBAR_SLOTS) return [...ids];
  return [...ids, id as ItemId];
}

export function unpinItem(ids: readonly ItemId[], id: string): ItemId[] {
  return ids.filter((x) => x !== id);
}

export function loadHotbar(storage: StorageAdapter): ItemId[] {
  try {
    const raw = storage.getItem(HOTBAR_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is ItemId => typeof id === "string" && Object.hasOwn(ITEM_META, id)).slice(0, HOTBAR_SLOTS);
  } catch {
    return [];
  }
}

export function saveHotbar(storage: StorageAdapter, ids: readonly ItemId[]): void {
  try {
    storage.setItem(HOTBAR_KEY, JSON.stringify(ids.slice(0, HOTBAR_SLOTS)));
    notify();
  } catch {
    // Private mode or quota — the bar still works, it just forgets.
  }
}

const listeners = new Set<() => void>();
export function subscribeHotbar(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify(): void {
  for (const fn of listeners) fn();
}
