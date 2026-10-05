import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const look = readFileSync(new URL("../src/components/game/look-gump.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/components/game/settings-gump.tsx", import.meta.url), "utf8");

test("looking glass bounds its card to the dynamic viewport with a scroll body", () => {
  assert.ok(look.includes("max-h-[calc(100dvh-2rem)]"));
  assert.ok(look.includes("overflow-y-auto overscroll-contain"));
});

test("the decorative mirror shrinks on short heights without changing its art", () => {
  assert.ok(look.includes("h-[clamp(6rem,30dvh,12rem)]"));
  assert.ok(look.includes("sm:h-[clamp(6rem,55dvh,20rem)]"));
  assert.ok(look.includes("<LookPreview look={preview} parts={wornParts} />"));
});

test("settings dialog bounds its content to short viewports", () => {
  assert.ok(settings.includes("max-h-[calc(100dvh-1.5rem)]"));
  assert.ok(settings.includes("overflow-y-auto overscroll-contain"));
});
