import assert from "node:assert/strict";
import test from "node:test";
import { createTouchHold } from "./touch-hold.ts";

function fixture() {
  let scheduled: (() => void) | null = null;
  let eligible = true;
  const calls: string[] = [];
  const hold = createTouchHold({
    schedule: (fn) => { scheduled = fn; return 1; },
    unschedule: () => { scheduled = null; },
    eligible: () => eligible,
    tap: () => calls.push("tap"),
    hold: () => calls.push("hold"),
  });
  const point = { pointerId: 1, pointerType: "touch", clientX: 20, clientY: 30 };
  const begin = () => { hold.trackDown(point); return hold.begin(point, { tx: 10, ty: 11 }); };
  return { hold, calls, point, begin, fire: () => scheduled?.(), disallow: () => { eligible = false; } };
}

test("touch hold - short tap dispatches once at release", () => {
  const f = fixture(); assert.equal(f.begin(), true); assert.deepEqual(f.calls, []);
  f.hold.end(f.point); f.fire(); assert.deepEqual(f.calls, ["tap"]);
});
test("touch hold - elapsed hold opens once without a release tap", () => {
  const f = fixture(); f.begin(); f.fire(); f.fire(); f.hold.end(f.point);
  assert.deepEqual(f.calls, ["hold"]);
});
test("touch hold - drag cancels hold and release tap", () => {
  const f = fixture(); f.begin(); f.hold.move({ ...f.point, clientX: 40 }); f.fire(); f.hold.end(f.point);
  assert.deepEqual(f.calls, []);
});
test("touch hold - another finger cancels and cannot rearm until all release", () => {
  const f = fixture(); f.begin(); const other = { ...f.point, pointerId: 2 };
  f.hold.trackDown(other); assert.equal(f.hold.begin(other, { tx: 10, ty: 11 }), false);
  f.hold.end(f.point); assert.equal(f.hold.begin(other, { tx: 10, ty: 11 }), false);
  f.fire(); f.hold.end(other); assert.deepEqual(f.calls, []);
  assert.equal(f.begin(), true); f.hold.end(f.point); assert.deepEqual(f.calls, ["tap"]);
});
test("touch hold - cancel/dispose leaves no callback", () => {
  const f = fixture(); f.begin(); f.hold.cancel(); f.fire(); f.hold.end(f.point); assert.deepEqual(f.calls, []);
});
test("touch hold - loss of eligibility cannot open or tap", () => {
  const f = fixture(); f.begin(); f.disallow(); f.fire(); f.hold.end(f.point); assert.deepEqual(f.calls, []);
});
test("touch hold - mouse and initially ineligible contacts are not consumed", () => {
  const f = fixture(); assert.equal(f.hold.begin({ ...f.point, pointerType: "mouse" }, { tx: 1, ty: 1 }), false);
  f.disallow(); assert.equal(f.begin(), false); f.fire(); f.hold.end(f.point); assert.deepEqual(f.calls, []);
});
