import assert from "node:assert/strict";
import test from "node:test";
import {
  BAND_HEIGHT,
  CHROME_GAP,
  FRAME_BREAKPOINT,
  RAIL_WIDTH,
  defaultMinimapCollapsed,
  frameMode,
} from "./frame.ts";

test("frameMode: below the breakpoint the chrome is a bottom band only", () => {
  assert.equal(frameMode(390), "band");
  assert.equal(frameMode(FRAME_BREAKPOINT - 1), "band");
});

test("frameMode: at and above the breakpoint the chrome is the full L frame", () => {
  assert.equal(frameMode(FRAME_BREAKPOINT), "L");
  assert.equal(frameMode(1440), "L");
});

test("frame geometry leaves room for 44px touch targets plus padding", () => {
  assert.ok(BAND_HEIGHT >= 56, `band ${BAND_HEIGHT}px must fit a 44px row`);
  assert.ok(RAIL_WIDTH >= 56, `rail ${RAIL_WIDTH}px must fit a 44px column`);
  assert.ok(CHROME_GAP >= 4, "panels need a visible gap from the frame");
});

test("breakpoint matches Tailwind md so classes and logic agree", () => {
  assert.equal(FRAME_BREAKPOINT, 768);
});

test("minimap starts collapsed only in band mode", () => {
  assert.equal(defaultMinimapCollapsed(390), true);
  assert.equal(defaultMinimapCollapsed(FRAME_BREAKPOINT - 1), true);
  assert.equal(defaultMinimapCollapsed(FRAME_BREAKPOINT), false);
  assert.equal(defaultMinimapCollapsed(1440), false);
});
