import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the vale scene lays cemetery mist on Greybarrow", () => {
  const source = readFileSync(new URL("./world-scene.tsx", import.meta.url), "utf8");
  assert.match(source, /<CemeteryMist \/>/);
  assert.match(source, /from "\.\/cemetery-mist"/);
});

test("ruins ask terrain for extra thorn", () => {
  const source = readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  assert.match(source, /inRuins/);
  assert.match(source, /ruinsExtraThorn/);
  assert.match(source, /COL_THORN/);
});
