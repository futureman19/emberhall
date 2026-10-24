import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const url=process.env.SMITH_URL || 'http://127.0.0.1:8080/?qa=1';
const out=process.env.SMITH_OUT || 'art/blacksmith/evidence/dev';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
const results=[];
try {
for(const mobile of [false,true]) for(const fallback of [false,true]) {
 const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},hasTouch:mobile,isMobile:mobile});
 await ctx.routeWebSocket('**',()=>{});
 const page=await ctx.newPage(); const row={mobile,fallback,errors:[],assets:[],placements:[]};results.push(row);
 page.on('pageerror',e=>row.errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/art/blacksmith/'))row.assets.push({url:r.url(),status:r.status()});});
 if(fallback)await page.route('**/art/blacksmith/*.glb',r=>{row.assets.push({url:r.request().url(),rejected:true});return r.abort();});
 try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__ember);
 await page.evaluate(()=>window.__ember.useGame.getState().begin(false));
 await page.waitForFunction(()=>window.__ember.useGame.getState().phase==='playing',{timeout:60000});
 await page.waitForTimeout(1800);
 await page.evaluate(()=>{const {useGame,getWorld}=window.__ember;useGame.getState().speed(0);useGame.getState().setPanel('none');const w=getWorld();w.player.pack.board=100;w.player.pack.ingot=50;});
 console.log('READY',mobile,fallback,await page.locator('body').innerText());
 // Native Hold opener; bounded resource fixture above only supplies materials.
 const hold=page.getByRole('button',{name:'Hold',exact:true});
 await hold.click();
 await page.getByTestId('hold-panel').waitFor();
 const labels=["Smith's anvil","Banked forge","Quench trough","Grindstone","Weapon rack","Forge bellows"];
 for(const label of labels){
 await page.getByRole('searchbox').fill(label);
 const button=page.getByTestId('hold-panel').getByRole('button').filter({hasText:label}).first();
 if(mobile)await button.tap();else await button.click();
 const before=await page.evaluate(()=>window.__ember.getWorld().placedObjects.length);
 let placed=false;
 for(let y=180;y<680&&!placed;y+=35)for(const x of (mobile?[18,45]:[350,500,650,800])){
 const canvas=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName==='CANVAS',{x,y});if(!canvas)continue;
 if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
 await page.waitForTimeout(100);
 const objects=await page.evaluate(()=>window.__ember.getWorld().placedObjects);
 if(objects.length>before){row.placements.push({label,input:mobile?'native touch':'native mouse',object:objects.at(-1)});placed=true;break;}
 }
 assert.ok(placed,`native placement ${label}`);
 }
 await page.waitForTimeout(1500);
 row.pack=await page.evaluate(()=>window.__ember.getWorld().player.pack);
 assert.equal(row.pack.board,88);assert.equal(row.pack.ingot,44);
 assert.equal(new Set(row.placements.map(p=>p.object.definitionId)).size,6);
 await page.evaluate(()=>window.__ember.useGame.getState().setPanel('none'));
 await page.waitForTimeout(600);
 assert.equal(new Set(row.assets.map(a=>a.url)).size,6,'all six actual GLB requests');
 assert.ok(row.assets.every(a=>fallback?a.rejected:a.status===200));
 await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-${fallback?'fallback':'candidate'}-native.png`});
 // Separate inspection fixture: rearrange already natively created pieces, not placement acceptance.
 row.inspectionFixture=await page.evaluate(()=>{
 const {getWorld,useGame}=window.__ember,w=getWorld();
 for(let z=87;z<=115;z++)for(let x=87;x<=115;x++){w.tiles[z][x].kind='grass';w.tiles[z][x].h=1;}
 const actor=w.people.find(p=>p.isPlayer);assertActor(actor);
 function assertActor(p){if(!p)throw Error('No player actor');p.x=101;p.z=105;p.path=[];}

 w.placedObjects.forEach((o,i)=>{o.tx=98+(i%3)*3;o.ty=98+Math.floor(i/3)*3;});
 w.landRev++;
 const s=useGame.getState();useGame.setState({holdRev:s.holdRev+1,snap:{...s.snap,landKey:s.snap.landKey+':smith-inspection'}});
 return {label:'rearranged inspection fixture after native placement',objects:w.placedObjects};
 });
 await page.waitForTimeout(2000);
 await page.mouse.move(mobile?190:700,mobile?400:500);await page.mouse.wheel(0,-600);
 await page.waitForTimeout(1200);
 }catch(e){row.failure=e.stack;console.log('FAIL',row.failure);}
 await page.screenshot({path:`${out}/${mobile?'mobile':'desktop'}-${fallback?'fallback':'candidate'}.png`});
 await ctx.close();writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
}
}finally{await browser.close();}
if(results.some(r=>r.failure||r.errors.length))process.exitCode=1;
