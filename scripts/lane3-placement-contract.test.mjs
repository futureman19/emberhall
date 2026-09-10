import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {siteError} from '../src/game/building-size.ts';
const fixture=JSON.parse(fs.readFileSync(new URL('../public/art/phase1-review-save.json',import.meta.url),'utf8'));
const kinds=['hall','dormitory','kitchen','yard','market','forge','tavern','notice','board','farm','bank'];
for(const kind of kinds) test(`${kind}: unchanged review fixture rejects duplicate, not a navigation failure`,()=>{
 assert(fixture.buildings.some(b=>b.kind===kind));
 assert.equal(siteError(fixture,kind,256,298),`The ${kind} already stands.`);
});
for(const kind of ['hall','bank']) test(`${kind}: prohibited even with no existing buildings`,()=>{
 assert.equal(siteError({buildings:[]},kind,20,20),`The ${kind} already stands.`);
});
// Synthetic UNIT fixture only; never written to a save or used as gameplay acceptance.
for(const kind of kinds.filter(k=>!['hall','bank'].includes(k))) test(`${kind}: missing-kind unit fixture can have valid placement`,()=>{
 const world={gold:100,buildings:[],tiles:Array.from({length:40},()=>Array.from({length:40},()=>({kind:'grass',h:1})))};
 assert.equal(siteError(world,kind,20,20),null);
 world.buildings.push({kind,tx:20,ty:20});
 assert.equal(siteError(world,kind,20,20),`The ${kind} already stands.`);
});
