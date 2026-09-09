import test from 'node:test';
import assert from 'node:assert/strict';
import { createMinimapBiomeCache } from '../src/components/game/minimap-biome-cache.ts';
import { biomeWeights } from '../src/game/biome.ts';
test('fixed minimap grid preserves exact biome weights and bounds storage',()=>{let calls=0;const get=createMinimapBiomeCache(512,256,(x,y)=>{calls++;return biomeWeights(x,y)});for(let y=0;y<256;y++)for(let x=0;x<256;x++)assert.deepEqual(get(x,y),biomeWeights(x*2,y*2));assert.equal(calls,65536);const first=get(12,34);assert(Object.isFrozen(first));assert.strictEqual(first,get(12,34));assert.equal(calls,65536);for(const xy of [[-1,0],[256,0],[0,256],[.5,0],[NaN,0]])assert.throws(()=>get(...xy),RangeError);assert.equal(calls,65536)});
test('separate sampler instances do not share values',()=>{const a=createMinimapBiomeCache(512,256,()=>biomeWeights(1,2)),b=createMinimapBiomeCache(512,256,()=>biomeWeights(400,450));assert.notDeepEqual(a(0,0),b(0,0));assert.throws(()=>createMinimapBiomeCache(512,0),RangeError)});
