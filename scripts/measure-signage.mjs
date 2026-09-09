import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function measureSignage() {
  const assets = {};
  for (const kit of ['notice', 'board']) {
    const bytes = readFileSync(resolve(root, `public/art/lanternwood/${kit}.glb`));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    assert.equal(gltf.animations.length, 0);
    gltf.scene.updateMatrixWorld(true);
    const bounds = new Box3(); const materials = new Set(); let triangles = 0; let meshes = 0;
    gltf.scene.traverse(o => {
      assert.ok(!o.isLight && !o.isCamera);
      if (!o.isMesh) return;
      meshes++;
      assert.deepEqual(o.position.toArray(), [0, 0, 0]);
      assert.deepEqual(o.scale.toArray(), [1, 1, 1]);
      assert.deepEqual(o.quaternion.toArray(), [0, 0, 0, 1]);
      const p = o.geometry.getAttribute('position');
      assert.ok(o.geometry.getAttribute('color'), 'vertex palette required');
      for (let i = 0; i < p.count; i++) {
        const v = new Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        assert.ok(v.toArray().every(Number.isFinite)); bounds.expandByPoint(v);
      }
      triangles += (o.geometry.index?.count ?? p.count) / 3;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m.uuid);
    });
    const min = bounds.min.toArray(), max = bounds.max.toArray();
    const xmin = kit === 'notice' ? -.5 : -1.5, xmax = kit === 'notice' ? 1 : 2;
    assert.ok(min[0] >= xmin - 1e-5 && max[0] <= xmax + 1e-5);
    assert.ok(min[2] >= -1e-5 && max[2] <= 1.5 + 1e-5);
    assert.ok(Math.abs(min[1]) < 1e-5 && max[1] > 1.5 && max[1] <= (kit === 'board' ? 2 : 3));
    assert.ok(meshes > 0 && materials.size <= 2 && triangles <= 2500 && bytes.length <= 150000, JSON.stringify({kit, meshes, materials: materials.size, triangles, bytes: bytes.length}));
    assets[kit] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), triangles, meshes, materials: materials.size, bounds: { min, max }, pivot: [0,0,0], yUp: true };
  }
  return { source: 'art/blender/signage-kit.blend', anchor: '[tx, groundY, ty], identity rotation and scale', assets };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await measureSignage();
  if (process.argv.includes('--write')) writeFileSync(resolve(root, 'public/art/lanternwood/signage-manifest.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
