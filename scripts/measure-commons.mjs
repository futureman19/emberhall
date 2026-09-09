import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Box3, Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const base = new URL('../public/art/lanternwood/', import.meta.url);
const url = new URL('commons-manifest.json', base);
const manifest = JSON.parse(await readFile(url, 'utf8'));
for (const kit of ['dormitory', 'yard', 'farm']) {
  const bytes = await readFile(new URL(`${kit}.glb`, base));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const materials = new Set(), palette = new Set();
  let triangles = 0, vertices = 0, meshes = 0, lights = 0;
  gltf.scene.traverse(o => {
    if (o.isLight) lights++;
    if (!(o instanceof Mesh)) return;
    meshes++;
    const p = o.geometry.getAttribute('position'), c = o.geometry.getAttribute('color');
    assert.ok(c);
    for (const v of p.array) assert.ok(Number.isFinite(v));
    vertices += p.count;
    triangles += (o.geometry.index?.count ?? p.count) / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(m.uuid);
      assert.ok(m.vertexColors && !m.map);
      for (let i = 0; i < c.count; i++) palette.add(m.color.toArray().map((v, k) => (v*c.getComponent(i,k)).toFixed(4)).join(','));
    }
  });
  const b = new Box3().setFromObject(gltf.scene);
  const measurement = { bytes: bytes.length, triangles, vertices, meshes, materials: materials.size, paletteColors: palette.size, bounds: {min:b.min.toArray(),max:b.max.toArray()}, noLights: lights===0, noAnimations:gltf.animations.length===0, measurement:'Actual GLTFLoader world-space bounds and primitive counts' };
  assert.ok(bytes.length<=600000 && triangles<=12000 && materials.size<=2 && palette.size>=4 && lights===0);
  Object.assign(manifest[kit], measurement);
  console.log(JSON.stringify({kit,...measurement,sourceParts:manifest[kit].parts.length}));
}
await writeFile(url, JSON.stringify(manifest,null,2)+'\n');
