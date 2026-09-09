import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../../../public/art/phase1-preview.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert(script);
const kinds = ['hall','dormitory','kitchen','yard','market','forge','tavern','notice','board','farm','bank'];
function launch(buildings = kinds.map(kind => ({kind})), hostname = '127.0.0.1') {
  const store = new Map<string, string>();
  const handlers: Record<string, () => Promise<void> | void> = {};
  const nodes: Record<string, {disabled?: boolean; hidden?: boolean; textContent?: string; addEventListener: (type: string, callback: () => Promise<void> | void) => void}> = {};
  for (const id of ['#enter','#restore','#status']) nodes[id] = {addEventListener: (_type, callback) => {handlers[id] = callback;}};
  const navigation: string[] = [];
  vm.runInNewContext(script!, {
    document: {querySelector: (id: string) => nodes[id]},
    location: {hostname, assign: (path: string) => navigation.push(path)},
    localStorage: {getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key,value), removeItem: (key: string) => store.delete(key)},
    fetch: async () => ({ok:true, text:async () => JSON.stringify({buildings})}),
  });
  return {store, handlers, nodes, navigation};
}

test('Phase 1 launcher validates all eleven kinds before replacing any save', async () => {
  for (const absent of kinds) {
    const harness = launch(kinds.filter(kind => kind !== absent).map(kind => ({kind})));
    harness.store.set('emberhall-save-v4','original');
    await harness.handlers['#enter']();
    assert.equal(harness.store.get('emberhall-save-v4'),'original');
    assert.equal(harness.store.has('emberhall-phase1-review-backup-v1'),false);
    assert.deepEqual(harness.navigation,[]);
    assert.match(harness.nodes['#status'].textContent ?? '',/Invalid review fixture/);
  }
});

test('Phase 1 launcher backs up once and restores the exact prior save', async () => {
  const h = launch();
  h.store.set('emberhall-save-v4','original');
  await h.handlers['#enter']();
  await h.handlers['#enter']();
  assert.equal(JSON.parse(h.store.get('emberhall-phase1-review-backup-v1')!).original,'original');
  h.handlers['#restore']();
  assert.equal(h.store.get('emberhall-save-v4'),'original');
  assert.equal(h.store.has('emberhall-phase1-review-backup-v1'),false);
});

test('Phase 1 launcher restores absent save and blocks the production-domain button', async () => {
  const h = launch();
  await h.handlers['#enter']();
  h.handlers['#restore']();
  assert.equal(h.store.has('emberhall-save-v4'),false);
  assert.equal(launch(undefined,'emberhall-vale.vercel.app').nodes['#enter'].disabled,true);
  assert.match(html,/Boards and furnishings add no new quests, sleep, training or harvesting mechanics/);
  assert.doesNotMatch(html,/commons-review-save|hospitality-review-save/);
});
