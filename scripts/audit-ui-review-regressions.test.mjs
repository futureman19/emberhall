import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createTouchHold } from "../src/game/touch-hold.ts";
import { clampMenuPosition, menuMaxHeight } from "../src/components/game/menu-bounds.ts";
const read = (p) => readFileSync(new URL(`../src/components/${p}`, import.meta.url), "utf8");
function load(p, mocks) {
  const exports = {};
  const code = ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  Function("require", "exports", code)((id) => { assert.ok(id in mocks, id); return mocks[id]; }, exports);
  return exports;
}
function callback(text, marker) {
  const start = text.indexOf(marker) + marker.length;
  assert.ok(start >= marker.length);
  let depth = 1, i = start;
  while (depth && i < text.length) { if (text[i] === "{") depth++; if (text[i] === "}") depth--; i++; }
  return text.slice(start, i - 1);
}

test("actual intercepting mesh callbacks share hold/tap/drag/multicontact arbitration", () => {
  const effects = [], timers = new Map(); let serial = 0, primary = 0, secondary = [];
  const win = new EventTarget();
  win.setTimeout = (fn) => { timers.set(++serial, fn); return serial; };
  win.clearTimeout = (id) => timers.delete(id);
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = win; globalThis.document = new EventTarget();
  const state = { phase: "playing", buildKind: null, tillArmed: false, select: () => primary++, useStation: () => primary++, openCtx: (_x, _y, target) => secondary.push(target.id) };
  const pointer = { leftAt: () => primary++, hitAt: (x,y) => secondary.push(`${x},${y}`) };
  const hooks = { useEffect: (fn) => effects.push(fn), useMemo: (fn) => fn(), useRef: (value) => ({ current: value }) };
  const touch = load("game/use-world-touch.ts", { react: hooks, "@/game/store": { useGame: { getState: () => state } }, "@/game/touch-hold": { createTouchHold }, "@/game/world-pointer": pointer });
  const terrain = touch.useWorldTouch(); const cleanup = effects.map((fn) => fn());
  const event = (id = 1, x = 10) => ({ pointerType: "touch", pointerId: id, button: 0, clientX: x, clientY: 10, point: { x: 4, z: 5 }, stopPropagation() {} });
  const send = (kind, e) => win.dispatchEvent(Object.assign(new Event(kind), e));
  const crop = read("game/crop-meshes.tsx");
  const building = read("game/building-meshes.tsx");
  const make = (body, vars) => Function(...Object.keys(vars), `return (e) => {${body}}`)(...Object.values(vars));
  const common = { beginWorldTouch: touch.beginWorldTouch, ...pointer, useGame: { getState: () => state }, getWorld: () => ({ people: [{ role: "banker", id: "pell", x: 4, z: 5 }] }), stationOf: (kind) => kind === "forge", CROP_META: { wheat: { label: "wheat" } } };
  const routes = [
    ["crop", make(callback(crop, "onPointerDown={(e) => {"), { ...common, plot: { id: "plot-exact", tx: 4, ty: 5, crop: "wheat" } }), "plot-exact"],
    ["sapling", make(callback(crop.slice(crop.indexOf("function YoungTree")), "onPointerDown={(e) => {"), { ...common, sapling: { tx: 4, ty: 5 } }), "4,5"],
    ...["keep", "bank", "forge"].map((kind) => [kind, make(callback(building, "onPointerDown={(e) => {"), { ...common, inside: kind === "keep", b: { kind, id: `${kind}-exact`, tx: 4, ty: 5 } }), kind === "keep" ? "4,5" : `${kind}-exact`]),
    ...["beast", "ground", "water"].map((kind) => [kind, (e) => terrain(e.nativeEvent, { tx: 4, ty: 5 }), "4,5"]),
  ];
  try {
    for (const [name, route, identity] of routes) {
      for (const mode of ["hold", "tap", "drag", "second"]) {
        primary = 0; secondary = [];
        const e = event(); e.nativeEvent = e;
        send("pointerdown", e); route(e);
        assert.equal(primary, 0, `${name} must defer primary`);
        if (mode === "drag") send("pointermove", event(1, 40));
        if (mode === "second") send("pointerdown", event(2));
        if (mode !== "tap") { for (const fn of [...timers.values()]) fn(); timers.clear(); }
        send("pointerup", e); if (mode === "second") send("pointerup", event(2));
        assert.equal(primary, mode === "tap" ? 1 : 0, `${name}/${mode}`);
        assert.deepEqual(secondary, mode === "hold" ? [identity] : [], `${name}/${mode} identity`);
      }
    }
  } finally { cleanup.forEach((fn) => fn?.()); globalThis.window = oldWindow; globalThis.document = oldDocument; }
});

test("actual storm block preserves thunder/RNG and clears an existing reduced flash", () => {
  const source = read("game/lighting.tsx");
  const body = source.slice(source.indexOf('    const storm ='), source.indexOf('    const ambI ='));
  const tick = Function("effectsReduced", "Math", "skyFlash", "thunderIn", "playSfx", "pit", "w", "dt", body);
  for (const reduced of [false, true]) {
    let calls = 0, sounds = 0; const flash = { v: 1 }, thunder = { current: 0 };
    const math = { random: () => { calls++; return 0; }, max: Math.max };
    tick(() => reduced, math, flash, thunder, () => sounds++, false, { weather: { kind: "storm" } }, 0.1);
    assert.equal(calls, 2); assert.equal(thunder.current, 0.24999999999999997);
    assert.equal(flash.v > 0, !reduced);
    for (let i = 0; i < 3; i++) tick(() => reduced, math, flash, thunder, () => sounds++, false, {}, 0.1);
    assert.equal(sounds, 1);
  }
});

