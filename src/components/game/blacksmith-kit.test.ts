import assert from "node:assert/strict";
import test from "node:test";
import { PLACEABLE_BY_ID } from "../../game/placeables/catalog.ts";
import { canPlace, placedBox } from "../../game/placeables/placement.ts";
import { createStubWorld } from "../../game/world.ts";

const ids = ["smith_anvil", "smith_forge", "smith_trough", "smith_grindstone", "smith_rack", "smith_bellows"];
test("six smith decorations are reachable through the ordinary Hold catalog", () => {
  for (const id of ids) {
    const def = PLACEABLE_BY_ID[id];
    assert.ok(def, id);
    assert.equal(def.category, "work");
    assert.equal(def.fn, undefined, "Decoration must not silently enable crafting");
    assert.ok(def.description.includes("decorative"));
    const w = createStubWorld();
    w.player.ghost = false;
    w.player.pack.board = 100;
    w.player.pack.ingot = 100;
    for (const rotation of def.rotations) {
      assert.equal(canPlace(w, id, 100, 100, rotation), null);
      const b = placedBox(id, 100, 100, rotation);
      assert.ok(b.x1 > b.x0 && b.z1 > b.z0);
    }
    w.player.ghost = true;
    assert.equal(canPlace(w, id, 100, 100, 0), "A ghost cannot.");
  }
});
