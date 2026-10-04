import { createHash } from 'node:crypto';
import path from 'node:path';
import { groundY } from '../src/game/height.ts';
import { lineWalkable } from '../src/game/pathfinding.ts';
import { PerspectiveCamera, Vector3 } from 'three';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function cityGateSupplement({page,device,mode,report,out,check,flush,tick}){
 const row={device,scope:'Original loaded west gatehouse/adjacent wall: tiles and building records preserved, body relocated to two starts, other people/fauna cleared for input isolation. Not natural NPC/AI or all-world collision acceptance.'};
 report.cityActive=row;
 const initial=await page.evaluate(()=>{
  const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);s.speed(0);w.people=[p];w.fauna=[];w.player.ghost=false;p.ghost=false;p.story=0;w.player.intent.kind='none';w.player.armedSpell=null;p.path=[];p.hunger=0;p.energy=100;p.hp=p.maxHp;w.hour=12;s.select(null);s.setPanel('none');s.closeCtx();s.tick(.13);
  const tiles=[];for(let z=326;z<=344;z++)for(let x=142;x<=163;x++)tiles.push({x,z,...w.tiles[z][x]});return {tiles,buildings:structuredClone(w.buildings)};
 });
 const world={tiles:[]};for(const {x,z,...tile} of initial.tiles){world.tiles[z]??=[];world.tiles[z][x]=tile;}
 row.before={tileHash:digest(initial.tiles),buildingHash:digest(initial.buildings),gatehouses:initial.buildings.filter(b=>b.kind==='gatehouse')};
 check(device+'-city-original-west-gate-present',row.before.gatehouses.some(b=>b.tx===152&&b.ty===336));
 check(device+'-city-direct-wall-blocked',!lineWalkable(world,154,332,150,332));
 check(device+'-city-direct-gate-clear',lineWalkable(world,154,336,150,336));
 async function screen(x,z){const v=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {c:window.__emberCamera.getCamera(),t:window.__emberCamera.getTarget(),r:{x:r.x,y:r.y,width:r.width,height:r.height}};});const c=new PerspectiveCamera(48,v.r.width/v.r.height,.2,480);c.position.set(v.c.x,v.c.y,v.c.z);c.lookAt(v.t.x,v.t.y,v.t.z);c.updateMatrixWorld(true);const p=new Vector3(x,groundY(world,x,z),z).project(c);return {x:v.r.x+(p.x+1)*v.r.width/2,y:v.r.y+(1-p.y)*v.r.height/2};}
 const state=()=>page.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer);return {x:p.x,z:p.z,path:structuredClone(p.path),intent:structuredClone(w.player.intent),ctx:s.ctx,selectedId:s.selectedId,toast:s.toast};});
 for(const [name,z] of [['passage',336],['wall-detour',332]]){
  await page.evaluate(z=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer);p.x=154;p.z=z;p.path=[];w.player.intent.kind='none';window.__ember.useGame.getState().tick(.13);},z);
  await page.waitForTimeout(650);const point=await screen(150,z),data={start:{x:154,z},target:{x:150,z},point};row[name]=data;
  await page.screenshot({path:path.join(out,device+'-city-'+name+'-before.png')});
  if(device==='mobile')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  data.command=await state();flush();check(device+'-city-'+name+'-real-walk',data.command.intent.kind==='walk'&&data.command.path.length>0,{command:data.command});
  const nodes=[data.start,...data.command.path.map(p=>({x:p.tx,z:p.ty}))];
  check(device+'-city-'+name+'-all-planned-segments-legal',nodes.slice(1).every((b,i)=>lineWalkable(world,Math.round(nodes[i].x),Math.round(nodes[i].z),Math.round(b.x),Math.round(b.z))),{nodes});
  if(name==='wall-detour')check(device+'-city-detour-uses-gate',nodes.some(p=>p.z>=334&&p.z<=338));
  data.track=[];
  for(let i=0;i<60;i++){
   await tick(page,.15);const p=await state();data.track.push(p);
   if(i===1){data.moving=p;await page.screenshot({path:path.join(out,device+'-city-'+name+'-moving.png')});check(device+'-city-'+name+'-moving-capture',p.path.length>0&&Math.hypot(p.x-154,p.z-z)>.05);}
   if(Math.hypot(p.x-150,p.z-z)<.05&&p.path.length===0)break;
  }
  data.arrived=await state();check(device+'-city-'+name+'-arrived',Math.hypot(data.arrived.x-150,data.arrived.z-z)<.05&&data.arrived.path.length===0,{arrived:data.arrived});
  await page.screenshot({path:path.join(out,device+'-city-'+name+'-after.png')});
 }
 const final=await page.evaluate(()=>{const w=window.__ember.getWorld(),tiles=[];for(let z=326;z<=344;z++)for(let x=142;x<=163;x++)tiles.push({x,z,...w.tiles[z][x]});return {tiles,buildings:structuredClone(w.buildings)};});
 row.after={tileHash:digest(final.tiles),buildingHash:digest(final.buildings)};
 check(device+'-city-tiles-buildings-unchanged',row.after.tileHash===row.before.tileHash&&row.after.buildingHash===row.before.buildingHash,{before:row.before,after:row.after});
 if(mode!=='control')check(device+'-city-real-gate-loader-request',report.requests.some(r=>r.device===device&&r.url.endsWith('/architecture-gatehouse.glb')&&r.status===(mode==='failure'?503:200)));
 report.cityCases??=[];report.cityCases.push(row);flush();
}