test("native panel Escape dismisses sibling Inspect layer before closing panel", () => {
  const effects = []; let close = 0, restored = 0, detailOpen = true;
  class Element extends EventTarget { focus() {} }
  const panel = new Element(), detail = new Element();
  detail.addEventListener("dismiss-tip", () => { detailOpen = false; });
  panel.querySelector = () => detailOpen ? detail : null;
  const oldDoc = globalThis.document, oldElement = globalThis.HTMLElement;
  const trigger = new Element(); trigger.isConnected = true; trigger.focus = () => restored++;
  globalThis.HTMLElement = Element; globalThis.document = { activeElement: trigger };
  try {
    const hook = load("game/use-panel-a11y.ts", { react: { useRef: () => ({ current: panel }), useEffect: (fn) => effects.push(fn) } });
    hook.usePanelA11y(() => close++); const cleanup = effects[0]();
    const escape = () => panel.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" }));
    escape(); assert.equal(detailOpen, false); assert.equal(close, 0);
    escape(); assert.equal(close, 1); cleanup(); assert.equal(restored, 1);
  } finally { globalThis.document = oldDoc; globalThis.HTMLElement = oldElement; }
});

test("constrained menu edges remain in bounds after shrinking viewport", () => {
  for (const viewport of [{ width: 1440, height: 960 }, { width: 150, height: 120 }, { width: 740, height: 320 }]) {
    const size = { width: Math.min(200, viewport.width - 16), height: Math.min(344, menuMaxHeight(viewport)) };
    const pos = clampMenuPosition({ x: 1400, y: 900 }, size, viewport);
    assert.ok(pos.x >= 8 && pos.y >= 8);
    assert.ok(pos.x + size.width <= viewport.width - 8);
    assert.ok(pos.y + size.height <= viewport.height - 8);
  }
});

test("title Keep and Escape cancel without starting, then restore focus after remount", () => {
  const title = read("game/hud.tsx").split("function TitleOverlay()")[1].split("function RaisingOverlay()")[0];
  let confirm = true, focused = 0;
  const restoreNewFocus = { current: false }, newButton = { current: null }, keepButton = { current: null };
  const cancel = Function("restoreNewFocus", "setConfirmNew", `return () => {${callback(title, "const cancelNew = () => {")}}`)(restoreNewFocus, (value) => { confirm = value; });
  const effect = callback(title.slice(title.indexOf("const cancelNew")), "useEffect(() => {");
  for (const mode of ["Keep", "Escape"]) {
    confirm = true; newButton.current = null;
    if (mode === "Keep") cancel();
    else {
      const body = callback(title.slice(title.indexOf('role="alertdialog"')), "onKeyDown={(e) => {");
      Function("e", "cancelNew", body)({ key: "Escape", preventDefault() {}, stopPropagation() {} }, cancel);
    }
    assert.equal(confirm, false); assert.equal(newButton.current, null);
    newButton.current = { focus: () => focused++ };
    Function("confirmNew", "keepButton", "restoreNewFocus", "newButton", effect)(confirm, keepButton, restoreNewFocus, newButton);
    assert.equal(restoreNewFocus.current, false);
  }
  assert.equal(focused, 2);
});

test("menu resize updates viewport even when measured dimensions do not change", () => {
  const text = read("game/context-menu.tsx");
  const body = callback(text, "const measure = () => {");
  let viewport, measured = { width: 100, height: 90 };
  const el = { getBoundingClientRect: () => ({ width: 100, height: 90 }) };
  const win = { innerWidth: 1440, innerHeight: 960 };
  const measure = Function("window", "el", "setViewport", "setMeasured", body);
  const run = () => measure(win, el, (v) => { viewport = v; }, (fn) => { measured = fn(measured); });
  const original = measured; run(); assert.equal(viewport.width, 1440);
  win.visualViewport = { width: 150, height: 120, offsetLeft: 4, offsetTop: 6 };
  run(); assert.equal(measured, original); assert.deepEqual(viewport, { width: 150, height: 120, x: 4, y: 6 });
});

test("actual Tip native dismissal clears controlled Inspect and local visibility", () => {
  const effects = []; let local = true, dismissed = 0;
  const element = new EventTarget();
  const jsx = (_type, props) => props;
  const { Tip } = load("ui/tip.tsx", {
    react: { useEffect: (fn) => effects.push(fn), useRef: () => ({ current: element }), useState: () => [local, (v) => { local = v; }], useId: () => "tip-id", isValidElement: () => false, cloneElement: () => {} },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "@/lib/utils": { cn: (...s) => s.join(" ") },
  });
  const props = Tip({ content: "item", children: "trigger", pin: true, onDismiss: () => dismissed++ });
  assert.equal(props["data-tip-open"], true);
  const cleanup = effects[0](); element.dispatchEvent(new Event("dismiss-tip"));
  assert.equal(local, false); assert.equal(dismissed, 1); cleanup();
});
