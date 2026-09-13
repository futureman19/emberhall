import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hud = readFileSync(new URL("../src/components/game/hud.tsx", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const title = hud.split("function TitleOverlay()")[1].split("function RaisingOverlay()")[0];

test("new hall confirmation gates both the capture handler and React clicks", () => {
  // One shared decision path used by document capture and onClick.
  assert.ok(title.includes("const requestStartRef = useRef(requestStart)"));
  assert.ok(title.includes('requestStartRef.current(hit.getAttribute("data-start") === "new")'));
  assert.ok((title.match(/onClick=\{\(\) => requestStart\((true|false)\)\}/g) ?? []).length === 2);
  // The capture handler never starts a hall directly anymore.
  assert.ok(!title.includes("startHall(hit.getAttribute"), "no direct startHall in the capture handler");
});

test("confirmation opens without busy and never starts on the opening tap", () => {
  assert.ok(title.includes('setConfirmNew(true);\n      return "confirming";'));
  assert.ok(title.includes("swallowClick.current = true"));
  // Only the explicit confirm button may start a fresh hall.
  const confirmStarts = title.match(/startHall\(true\)/g) ?? [];
  assert.equal(confirmStarts.length, 1);
  assert.ok(title.includes("Keep my hall"));
  assert.ok(title.includes("Erase it and start anew"));
  assert.ok(title.includes('role="alertdialog"'));
  assert.ok(title.includes("Replace the saved hall?"));
  // Default-safe cancel receives entry focus.
  assert.ok(title.includes("keepButton.current?.focus()"));
});

test("startup failure is rendered and announced on the title path", () => {
  assert.ok(title.includes('const startError = useGame((s) => s.toast)'));
  assert.ok(title.includes('role="alert"'));
  assert.ok(title.includes("Your hall is untouched — try again."));
});
