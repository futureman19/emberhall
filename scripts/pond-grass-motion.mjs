import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

export async function captureGrassMotion(page, out, device) {
  const before = await page.evaluate(() => ({ ...window.__grassGPU }));
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({ ...window.__grassGPU }));
  assert(before.shaderSeen && after.shaderSeen, "Grass vertex shader reached actual GPU");
  assert(after.time > before.time && after.updates > before.updates, "Actual grass time advances on GPU while simulation paused");
  const hasScene = await page.evaluate(() => !!window.__pondQA?.state);
  let isolation = { method: "built-GPU-uniform-observation; pixel isolation covered in dev" };
  if (hasScene) {
    await page.evaluate(() => window.__pondQA.state.setFrameloop("never"));
    await page.waitForTimeout(120);
    isolation = await page.evaluate(() => {
      const state = window.__pondQA.state;
      const { scene, camera, gl } = state;
      let mesh;
      scene.traverse((object) => {
        if (object.isInstancedMesh && object.name === "emberhall-pond-grass") mesh = object;
      });
      if (!mesh) throw Error("Missing actual grass instanced mesh");
      const uniforms = mesh.material.userData.grassWind;
      if (!uniforms?.uGrassTime) throw Error("No inspectable grass clock");
      const original = uniforms.uGrassTime.value;
      const context = gl.getContext();
      const width = context.drawingBufferWidth, height = context.drawingBufferHeight;
      function frame(time, visible) {
        mesh.visible = visible;
        uniforms.uGrassTime.value = time;
        gl.render(scene, camera);
        const data = new Uint8Array(width * height * 4);
        context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, data);
        return data;
      }
      const a = frame(0.7, true), b = frame(2.2, true), hidden = frame(2.2, false);
      let movingPixels = 0, visiblePixels = 0, maxDelta = 0;
      for (let i = 0; i < a.length; i += 4) {
        const delta = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        const presence = Math.max(Math.abs(hidden[i] - b[i]), Math.abs(hidden[i + 1] - b[i + 1]), Math.abs(hidden[i + 2] - b[i + 2]));
        if (delta > 2) movingPixels++;
        if (presence > 2) visiblePixels++;
        maxDelta = Math.max(maxDelta, delta);
      }
      mesh.visible = true;
      uniforms.uGrassTime.value = original;
      state.setFrameloop("always");
      return { method: "frozen-scene-grass-time-only-and-hidden-control", count: mesh.count, movingPixels, visiblePixels, maxDelta, width, height };
    });
    assert(isolation.count > 0, "Instanced grass exists");
    assert(isolation.visiblePixels > 40, "Grass visibly renders at unchanged gameplay camera");
    assert(isolation.movingPixels > 20, "Grass bends on screen, not just CPU/uniform animation");
  }
  const frames = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(900);
    const file = path.join(out, `${device}-grass-${i}.png`);
    await page.screenshot({ path: file });
    frames.push(file);
  }
  const result = { before, after, isolation, frames };
  fs.writeFileSync(path.join(out, device + "-grass-probe.json"), JSON.stringify(result, null, 2));
  return result;
}
