import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { housePanelActive } from "./house-panel.ts";

for (const kind of ["porch", "hut", "homestead"] as const) {
  test(`${kind} routes notifications into its visible panel`, () => {
    assert.equal(housePanelActive([{ id: "h", kind }], "h"), true);
  });
}

test("closed, stale and non-house targets retain global feedback", () => {
  const buildings = [{ id: "h", kind: "hut" }, { id: "b", kind: "bank" }] as const;
  assert.equal(housePanelActive(buildings, null), false);
  assert.equal(housePanelActive([{ id: "", kind: "hut" }], ""), false);
  assert.equal(housePanelActive(buildings, "missing"), false);
  assert.equal(housePanelActive(buildings, "b"), false);
});

test("feedback routing matches the panel's first lookup for ambiguous old IDs", () => {
  assert.equal(housePanelActive([{ id: "h", kind: "bank" }, { id: "h", kind: "hut" }], "h"), false);
});


for (const overlay of ["openBook", "openCraft", "openVault", "openSettings", "openPets"] as const) {
  test(`${overlay} exposes its own controls and global feedback instead of the chest`, () => {
    assert.equal(housePanelActive([{ id: "h", kind: "hut" }], "h", { [overlay]: true }), false);
    assert.equal(housePanelActive([{ id: "h", kind: "hut" }], "h", { [overlay]: false }), true);
  });
}
test("ordinary side panels temporarily hide the chest without changing its ID", () => {
  assert.equal(housePanelActive([{ id: "h", kind: "hut" }], "h", { panel: "you" }), false);
  assert.equal(housePanelActive([{ id: "h", kind: "hut" }], "h", { panel: "none" }), true);
});

test("house shell reserves HUD space, bounds scrolling and keeps Close outside it", () => {
  const source = readFileSync(new URL("./house-gump.tsx", import.meta.url), "utf8");
  assert.match(source, /top-26 left-16/);
  assert.match(source, /max-h-\[calc\(100%-11\.5rem\)\]/);
  assert.match(source, /data-testid="house-chest-content"[^>]*min-h-0[^>]*overflow-y-auto/);
  assert.match(source, /data-testid="house-feedback"[^>]*role="status"/);
  assert.match(source, /mt-3 w-full shrink-0/);
});

test("global toast is suppressed only when the corresponding house panel exists", () => {
  const source = readFileSync(new URL("./hud.tsx", import.meta.url), "utf8");
  assert.match(source, /housePanelActive\(s\.snap\.buildings, s\.openHouseId, s\)/);
  assert.match(source, /if \(!toast \|\| houseOpen\) return null/);
});
