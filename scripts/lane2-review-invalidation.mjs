import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createLane2DirtyGround,createLane2Buffers,lane2FillAll} from '../../emberhall-phase2-performance-v2/src/components/game/lane2-dirty-ground.ts';
import {generateTiles} from '../../emberhall-phase2-performance-v2/src/game/world.ts';
import {placeById} from '../../emberhall-phase2-performance-v2/src/game/atlas.ts';
const world={tiles:generateTiles(7)},rows=[];
const cache=createLane2DirtyGround(),first=createLane2Buffers();cache.candidate(world,256,290,first);
const replacement=createLane2Buffers(),fresh=createLane2Buffers();const replaced=cache.candidate(world,256,290,replacement);lane2FillAll(world,256,290,fresh);
const differences=(a,b)=>Object.keys(a).reduce((n,k)=>n+a[k].reduce((v,x,i)=>v+(Object.is(x,b[k][i])?0:1),0),0);
rows.push({case:'replacement buffers',mode:replaced.mode,differences:differences(replacement,fresh)});
const ridge=placeById('ridgewatch'),old={tx:ridge.tx,ty:ridge.ty};const cache2=createLane2DirtyGround(),buf=createLane2Buffers();cache2.candidate(world,256,290,buf);
try{ridge.tx=256;ridge.ty=290;const result=cache2.candidate(world,256,290,buf);const reference=createLane2Buffers();lane2FillAll(world,256,290,reference);rows.push({case:'biome anchor mutation',mode:result.mode,differences:differences(buf,reference)});}finally{Object.assign(ridge,old)}
assert(rows.every(r=>r.mode==='skip'&&r.differences>0),'Expected review repro did not reproduce');fs.mkdirSync('art/lane2-review',{recursive:true});fs.writeFileSync('art/lane2-review/reproduced-gaps.json',JSON.stringify({scope:'Negative reproductions against isolated proposal; not runtime regression',rows},null,2));console.log(JSON.stringify(rows));
