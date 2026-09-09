import test from 'node:test';
import assert from 'node:assert/strict';
import { createNearBiomeCache } from '../src/components/game/near-biome-cache.ts';
import { biomeWeights } from '../src/game/biome.ts';
import { COURT, placeById } from '../src/game/atlas.ts';

test('near biome slots preserve every grid value and bounded identity reuse',()=>{
  const cache=createNearBiomeCache(32761),world={};cache.begin(world);
  for(let z=0;z<181;z++)for(let x=0;x<181;x++){
    const i=z*181+x,wx=184+x*.8,wz=220+z*.8;
    const value=cache.sample(i,wx,wz);
    assert.deepEqual(value,biomeWeights(wx,wz));assert(Object.isFrozen(value));
    assert.equal(cache.sample(i,wx,wz),value);
  }
  assert.equal(cache.size,32761);
  assert.throws(()=>cache.sample(-1,0,0));assert.throws(()=>cache.sample(32761,0,0));
  assert.throws(()=>cache.sample(.5,0,0));assert.throws(()=>cache.sample(0,NaN,0));
  const old=cache.sample(0,10,10);cache.begin(world);assert.equal(cache.sample(0,10,10),old);
  assert.notEqual(cache.sample(0,10.1,10),old);assert.equal(cache.size,32761);
  cache.begin({});assert.equal(cache.size,0);assert.notEqual(cache.sample(0,10,10),old);
});

test('every mutable atlas coordinate invalidates before next rebuild',()=>{
  const cache=createNearBiomeCache(1),world={};
  for(const place of [COURT,...['ridgewatch','wolfhollow','hearthfen','brinegate','southmere'].map(placeById)])for(const axis of ['tx','ty']){
    cache.begin(world);const old=cache.sample(0,240,240),value=place[axis];
    try{place[axis]+=1;cache.begin(world);const fresh=cache.sample(0,240,240);assert.notEqual(fresh,old);assert.deepEqual(fresh,biomeWeights(240,240));}
    finally{place[axis]=value;cache.begin(world);assert.deepEqual(cache.sample(0,240,240),biomeWeights(240,240));}
  }
});

test('cache instances are isolated; invalid capacities rejected',()=>{
  for(const n of [0,-1,1.5,Infinity])assert.throws(()=>createNearBiomeCache(n));
  const a=createNearBiomeCache(1),b=createNearBiomeCache(1);a.begin({});b.begin({});
  assert.notEqual(a.sample(0,0,0),b.sample(0,0,0));
});
