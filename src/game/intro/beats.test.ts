// beats.test.ts — content contract for the intro script.
//
// Run: node --experimental-strip-types --test src/game/intro/beats.test.ts
// (package.json wiring lands at merge time — coordination rule 1.)

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { INTRO_BEATS } from "./beats.ts";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "..", "..", "public");

test("intro has 4-6 beats with unique ids", () => {
  assert.ok(INTRO_BEATS.length >= 4 && INTRO_BEATS.length <= 6);
  const ids = INTRO_BEATS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every beat has bounded title and text", () => {
  for (const beat of INTRO_BEATS) {
    assert.ok(beat.title.length >= 2 && beat.title.length <= 40, `${beat.id} title`);
    assert.ok(beat.text.length >= 20 && beat.text.length <= 220, `${beat.id} text`);
  }
});

test("every beat's art file exists under public/", () => {
  for (const beat of INTRO_BEATS) {
    assert.ok(beat.art.startsWith("/art/"), `${beat.id} art path`);
    assert.ok(existsSync(join(publicDir, beat.art)), `missing ${beat.art}`);
  }
});

test("only the final beat carries a call to action", () => {
  INTRO_BEATS.slice(0, -1).forEach((b) => assert.equal(b.cta, undefined));
  const last = INTRO_BEATS[INTRO_BEATS.length - 1]!;
  assert.ok(last.cta && last.cta.length <= 32);
});
