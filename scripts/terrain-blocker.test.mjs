import test from 'node:test';import assert from 'node:assert/strict';
import { createTerrainBlocker } from '../src/components/game/terrain-blocker.ts';
import { buildingBox } from '../src/game/building-size.ts';
import { BUILD_SIZE } from '../src/game/building-size.ts';
const old=(w,x,y)=>{if(w.plots)for(const p of w.plots)if(p.tx===x&&p.ty===y)return true;for(const b of w.buildings){const a=buildingBox(b.kind,b.tx,b.ty);if(x+.5>a.x0&&x+.5<a.x1&&y+.5>a.z0&&y+.5<a.z1)return true}return false};
test('prepared terrain blocker matches strict plot and building boundaries',()=>{for(const kind of Object.keys(BUILD_SIZE)){const w={plots:[{tx:10,ty:11}],buildings:[{kind,tx:16,ty:16}]},blocked=createTerrainBlocker(w);for(let y=8;y<24;y+=.5)for(let x=8;x<24;x+=.5)assert.equal(blocked(x,y),old(w,x,y),`${kind} ${x},${y}`)}});
test('new scan observes plot/building mutations without persistent cache',()=>{const w={plots:[],buildings:[]};assert.equal(createTerrainBlocker(w)(5,5),false);w.plots.push({tx:5,ty:5});assert.equal(createTerrainBlocker(w)(5,5),true);w.plots=[];w.buildings.push({kind:'hall',tx:5,ty:5});const b=createTerrainBlocker(w);assert.equal(b(5,5),old(w,5,5));});
