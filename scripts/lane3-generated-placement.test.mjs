import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateTiles,placeBuilding} from '../src/game/world.ts';
import {siteError} from '../src/game/building-size.ts';
import {astar} from '../src/game/pathfinding.ts';
const fixture=JSON.parse(fs.readFileSync(new URL('../public/art/phase1-review-save.json',import.meta.url),'utf8'));
const kinds=['dormitory','kitchen','yard','market','forge','tavern','notice','board','farm'];
const evidence=[];
for(const kind of kinds)test(`${kind}: generated terrain reachable placement and commit`,()=>{
 const w=structuredClone(fixture);w.tiles=generateTiles(w.seed);w.buildings=w.buildings.filter(b=>b.kind!==kind);w.gold=100;
 // Missing-kind disposable fixture, unchanged generated terrain; not original-save replay.
 let found;for(let radius=0;radius<=20&&!found;radius++)for(let y=298-radius;y<=298+radius&&!found;y++)for(let x=256-radius;x<=256+radius&&!found;x++){
  if(Math.max(Math.abs(x-256),Math.abs(y-298))!==radius)continue;
  if(siteError(w,kind,x,y)!==null)continue;const path=astar(w,256,298,x,y);if(path)found={x,y,path};
 }
 assert(found,`${kind}: no valid reachable site in bounded search`);
 const before=w.buildings.length,gold=w.gold;assert.equal(placeBuilding(w,kind,found.x,found.y),null);
 assert.equal(w.buildings.length,before+1);assert.equal(w.gold,gold-(kind==='dormitory'?40:28));
 const placed=w.buildings.at(-1);assert.equal(placed.kind,kind);assert.equal(placed.tx,found.x);assert.equal(placed.ty,found.y);
 evidence.push({kind,site:[found.x,found.y],path:found.path,placementPredicate:'pass',navigationSearch:'pass',placementCommit:'pass',ghostRendering:'not-tested',constructionAnimation:'not-tested'});
});
test('explicit acceptance totals and persisted evidence',()=>{
 assert.equal(evidence.length,kinds.length);assert.equal(new Set(evidence.map(x=>x.kind)).size,kinds.length);
 fs.mkdirSync('art/lane3',{recursive:true});fs.writeFileSync('art/lane3/generated-placement.json',JSON.stringify({scope:'Missing-kind disposable fixtures on generated terrain; path search and model commit only, no player traversal or rendering.',expectedKinds:kinds,rows:evidence,totals:{kinds:evidence.length,placementPredicatePassed:evidence.length,navigationSearchPassed:evidence.length,placementCommitPassed:evidence.length,ghostRenderingNotTested:evidence.length,constructionAnimationNotTested:evidence.length}},null,2));
});
