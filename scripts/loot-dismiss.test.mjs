import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/game/context-menu.tsx',import.meta.url),'utf8').split('export function PileGump()')[1];
test('loot dismiss is an accessible button that only clears UI selection',()=>{assert.match(source,/<button type="button" aria-label="Close loot" onClick=\{\(\) => useGame\.setState\(\{ openPileId: null \}\)\}/);});
test('loot panel bounds its scroll area while retaining reachable controls',()=>{for(const token of ['max-h-[calc(100dvh-5rem)]','min-h-11 min-w-11','min-h-0 space-y-1 overflow-y-auto','w-full shrink-0'])assert.ok(source.includes(token),token);assert.match(source,/onClick=\{\(\) => take\(pile.id\)\}/);});

test('loot feedback is in bounded panel flow',()=>{assert.match(source,/role="status" className="mt-2 max-h-20 shrink-0 overflow-y-auto/);});
test('global notification defers only to an existing open pile',()=>{const hud=readFileSync(new URL('../src/components/game/hud.tsx',import.meta.url),'utf8');assert.ok(hud.includes('s.snap.piles.some((p) => p.id === s.openPileId)'));assert.ok(hud.includes('if (!toast || houseOpen) return null'));assert.ok(hud.includes('if (pileOpen) return null'));});
