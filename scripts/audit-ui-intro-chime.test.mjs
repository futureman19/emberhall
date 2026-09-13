import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const intro = readFileSync(new URL("../src/components/game/intro-cinematic.tsx", import.meta.url), "utf8");

test("intro chime honors the shared sfx preference", () => {
  assert.ok(intro.includes('import { sfxMuted } from "@/game/vale-sfx"'));
  assert.ok(intro.includes("if (sfxMuted()) return;"));
  assert.ok(intro.includes('ctx.state === "suspended" && !sfxMuted()'));
});

test("component-owned audio context is closed on unmount", () => {
  assert.ok(intro.includes("ctx.close().catch(() => {})"));
  assert.ok(intro.includes("ctxRef.current = null"));
});

test("suspended contexts resume under the live gesture instead of staying silent", () => {
  assert.ok(intro.includes("ctx.resume().then(emit).catch(() => {})"));
  assert.ok(intro.includes("ctx.resume().catch(() => {})"));
});
