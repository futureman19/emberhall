import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./building-meshes.tsx', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('./lanternwood-kit.ts', import.meta.url), 'utf8');

test('interiors replace loaded prop visuals only, retaining original raycast proxies', () => {
  assert.match(source,/const interiorName = interiorKitName\(b.kind, b.tx, b.ty\)/);
  assert.match(source,/const furnishings = useArtistKit\(interiorName\)/);
  assert.match(source,/furnishings && replaceInteriorVoxel\(b.kind, v\)/);
  assert.match(source,/furnitureProxies\[v.t\]\.push\(p\)/);
  assert.match(source,/items=\{layers.furnitureProxies\[k\]\}[^\n]*pickOnly/);
  assert.match(source,/name=\{`blender-interior-\$\{b.kind\}`\}/);
  assert.match(source,/dispose=\{null\}/);
  assert.match(source,/if \(b.kind === "bank"\)/);
  assert.match(source,/useGame.getState\(\).useStation\(b.id\)/);
});

test('all eight interior kits plus board/notice share the guarded decorative loader', () => {
  for (const kind of ['hall','dormitory','kitchen','yard','market','forge','tavern','bank']) assert(loader.includes(`"interior-${kind}"`),kind);
  assert(loader.includes('"notice"'));
  assert(loader.includes('"board"'));
  assert.match(loader,/o.raycast = noArtRaycast/);
  assert.match(loader,/if \(!active\) return/);
  assert.match(loader,/loads.delete\(name\)/);
  assert.match(source,/commonsKitName\(b.kind, b.tx, b.ty\) \?\? signageKitName/);
});
