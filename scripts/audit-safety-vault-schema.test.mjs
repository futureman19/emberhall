import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from '../src/game/world.ts';
import { createCraftedItem, createWorkmanshipItem } from '../src/game/rare.ts';
import { applyRedeem, decodeItemInscription, encodeItemInscription, encodeRareInscription, inscriptionBase64 } from '../src/game/vault.ts';
import { SAVE_KEY, loadSave, writeSave } from '../src/game/save.ts';

function exact(w) {
  return createCraftedItem(w, { formId: 'bow', base: 'bow', workmanship: 'exceptional', maker: 'Ada', recipeId: 'bow', recipeVersion: 1,
    components: [{ role: 'body', resourceId: 'redwood', form: 'log', grade: 'choice', amount: 5 }, { role: 'binding', resourceId: 'common_cloth', form: 'cloth', grade: 'sound', amount: 1 }], inlays: [{ resourceId: 'ruby', clarity: 'flawed' }] });
}
for (const rare of [null, false, [], 'rare', {}, { affixes: 'accurate' }, { affixes: [] }, { affixes: ['unknown'] }, { affixes: ['of defense'] }, { affixes: ['accurate', 'surpassingly accurate'] }]) {
  test(`SE03 malformed rare fails closed: ${JSON.stringify(rare)}`, () => {
    const w = createWorld();
    const before = structuredClone(w);
    assert.equal(decodeItemInscription({ ...encodeItemInscription(w, 'sword'), rare }), null);
    assert.throws(() => applyRedeem(w, 'sword', rare));
    assert.deepEqual(structuredClone(w), before);
  });
}
for (const mutation of ['makerless', 'blank maker', 'source', 'base', 'recipe', 'stats', 'affix', 'extra unique']) {
  test(`SE04 exact identity rejects ${mutation}`, () => {
    const w = createWorld();
    const payload = encodeRareInscription(w, exact(w));
    if (mutation === 'makerless') delete payload.rare.maker;
    if (mutation === 'blank maker') payload.rare.maker = ' ';
    if (mutation === 'source') payload.rare.unique.source = 'loot';
    if (mutation === 'base') payload.item = 'sword';
    if (mutation === 'recipe') payload.rare.unique.recipeVersion = 999;
    if (mutation === 'stats') payload.rare.unique.resolvedStats.damage = 999;
    if (mutation === 'affix') payload.rare.affixes = ['of defense'];
    if (mutation === 'extra unique') payload.rare.unique.enchantment = 'lost';
    const before = structuredClone(w);
    assert.equal(decodeItemInscription(payload), null);
    assert.throws(() => applyRedeem(w, payload.item, payload.rare));
    assert.deepEqual(structuredClone(w), before);
  });
}
test('SE04 producers reject utility and partial exact rather than dropping identity', () => {
  const w = createWorld();
  const utility = createWorkmanshipItem(w, 'club', 'fine', 'Ada', 'club');
  assert.ok(utility);
  assert.equal(encodeRareInscription(w, utility), null);
  assert.equal(inscriptionBase64(w, utility.base, utility), null);
  for (const key of ['formId', 'workmanship', 'components', 'inlays', 'resolvedStats', 'recipeId', 'recipeVersion', 'source', 'maker']) {
    const item = exact(w);
    delete item[key];
    assert.equal(encodeRareInscription(w, item), null, key);
  }
  assert.equal(inscriptionBase64(w, 'sword', exact(w)), null);
});
test('SE04 ordinary, legacy and exact decode/redeem/save agreement', () => {
  const w = createWorld();
  const item = exact(w);
  const payload = encodeRareInscription(w, item);
  assert.deepEqual(decodeItemInscription(payload), payload);
  applyRedeem(w, payload.item, payload.rare);
  assert.deepEqual(w.player.rares[0], item);
  const beforeDuplicate = structuredClone(w);
  assert.throws(() => applyRedeem(w, payload.item, payload.rare));
  assert.deepEqual(structuredClone(w), beforeDuplicate);
  const legacy = { app: 'emberhall', v: 2, type: 'item', item: 'sword', rare: { affixes: ['accurate'], maker: 'Ada' } };
  const decoded = decodeItemInscription(legacy);
  assert.ok(decoded?.rare);
  applyRedeem(w, decoded.item, decoded.rare);
  assert.deepEqual(w.player.rares[1].affixes, ['accurate']);
  for (const v of [1, 2, 3]) assert.ok(decodeItemInscription({ app: 'emberhall', v, type: 'item', item: 'sword' }));
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) } });
  try {
    writeSave(w);
    assert.ok(values.get(SAVE_KEY));
    assert.deepEqual(loadSave()?.player.rares, w.player.rares);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
