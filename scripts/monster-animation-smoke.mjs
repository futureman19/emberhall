import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createWorld} from '../src/game/world.ts';
import {encodeSave,SAVE_KEY} from '../src/game/save.ts';
const [url='http://127.0.0.1:8080',label='dev']=process.argv.slice(2),out=`screenshots/monster-animation/${label}`;
fs.mkdirSync(out,{recursive:true});
const w=createWorld(42);w.speed=0;const player=w.people.find(p=>p.isPlayer);player.x=1038;player.z=677;
const raw=encodeSave(w),report={url,scope:'Seeded isolated fixture; native Continue and first-person controls; bounded real AI ticks and hunt damage/death. Desktop and emulated touch. Live R3F transforms read independently through React DevTools hook.',checks:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
try{for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
 const ctx=await browser.newContext({viewport,hasTouch:device==='mobile'});await ctx.routeWebSocket(/.*/,()=>{});
 await ctx.addInitScript(()=>{Math.random=()=>.4;window.__qaRoots=new Set();window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),inject(r){this.renderers.set(this.renderers.size+1,r);return this.renderers.size;},onCommitFiberRoot(id,r){window.__qaRoots.add(r);},onCommitFiberUnmount(){}};});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/missing.clip/i.test(m.text()))report.errors.push(m.text());});
 await page.goto(url+'/?qa=1');await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:SAVE_KEY,raw});await page.reload();
 const resume=page.getByRole('button',{name:'Continue',exact:true});if(device==='mobile')await resume.tap();else await resume.click();
 await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',{}, {timeout:90000});
 await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.closeCtx();});await page.waitForTimeout(2000);
 await page.evaluate(()=>{
  const queue=[...window.__qaRoots].map(r=>r.current),seen=new Set();let state;
  while(queue.length&&seen.size<120000){const n=queue.pop();if(!n||typeof n!=='object'||seen.has(n))continue;seen.add(n);
   if(n.scene?.isScene&&n.camera&&n.gl){state=n;break;}
   if(n.__r3f?.root?.getState){state=n.__r3f.root.getState();break;}
   for(const k of ['child','sibling','stateNode','memoizedState','memoizedProps','next','current','object','ref','value','store','containerInfo'])if(n[k]&&typeof n[k]==='object')queue.push(n[k]);
  }
  if(!state)throw Error('No live R3F state found');window.__qaScene=state;
 });
 const inspect=async(kind)=>page.evaluate(kind=>{
  const state=window.__qaScene;let found;state.scene.traverse(o=>{if(o.userData.monsterAnimation?.kind===kind&&o.name.endsWith(window.__qaId))found=o;});
  if(!found)throw Error('Missing rendered monster '+kind);
  const p=found.getObjectByName('monster-pose');return {...found.userData.monsterAnimation,visible:found.visible,bodyPosition:p.position.toArray(),bodyRotation:p.rotation.toArray().slice(0,3),bodyScale:p.scale.toArray()};
 },kind);
 const capture=async(view,path)=>{
  let original;
  if(view==='first-person'){
   original=await page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.id===window.__qaId),old={x:p.x,z:p.z,facing:p.facing};p.x=c.x;p.z=c.z+(c.kind==='embercrawler'?3.5:6);p.facing=Math.PI;return old;});
   await page.waitForTimeout(700);
  }
  await page.screenshot({path});
  if(original){await page.evaluate(old=>{const p=window.__ember.getWorld().people.find(p=>p.isPlayer);Object.assign(p,old);},original);await page.waitForTimeout(300);}
 };
 for(const view of ['world','first-person']){
  if(view==='first-person'){const b=page.getByRole('button',{name:'First-person: off',exact:true});if(device==='mobile')await b.tap();else await b.click();}
  for(const kind of ['slag_golem','embercrawler','gloomwraith']){
   await page.evaluate(kind=>{
    const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.kind===kind);
    if(!c)throw Error('No creature '+kind);window.__qaId=c.id;
    for(const other of w.fauna){other.x=1100;other.z=720;other.path=[];}
    c.x=1038;c.z=674;c.home={tx:1038,ty:674};c.hp=c.maxHp;c.task='idle';c.path=[];delete c.monster;delete c.crawler;delete c.gloom;
    p.x=1038;p.z=677;p.facing=0;p.path=[];p.hp=p.maxHp=1000;w.player.intent={kind:'none',tx:0,ty:0,targetId:null,spell:null};w.player.invisUntil=0;w.player.wear={main:'sword'};w.player.skills.swords=50;w.player.skills.anatomy=40;w.weather.kind='clear';w.weather.wet=0;w.weather.cloud=0;w.weather.untilHour=w.hour+100;
    s.speed(0);
   },kind);await page.waitForTimeout(900);
   await page.evaluate(()=>{window.__ember.getWorld().hour+=.2/36;});await page.waitForTimeout(80);
   const poses=[];let pose=await inspect(kind);assert(pose.artReady);assert.equal(pose.clip,'idle');poses.push(pose);
   // Start outside reach for a real prowl, then move the player into attack range.
   await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);s.tick(.05);s.speed(0);});await page.waitForTimeout(100);
   for(let i=0;i<20;i++){
    pose=await inspect(kind);if(pose.clip==='prowl')break;
    await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);s.tick(.05);s.speed(0);});await page.waitForTimeout(30);
   }
   assert.equal(pose.clip,'prowl',`${kind} must visibly move before attacking`);poses.push(pose);
   await capture(view,`${out}/${device}-${view}-${kind}-prowl.png`);
   await page.evaluate(()=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.id===window.__qaId);p.x=c.x;p.z=c.z+(c.kind==='gloomwraith'?3:1.4);p.facing=0;if(c.gloom)c.gloom.clock=3;});
   const phases=new Set(),captured=new Set();
   for(let i=0;i<100;i++){
    const status=await page.evaluate(()=>{const {getWorld,useGame}=window.__ember,w=getWorld(),c=w.fauna.find(c=>c.id===window.__qaId),s=useGame.getState();s.speed(1);s.tick(.05);s.speed(0);return (c.monster??c.crawler??c.gloom)?.phase;});
    await page.waitForTimeout(25);pose=await inspect(kind);
    if(!phases.has(status)){phases.add(status);poses.push(pose);}
    const captureAt=status==='windup'?(kind==='slag_golem'?.6:kind==='embercrawler'?.15:.4):status==='strike'?.1:status==='lunge'?.1:status==='bolt'?.2:Infinity;
    if(!captured.has(status)&&pose.age>=captureAt){captured.add(status);poses.push(pose);await capture(view,`${out}/${device}-${view}-${kind}-${status}.png`);}
    if(phases.has('windup')&&(phases.has('recover')||phases.has('retreat'))&&(status==='patrol'||status==='prowl'))break;
   }
   for(const phase of kind==='slag_golem'?['windup','strike','recover','patrol']:kind==='embercrawler'?['windup','lunge','retreat','patrol']:['windup','bolt','recover','prowl'])assert(phases.has(phase),`${kind} missing ${phase}: ${[...phases]}`);
   // Hunt uses actual player combat. Render between ticks so HP-loss reaction is sampled.
   await page.evaluate(()=>{const {getWorld,useGame}=window.__ember,w=getWorld(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.id===window.__qaId);p.x=c.x;p.z=c.z+.9;p.path=[];useGame.getState().doVerb('hunt',{kind:'fauna',id:c.id,tx:Math.round(c.x),ty:Math.round(c.z)});});
   let flinch=false,dead=false;
   for(let i=0;i<350;i++){
    await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);s.tick(.05);s.speed(0);});await page.waitForTimeout(20);pose=await inspect(kind);
    if(pose.clip==='flinch'&&!flinch){flinch=true;await page.evaluate(()=>{window.__ember.getWorld().hour+=.12/36;});await page.waitForTimeout(70);pose=await inspect(kind);assert.equal(pose.clip,'flinch');assert(Math.abs(pose.bodyRotation[0])>.1);poses.push(pose);await capture(view,`${out}/${device}-${view}-${kind}-flinch.png`);}
    if(pose.clip==='death'){dead=true;break;}
   }
   assert(flinch&&dead,`${kind} hunt did not show flinch + death`);
   await page.evaluate(()=>{window.__ember.getWorld().hour+=.6/36;});await page.waitForTimeout(100);pose=await inspect(kind);assert.equal(pose.clip,'death');assert(pose.pose.opacity>0&&pose.pose.opacity<1);poses.push(pose);
   await capture(view,`${out}/${device}-${view}-${kind}-death.png`);
   await page.evaluate(()=>{window.__ember.getWorld().hour+=1/36;});await page.waitForTimeout(70);assert.equal((await inspect(kind)).visible,false);
   report.checks.push({device,view,kind,phases:[...phases],poses});
  }
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await ctx.close();
}assert.deepEqual(report.errors,[]);assert.equal(report.checks.length,12);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}
finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.checks.length,errors:report.errors,failure:report.failure},null,2));
