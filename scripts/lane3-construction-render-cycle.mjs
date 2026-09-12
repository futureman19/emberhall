import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='art/lane3/construction-render-cycle';fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(out+'/results.json'));
const kinds=['dormitory','kitchen','yard','market','forge','tavern','notice','board','farm'];
const result={scope:'Local8093 renderer, missing-kind disposable worlds, actual mouse click on camera-projected terrain; build mode set by fixture; not mobile input, physical mobile or animation acceptance.',rows:[],errors:[]};const save=()=>fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try{for(const kind of kinds){
 const c=await browser.newContext({viewport:{width:1440,height:960}});await c.routeWebSocket(/.*/,()=>{});const p=await c.newPage();p.on('pageerror',e=>result.errors.push(e.message));
 await p.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
 await p.goto('http://127.0.0.1:8093/?qa=1');await p.getByRole('button',{name:'Continue',exact:true}).click();await p.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');
 const setup=await p.evaluate(async kind=>{
 const w=window.__ember.getWorld(),s=window.__ember.useGame.getState();s.speed(0);w.buildings=w.buildings.filter(b=>b.kind!==kind);w.gold=100;const you=w.people.find(p=>p.isPlayer);you.x=256;you.z=298;you.path=[];
 const {siteError}=await import('/src/game/building-size.ts'),{astar}=await import('/src/game/pathfinding.ts');let site;
 for(let r=0;r<=20&&!site;r++)for(let y=298-r;y<=298+r&&!site;y++)for(let x=256-r;x<=256+r&&!site;x++){if(Math.max(Math.abs(x-256),Math.abs(y-298))!==r)continue;if(siteError(w,kind,x,y)===null&&astar(w,256,298,x,y))site={tx:x,ty:y};}
 if(!site)throw Error('No site '+kind);s.setPanel('none');s.select(null);window.__ember.useGame.setState({buildKind:kind,buildAt:site});s.tick(0);
 const src=await(await fetch('/src/components/game/world-scene.tsx')).text(),m=src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/);if(!m)throw Error('No Fiber URL');const f=await import(m[1]);window.__lane3render=f._roots.get(document.querySelector('canvas')).store.getState();return {site,gold:w.gold,count:w.buildings.length};
 },kind);
 await p.waitForTimeout(1200);
 const ghost=await p.evaluate(()=>{const matches=[];window.__lane3render.scene.traverse(o=>{if(o.isInstancedMesh&&o.material?.isMeshBasicMaterial&&o.material.opacity===.34){let visible=true;for(let a=o;a;a=a.parent)if(!a.visible)visible=false;matches.push({count:o.count,color:o.material.color.getHexString(),visible})}});return matches;});
 await p.screenshot({path:out+'/'+kind+'-ghost.png'});
 const row={kind,setup,ghost,ghostPassed:ghost.length===1&&ghost[0].count>0&&ghost[0].visible&&ghost[0].color==='c9a36a'};result.rows.push(row);save();assert(row.ghostPassed,'Valid ghost '+kind);
 const point=await p.evaluate(async site=>{const q=window.__lane3render;const {groundY}=await import('/src/game/height.ts');q.camera.updateMatrixWorld(true);const v=q.scene.position.clone().set(site.tx,groundY(window.__ember.getWorld(),site.tx,site.ty),site.ty).project(q.camera);const rect=q.gl.domElement.getBoundingClientRect();return{x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};},setup.site);
 row.pointer=point;await p.mouse.click(point.x,point.y);await p.waitForTimeout(200);
 row.after=await p.evaluate(kind=>{const w=window.__ember.getWorld();return {gold:w.gold,count:w.buildings.length,building:w.buildings.find(b=>b.kind===kind),buildKind:window.__ember.useGame.getState().buildKind};},kind);

 row.commitPassed=row.after.count===setup.count+1&&row.after.gold===100-(kind==='dormitory'?40:28)&&row.after.building?.tx===setup.site.tx&&row.after.building?.ty===setup.site.ty&&row.after.buildKind===null;save();assert(row.commitPassed,'Placement commit '+kind);
 row.animation=[];
 for(const steps of [4,10,24]){
 await p.evaluate(steps=>{const s=window.__ember.useGame.getState();s.speed(1);for(let i=0;i<steps;i++)s.tick(.05);s.speed(0)},steps);await p.waitForTimeout(100);
 row.animation.push(await p.evaluate(()=>{const scene=window.__lane3render.scene,player=scene.getObjectByName('emberhall-player-figure'),hammers=[];player.traverse(o=>{if(!o.isMesh)return;const a=o.geometry?.parameters;if(a?.width===.34&&a?.height===.16&&a?.depth===.16){let visible=true;for(let q=o;q;q=q.parent)if(!q.visible)visible=false;hammers.push({visible,rotation:o.parent.rotation.z});}});const labels=Array.from(document.querySelectorAll('div')).filter(e=>e.children.length===0&&e.textContent.startsWith('HAMMER ·')).map(e=>({text:e.textContent,display:getComputedStyle(e).display}));return{hammers,labels};}));
 }
 row.animationPassed=row.animation.every(x=>x.hammers.length===1)&&row.animation[0].hammers[0].visible&&row.animation[1].hammers[0].visible&&!row.animation[2].hammers[0].visible&&row.animation[0].hammers[0].rotation!==row.animation[1].hammers[0].rotation&&row.animation[0].labels.some(x=>x.display!=='none')&&row.animation[2].labels.every(x=>x.display==='none');save();assert(row.animationPassed,'Construction render cycle '+kind);await c.close();
 }result.passed=result.rows.length===9&&result.errors.length===0;
}catch(e){result.failure=e.message;result.passed=false;process.exitCode=1}finally{save();await browser.close();console.log(JSON.stringify({passed:result.passed,rows:result.rows.length,failure:result.failure,errors:result.errors}))}
