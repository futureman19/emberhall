import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

export async function captureTreeMotion(page, out, device) {
  const before = await page.evaluate(() => ({ ...window.__treeGPU }));
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({ ...window.__treeGPU }));
  assert(before.shaderSeen && after.time > before.time && after.updates > before.updates, "Actual tree shader clock advances");
  let isolation = { method: "built GPU observation; pixel isolation in dev" };
  if (await page.evaluate(() => !!window.__pondQA?.state)) {
    await page.evaluate(() => window.__pondQA.state.setFrameloop("never"));
    await page.waitForTimeout(120);
    isolation = await page.evaluate(() => {
      const state = window.__pondQA.state;
      const { scene, camera, gl } = state;
      const uniforms = new Set(), roots = new Set();
      scene.traverse(object => {
        for (const material of [object.material].flat()) {
          if (material?.userData.treeWind) uniforms.add(material.userData.treeWind.uTreeWindTime);
        }
        const attr = object.geometry?.getAttribute("pondTreeRoot");
        if (attr) for (let i = 0; i < Math.min(object.count ?? attr.count, attr.count); i++) {
          if (attr.getW(i) > 0) roots.add(`${attr.getX(i)},${attr.getZ(i)}`);
        }
      });
      if (!uniforms.size || !roots.size) throw Error("No enabled tree sway instances");
      const old = [...uniforms].map(u => u.value);
      const context = gl.getContext(), width = context.drawingBufferWidth, height = context.drawingBufferHeight;
      function frame(t) {
        for (const u of uniforms) u.value = t;
        gl.shadowMap.needsUpdate = true;
        gl.render(scene, camera);
        const pixels = new Uint8Array(width * height * 4);
        context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
        return pixels;
      }
      const a = frame(0), b = frame(3), repeat = frame(3);
      let changed = 0, unstable = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.max(...[0, 1, 2].map(j => Math.abs(a[i+j] - b[i+j]))) > 2) changed++;
        if (Math.max(...[0, 1, 2].map(j => Math.abs(b[i+j] - repeat[i+j]))) > 2) unstable++;
      }
      [...uniforms].forEach((u, i) => { u.value = old[i]; });
      state.setFrameloop("always");
      return { method: "frozen scene tree-time only, repeat control, shadows included", roots: [...roots], changed, unstable };
    });
    assert(isolation.roots.length <= 6);
    assert(isolation.changed > 30, "Tree sway produces visible pixels");
    assert.equal(isolation.unstable, 0, "Frozen repeat control stays identical");
  }
  const frames = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(900);
    const file = path.join(out, `${device}-trees-${i}.png`);
    await page.screenshot({ path: file });
    frames.push(file);
  }
  const result = { before, after, isolation, frames };
  fs.writeFileSync(path.join(out, `${device}-trees-probe.json`), JSON.stringify(result, null, 2));
  return result;
}
