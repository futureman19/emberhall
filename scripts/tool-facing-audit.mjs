import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const [label='facing-action-audit',url='http://127.0.0.1:8093']=process.argv.slice(2);
assert.match(label,/^[a-z0-9-]+$/);const out='art/verification/tools/'+label;fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(out+'/results.json'));
const r={label,url,checks:[],samples:[],errors:[],tools:[]};const save=()=>fs.writeFileSync(out+'/results.json',JSON.stringify(r,null,2));const check=(name,ok,data)=>{r.checks.push({name,ok:!!ok,data});save();assert(ok,name)};
const b=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});const timer=setTimeout(()=>b.close(),160000);
try{
const c=await b.newContext();await c.routeWebSocket(/.*/,()=>{});if(label.includes('fallback'))await c.route('**/tools.glb',route=>route.abort());const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>r.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGL/i.test(m.text()))r.errors.push(m.text())});
await p.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));await p.goto(url+'/?qa=1');await p.getByRole('button',{name:'Continue',exact:true}).click();await p.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');await p.waitForLoadState('networkidle');
await p.evaluate(async()=>{const src=await(await fetch('/src/components/game/world-scene.tsx')).text(),m=src.match(/from\s+["']([^"']*(?:react-three_fiber|@react-three\/fiber)[^"']*)["']/),f=await import(m[1]);window.__tools=f._roots.get(document.querySelector('canvas')).store.getState();window.__ember.useGame.getState().speed(0)});

await p.setViewportSize({width:390,height:844});
await p.evaluate(()=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),you=w.people.find(p=>p.isPlayer);you.x=220;you.z=260;you.path=[];you.ghost=false;w.player.ghost=false;for(let z=245;z<=275;z++)for(let x=205;x<=235;x++)w.tiles[z][x].kind='grass';w.landRev++;w.hour=12;w.weather.kind='clear';w.weather.cloud=0;w.weather.wet=0;s.setPanel('none');s.select(null);s.tick(0)});await p.waitForTimeout(8500);
for(const id of ['hatchet','pick','hoe','fishing_rod'])for(const facing of [0,1,2,3])for(const action of [false,true]){
await p.evaluate(({id,facing,action})=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),you=w.people.find(p=>p.isPlayer);you.facing=facing*Math.PI/2;w.player.wear.main=id;s.tick(0);w.player.intent={kind:action?({hatchet:'chop',pick:'mine',hoe:'till',fishing_rod:'fish'})[id]:'idle',tx:220,ty:260};w.player.workT=.3},{id,facing,action});await p.waitForTimeout(300);
const row=await p.evaluate(()=>{const s=window.__tools,g=s.scene.getObjectByName('emberhall-player-figure'),v=g.position.clone();v.y+=.8;v.project(s.camera);const parts=[];g.traverse(o=>{if(o.geometry?.userData.toolPart)parts.push(o.geometry.userData.toolPart)});return{parts,x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2}});check(id+'-'+facing+'-'+action,row.parts.length===2);const file=id+'-'+facing+'-'+(action?'work':'idle')+'.png';await p.screenshot({path:out+'/'+file});r.tools.push({id,facing,action,file,...row});save();
}
check('no-errors',r.errors.length===0);r.passed=true;
}catch(e){r.passed=false;r.failure=e.message;process.exitCode=1}finally{clearTimeout(timer);save();await b.close()}console.log(JSON.stringify({passed:r.passed,cases:r.tools.length,failure:r.failure}));
