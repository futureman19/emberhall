import { ITEM_META } from "./catalog.ts";
import { parseResourceStackKey } from "./inventory/resources.ts";
import { RESOURCE_CATALOG } from "./resources/catalog.ts";
import type { ItemId, World } from "./types.ts";

/**
 * The test kit is a QA aid, not a game feature: while the flag is on, every
 * FRESH character starts with the whole catalog — a full stack of every item,
 * every resource form at every quality, and a fat purse for vendor testing.
 * Toggle it with ?testkit=1 / ?testkit=0 (persisted on this device) or the
 * __emberTestKit console handle. Existing progress is topped up, never reset.
 */

export const TEST_KIT_ITEM_STACK = 99;
export const TEST_KIT_RESOURCE_STACK = 25;
export const TEST_KIT_GOLD = 100_000;

const STORAGE_KEY = "emberhall:testkit";

/** Mirrors the private ladders in inventory/resources.ts; keys are validated through parseResourceStackKey, so a drift fails loud. */
const GRADE_QUALITIES = ["rough", "sound", "choice", "pristine"] as const;
const CLARITY_QUALITIES = ["cracked", "flawed", "cut", "flawless", "perfect"] as const;

export interface TestKitSummary {
  items: number;
  stacks: number;
  gold: number;
}

export function grantEverything(world: World): TestKitSummary {
  const ids = Object.keys(ITEM_META) as ItemId[];
  for (const id of ids) {
    world.player.pack[id] = Math.max(world.player.pack[id] ?? 0, TEST_KIT_ITEM_STACK);
  }
  let stacks = 0;
  for (const definition of Object.values(RESOURCE_CATALOG)) {
    const qualities = definition.qualityType === "clarity" ? CLARITY_QUALITIES : GRADE_QUALITIES;
    for (const form of definition.forms) {
      for (const quality of qualities) {
        const key = parseResourceStackKey(`${definition.id}:${form}:${quality}`);
        const current = world.player.resources.stacks[key] ?? 0;
        // Only ever store positive counts — the inventory is sparse by design.
        if (current < TEST_KIT_RESOURCE_STACK) {
          world.player.resources.stacks[key] = TEST_KIT_RESOURCE_STACK;
        }
        stacks += 1;
      }
    }
  }
  world.gold = Math.max(world.gold, TEST_KIT_GOLD);
  return { items: ids.length, stacks, gold: world.gold };
}

export function testKitEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTestKit(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or a locked-down embed: the kit just stays off.
  }
}

/**
 * Folds the URL into the persisted flag. Returns the new state when the URL
 * carries an explicit ?testkit=1 or ?testkit=0, null when it says nothing.
 */
export function syncTestKitFromUrl(search: string): boolean | null {
  const raw = new URLSearchParams(search).get("testkit");
  if (raw === "1") {
    setTestKit(true);
    return true;
  }
  if (raw === "0") {
    setTestKit(false);
    return false;
  }
  return null;
}

if (typeof window !== "undefined") {
  (window as unknown as { __emberTestKit?: unknown }).__emberTestKit = {
    on: () => setTestKit(true),
    off: () => setTestKit(false),
    enabled: testKitEnabled,
  };
}
