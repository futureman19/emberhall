import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { floraRollEligible } from '../src/components/game/flora-eligibility.ts';

test('flora guard never rejects output from actual biome-specific selection',()=>{
  const source=fs.readFileSync('src/components/game/terrain.tsx','utf8');
  const start=source.indexOf('if (wooded) flora =');const end=source.indexOf('if (flora >= 0)',start);
  assert(start>0&&end>start);
  const choose=Function('wooded','climate','roll','kind','hash2','let flora=-1;const tx=0,ty=0,w={seed:0},t={kind};'+source.slice(start,end)+'return flora;');
  const thresholds=[0,.01,.011,.012,.016,.018,.019,.022,.025,.028,.03,.031,.034,.04,.05,.08,.1,.14,1];
  const rolls=[...new Set(thresholds.flatMap(x=>[x-Number.EPSILON,x,x+Number.EPSILON]))];
  for(const wooded of [false,true])for(const climate of ['vale','tundra','taiga','fen','jungle','desert'])for(const kind of ['grass','sand','snow','marsh','tree'])for(const roll of rolls){
    const flora=choose(wooded,climate,roll,kind,()=>roll);
    if(flora>=0)assert(floraRollEligible(wooded,roll),JSON.stringify({wooded,climate,kind,roll,flora}));
  }
  assert.equal(floraRollEligible(false,.05),false);assert.equal(floraRollEligible(true,.14),false);
  assert.equal(floraRollEligible(false,.05-Number.EPSILON),true);assert.equal(floraRollEligible(true,.14-Number.EPSILON),true);
});
