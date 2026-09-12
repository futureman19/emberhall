import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shallow} from 'zustand/vanilla/shallow';
const source=readFileSync(new URL('../src/components/game/campfire-meshes.tsx',import.meta.url),'utf8');
test('campfires subscribe through cached shallow membership copies',()=>{
 assert.match(source,/useGame\(useShallow\(\(s\) => s\.snap\.campfires\.slice\(\)\)\)/);
 assert.match(source,/import \{ useShallow \} from "zustand\/react\/shallow"/);
});
test('copied fire membership detects in-place creation and removal without unrelated rerenders',()=>{
 const fires=[];const before=fires.slice();const fire={id:'fire-test',tx:1,ty:2,until:3};
 fires.push(fire);const created=fires.slice();assert.equal(shallow(before,created),false);
 assert.equal(shallow(created,fires.slice()),true);
 fires.splice(0,1);assert.equal(shallow(created,fires.slice()),false);
 fires.push({...fire});assert.equal(shallow(created,fires.slice()),false,'same ID replacement must repaint');
});
