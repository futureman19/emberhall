import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

export async function captureAutumnMotion(page, out, device) {
  const before = await page.evaluate(() => ({ ...window.__autumnGPU }));
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({ ...window.__autumnGPU }));
  assert(before.shaderSeen && after.time > before.time && after.updates > before.updates, "Autumn leaf shader runs and advances");
  let isolation = { method: "built GPU observation; pixel isolation in dev" };
  if (await page.evaluate(() => !!window.__pondQA?.state)) {
    await page.evaluate(() => window.__pondQA.state.setFrameloop("never"));
    await page.waitForTimeout(120);
    isolation = await page.evaluate(() => {
      const { scene, camera, gl } = window.__pondQA.state;
      let mesh;
      scene.traverse(o => { if (o.name === "emberhall-pond-autumn-leaves" && o.isMesh) mesh = o; });
      if (!mesh) throw Error("Missing autumn particles");
      const time = mesh.material.userData.autumn.uAutumnLeafTime;
      const old = time.value, visible = mesh.visible;
      const ctx = gl.getContext(), w = ctx.drawingBufferWidth, h = ctx.drawingBufferHeight;
      function frame(t, show) {
        time.value = t; mesh.visible = show;
        gl.render(scene, camera);
        const a = new Uint8Array(w*h*4);
        ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, a);
        return a;
      }
      const a = frame(1, true), b = frame(3, true), repeat = frame(3, true), hidden = frame(3, false);
      let changed = 0, unstable = 0, presence = 0;
      for (let i=0; i<a.length; i+=4) {
        if ([0,1,2].some(j=>Math.abs(a[i+j]-b[i+j])>2)) changed++;
        if ([0,1,2].some(j=>Math.abs(b[i+j]-repeat[i+j])>2)) unstable++;
        if ([0,1,2].some(j=>Math.abs(b[i+j]-hidden[i+j])>2)) presence++;
      }
      time.value = old; mesh.visible = visible;
      window.__pondQA.state.setFrameloop("always");
      return { method: "frozen scene leaves only plus repeat/hidden controls", changed, unstable, presence, count: mesh.count };
    });
    assert(isolation.count > 0 && isolation.count <= 24);
    assert(isolation.changed > 10 && isolation.presence > 5, "Leaves visibly render and move");
    assert.equal(isolation.unstable, 0);
  }
  const frames = [];
  for (let i=0; i<3; i++) {
    await page.waitForTimeout(900);
    const file = path.join(out, `${device}-autumn-${i}.png`);
    await page.screenshot({ path: file }); frames.push(file);
  }
  const result = { before, after, isolation, frames };
  fs.writeFileSync(path.join(out, `${device}-autumn-probe.json`), JSON.stringify(result, null, 2));
  return result;
}
