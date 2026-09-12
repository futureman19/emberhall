// Actual GLB anatomy review at normalized scale; NOT gameplay/performance proof.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const [url = 'http://127.0.0.1:8123', family = 'architecture', label = 'v1'] = process.argv.slice(2);
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
assert.match(family, /^(architecture|timber|fauna)$/); assert.match(label, /^[a-z0-9-]+$/);
const folder = path.resolve('public/art/lanternwood');
const files = fs.readdirSync(folder).filter(f => f.startsWith(family + '-') && f.endsWith('.glb')).sort();
assert(files.length > 0);
const out = path.resolve('art/verification/worldwide', `${family}-gallery-${label}`);
assert(!fs.existsSync(path.join(out, 'results.json'))); fs.mkdirSync(out, { recursive: true });
const result = { url, family, files, hashes: Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(folder, f))).digest('hex')])), scope: 'Normalized-scale exported GLB anatomy, not composed gameplay bounds', captures: [], errors: [] };
const flush = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => result.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
  await page.route('**/worldwide-asset-qa', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script></head><body style="margin:0;background:#222b21;color:#eee5ca;font:16px Georgia"><canvas></canvas><div id="labels"></div></body></html>' }));
  await page.goto(url + '/worldwide-asset-qa');
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1440, 1000); renderer.setPixelRatio(1); renderer.setScissorTest(true);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
    window.__gallery = { THREE, loader: new GLTFLoader(), renderer };
  });
  for (let offset = 0; offset < files.length; offset += 8) {
    const batch = files.slice(offset, offset + 8);
    const metrics = await page.evaluate(async batch => {
      const { THREE, loader, renderer } = window.__gallery;
      document.querySelector('#labels').replaceChildren();
      renderer.setViewport(0, 0, 1440, 1000); renderer.setScissor(0, 0, 1440, 1000); renderer.setClearColor('#222b21'); renderer.clear();
      const results = [];
      for (let i = 0; i < batch.length; i++) {
        const gltf = await loader.loadAsync('/art/lanternwood/' + batch[i]);
        const scene = new THREE.Scene(); scene.background = new THREE.Color('#394638');
        const ambient = new THREE.HemisphereLight('#fff5dc', '#485144', 2); scene.add(ambient);
        const key = new THREE.DirectionalLight('#ffebcc', 3); key.position.set(-4, 8, 6); scene.add(key);
        const fill = new THREE.DirectionalLight('#c6def1', 1); fill.position.set(6, 3, -4); scene.add(fill);
        scene.add(gltf.scene); const auxiliary = []; gltf.scene.traverse(o => { if (/_sapling|_stump/.test(o.name)) auxiliary.push(o); }); auxiliary.forEach(o => o.removeFromParent()); const box = new THREE.Box3().setFromObject(gltf.scene), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) * .66;
        const camera = new THREE.PerspectiveCamera(36, 360 / 470, .01, 1000);
        camera.position.copy(center).add(new THREE.Vector3(1, .7, 1.6).normalize().multiplyScalar(radius * 3.7)); camera.lookAt(center);
        const x = (i % 4) * 360, y = Math.floor(i / 4) * 500;
        renderer.setViewport(x, 1000 - y - 470, 360, 470); renderer.setScissor(x, 1000 - y - 470, 360, 470); renderer.render(scene, camera);
        const label = document.createElement('div'); label.textContent = batch[i].replace('.glb', ''); Object.assign(label.style, { position: 'absolute', top: `${y + 474}px`, left: `${x + 8}px`, fontSize: '14px' }); document.querySelector('#labels').append(label);
        results.push({ file: batch[i], bounds: { min: box.min.toArray(), max: box.max.toArray() }, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
        scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
      }
      return results;
    }, batch);
    const name = `${family}-${offset / 8}.png`;
    await page.screenshot({ path: path.join(out, name) }); result.captures.push({ name, metrics }); flush();
  }
  assert.equal(result.captures.flatMap(c => c.metrics).length, files.length);
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors)); result.passed = true;
} catch (e) { result.passed = false; result.failure = e.stack; process.exitCode = 1; }
finally { flush(); await browser.close(); }
console.log(JSON.stringify({ passed: result.passed, count: files.length, errors: result.errors, failure: result.failure, out }));
