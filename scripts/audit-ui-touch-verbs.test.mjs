import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const terrain = readFileSync(new URL("../src/components/game/terrain.tsx", import.meta.url), "utf8");
const worldTouch = readFileSync(new URL("../src/components/game/use-world-touch.ts", import.meta.url), "utf8");
const hud = readFileSync(new URL("../src/components/game/hud.tsx", import.meta.url), "utf8");

test("general touch hold reuses the cancellable hold contract", () => {
  assert.ok(worldTouch.includes("createTouchHold"));
  assert.ok(worldTouch.includes("tap: (tile: WorldTouchTile) => tile.tap ? tile.tap() : leftAt(tile.tx, tile.ty)"));
  assert.ok(worldTouch.includes("hitAt(tile.tx, tile.ty, point.clientX, point.clientY)"));
  // Same play-state guards as the specialized hooks: no build/till interference.
  assert.ok(worldTouch.includes('state.phase === "playing" && !state.buildKind && !state.tillArmed'));
  // Same lifecycle cancellation as the specialized hooks.
  for (const token of ["pointercancel", "visibilitychange", "blur", "trackDown", "hold.cancel()"]) {
    assert.ok(worldTouch.includes(token), token);
  }
});

test("the hold release cannot activate or dismiss the menu it opened", () => {
  // The releasing finger fires one compatibility click at the hold point;
  // it is swallowed, and any genuine later click disarms via its pointerdown.
  assert.ok(worldTouch.includes("swallowReleaseClick"));
  assert.ok(worldTouch.includes('window.addEventListener("click", click, true)'));
  assert.ok(worldTouch.includes('window.addEventListener("pointerdown", disarm, true)'));
  assert.ok(worldTouch.includes("e.preventDefault();"));
  assert.ok(worldTouch.includes("e.stopPropagation();"));
});

test("terrain tries specialized hooks first, then the general touch path", () => {
  assert.ok(
    terrain.includes("if (e.button === 0 && (ghostwoodTouch(e, t) || houseTouch(e, t) || worldTouch(e, t))) return;"),
  );
  // Primary actions stay on the same single path.
  assert.ok(terrain.includes('else if (e.button === 0 && useGame.getState().phase === "playing") leftAt(t.tx, t.ty);'));
  assert.ok(terrain.includes("if (e.button === 2) hitAt(t.tx, t.ty, e.clientX, e.clientY);"));
});

test("the guide teaches the touch gesture instead of right-click only", () => {
  assert.ok(hud.includes("touch-and-hold opens the same menu a right-click does"));
  assert.ok(!/Hold the fishing rod and right-click\n/.test(hud));
  assert.ok(!hud.includes("Right-click a live beast and Tame"));
});
