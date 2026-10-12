import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

/** Diagnostic-only inspection of the actual served React/R3F root, dev or built. */
export async function capturePondMotion(page, out, device) {
  const access = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas");
    if (performance.getEntriesByType("resource").some((entry) => entry.name.includes("/@vite/client"))) {
      const response = await fetch("/src/components/game/world-scene.tsx");
      if (response.ok) {
        const source = await response.text();
        const match = source.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);
        if (match) {
          const fiber = await import(match[1]);
          const state = fiber._roots?.get(canvas)?.store?.getState();
          if (state) { window.__pondQA = { state }; return { available: true, method: "exact-dev-module" }; }
        }
      }
    }
    const queue = [];
    for (let n = canvas; n; n = n.parentElement) {
      if (n.__r3f) queue.push(n.__r3f);
      for (const key of Object.keys(n)) if (key.startsWith("__reactFiber") || key.startsWith("__reactContainer")) queue.push(n[key]);
    }
    const seen = new Set();
    for (let i = 0; queue.length && i < 80000; i++) {
      const node = queue.pop();
      if (!node || !["object", "function"].includes(typeof node) || seen.has(node)) continue;
      seen.add(node);
      if (node.camera && node.scene && node.gl?.domElement === canvas) {
        window.__pondQA = { state: node };
        return { available: true };
      }
      if (typeof node.getState === "function") {
        const state = node.getState();
        if (state?.camera && state?.scene && state?.gl?.domElement === canvas) {
          window.__pondQA = { state };
          return { available: true };
        }
      }
      for (const key of ["child", "sibling", "return", "stateNode", "memoizedState", "next", "memoizedProps", "__r3f", "root", "store", "current", "value", "children", "_currentValue", "_currentValue2", "containerInfo", "props", "dependencies", "firstContext", "memoizedValue", "context"]) {
        if (node[key] && ["object", "function"].includes(typeof node[key])) queue.push(node[key]);
      }
      if (Array.isArray(node)) queue.push(...node.slice(0, 100));
      if (node !== window && !(node instanceof Node) && !ArrayBuffer.isView(node)) {
        for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(node))) {
          if (descriptor.value && ["object", "function"].includes(typeof descriptor.value)) queue.push(descriptor.value);
        }
      }
    }
    return { available: false };
  });
  if (!access.available) {
    const before = await page.evaluate(() => ({ ...window.__pondGPU }));
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({ ...window.__pondGPU }));
    assert(before.shaderSeen && after.shaderSeen, "Built shader contains pond implementation");
    assert.equal(after.enabled, 1);
    assert(after.time > before.time && after.updates > before.updates, "Actual built WebGL program receives advancing pond time");
    const frames = [];
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(1300);
      const file = path.join(out, `${device}-water-${i}.png`);
      await page.screenshot({ path: file });
      frames.push(file);
    }
    const result = { method: "built-WebGL-uniform-observation-and-rendered-frames", before, after, frames, frozenPixelIsolation: "covered in dev; root inaccessible in this optimized build" };
    fs.writeFileSync(path.join(out, device + "-motion-probe.json"), JSON.stringify(result, null, 2));
    return result;
  }
  const materialProbe = await page.evaluate(() => {
    const meshes = [];
    window.__pondQA.state.scene.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        if (/pond/i.test(object.name + material.name) || Object.keys(material.userData).some((key) => /pond/i.test(key))) {
          meshes.push({ name: object.name, materialName: material.name, materialType: material.type, uniforms: Object.keys(material.uniforms ?? {}), userData: Object.keys(material.userData) });
        }
      }
    });
    return meshes;
  });
  assert(materialProbe.length, "Pond material must be identifiable in actual scene");
  const clockBefore = await page.evaluate(() => {
    let uniforms;
    window.__pondQA.state.scene.traverse((object) => {
      if (object.material?.name === "emberhall-starter-pond-water") uniforms = object.material.userData.pondWater;
    });
    if (!uniforms) throw Error("No active pond uniforms");
    window.__pondQA.uniforms = uniforms;
    return { time: uniforms.uPondTime.value, enabled: uniforms.uPondEnabled.value };
  });
  assert.equal(clockBefore.enabled, 1);
  await page.waitForTimeout(700);
  const clockAfter = await page.evaluate(() => window.__pondQA.uniforms.uPondTime.value);
  assert(clockAfter > clockBefore.time, "Actual render clock advances while simulation is paused");
  await page.evaluate(() => window.__pondQA.state.setFrameloop("never"));
  await page.waitForTimeout(120);
  const pixels = await page.evaluate(() => {
    const { state, uniforms } = window.__pondQA;
    const { gl, scene, camera } = state;
    const context = gl.getContext();
    const width = context.drawingBufferWidth, height = context.drawingBufferHeight;
    const corners = [[247, 301], [253, 301], [247, 307], [253, 307]].map(([x, z]) => {
      const p = camera.position.clone().set(x, 0, z).project(camera);
      return { x: (p.x + 1) * width / 2, y: (p.y + 1) * height / 2 };
    });
    const bounds = {
      x0: Math.floor(Math.min(...corners.map(p => p.x))) - 12,
      x1: Math.ceil(Math.max(...corners.map(p => p.x))) + 12,
      y0: Math.floor(Math.min(...corners.map(p => p.y))) - 12,
      y1: Math.ceil(Math.max(...corners.map(p => p.y))) + 12,
    };
    function frame(t) {
      uniforms.uPondTime.value = t;
      gl.render(scene, camera);
      const data = new Uint8Array(width * height * 4);
      context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, data);
      return data;
    }
    const original = uniforms.uPondTime.value;
    const a = frame(1), b = frame(2.4);
    let inside = 0, outside = 0, maxDelta = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const delta = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (delta > 2) {
        maxDelta = Math.max(maxDelta, delta);
        if (x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1) inside++;
        else outside++;
      }
    }
    uniforms.uPondTime.value = original;
    state.setFrameloop("always");
    return { inside, outside, maxDelta, bounds, width, height, method: "only-pond-time-changed-frozen-scene-direct-GPU-readback" };
  });
  assert(pixels.inside > 20, "Water motion changes visible pond pixels, not just a CPU clock");
  assert.equal(pixels.outside, 0, "Time-only animation stays inside projected pond footprint");
  const frames = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(1300);
    const file = path.join(out, `${device}-water-${i}.png`);
    await page.screenshot({ path: file });
    frames.push(file);
  }
  fs.writeFileSync(path.join(out, device + "-motion-probe.json"), JSON.stringify({ access, materialProbe, clockBefore, clockAfter, pixels, frames }, null, 2));
  return { access, materialProbe, clockBefore, clockAfter, pixels, frames };
}
