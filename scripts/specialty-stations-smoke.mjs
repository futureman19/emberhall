import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const url = process.env.STATION_URL || 'http://127.0.0.1:8080/?qa=1';
const output = process.env.STATION_OUTPUT || 'screenshots/specialty-stations';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist'] });
const verdict = { url, fixture: 'Real begin(false), paused; funded pack, cleared local ground; repositioned beside each natively placed station for crafting. Mouse and emulated touch, not physical device.', viewports: {}, ok: false };
try {
 for (const mobile of [false,true]) {
  const name = mobile ? 'mobile':'desktop';
  const page = await browser.newPage({ viewport: mobile ? {width:390,height:844}:{width:1280,height:800}, hasTouch:mobile });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.routeWebSocket(/.*/,()=>{});
  await page.goto(url);
  await page.waitForFunction(()=>window.__ember);
  await page.evaluate(()=>window.__ember.useGame.getState().begin(false));
  await page.waitForFunction(()=>window.__ember.useGame.getState().phase==='playing');
  await page.evaluate(()=>{
   const {useGame,getWorld}=window.__ember; useGame.getState().speed(0);
   const w=getWorld(),p=w.people.find(p=>p.id===w.player.id);
   w.buildings=[];w.placedObjects=[];
   for(let z=Math.round(p.z)-20;z<=Math.round(p.z)+20;z++)for(let x=Math.round(p.x)-20;x<=Math.round(p.x)+20;x++){const t=w.tiles[z]?.[x];if(t){t.kind='grass';t.height=1;}}
   w.landRev++;Object.assign(w.player.pack,{board:100,ingot:100,ore:30,silk:30,garlic:30,ginseng:30});
   Object.assign(w.player.skills,{smithing:100,tailoring:100,alchemy:100});w.player.wear.main='knife';
   useGame.setState({panel:'none',openCraft:false});useGame.getState().tick(.13);Math.random=()=>.5;
  });
  await page.waitForTimeout(1500);
  const press=async loc=>mobile?loc.tap():loc.click();
  const steps=[];
  for(const [id,label,recipe,product] of [['smith_working_forge',"Smith's forge",'Smelt ore','ingot'],['loom','Loom','Hood','hood'],['alchemy_bench','Alchemy bench','Heal potion','potion_heal']]) {
   await page.evaluate(()=>window.__ember.useGame.setState({panel:'none',openCraft:false}));
   await press(page.getByRole('button',{name:'Hold',exact:true}));
   await page.getByPlaceholder('Floor, wall, door…').fill(label);
   await press(page.getByTestId('hold-panel').getByRole('button',{name:new RegExp('^'+label)}));
   let placed=null;
   for(const [x,y] of (mobile?[[35,220],[65,250],[30,300],[90,210],[45,350]]:[[420,340],[450,400],[500,450],[380,300],[580,400]])) {
    if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
    await page.waitForTimeout(150);
    placed=await page.evaluate(id=>window.__ember.getWorld().placedObjects.find(o=>o.definitionId===id),id);
    if(placed)break;
   }
   assert.ok(placed,`${name} ${id} native placement`);
   await page.evaluate(obj=>{const {getWorld,useGame}=window.__ember;const w=getWorld(),p=w.people.find(p=>p.id===w.player.id);p.x=obj.tx-1;p.z=obj.ty;p.path=[];useGame.setState({panel:'none',openCraft:false});useGame.getState().tick(.13);},placed);
   // Open the actual work gump through the native work control.
   await press(page.getByRole('button',{name:'Work',exact:true}));
   await press(page.getByRole('tab',{name:'Recipes',exact:true}));
   const row=page.locator('.craft-recipe').filter({has:page.getByText(recipe,{exact:true})});
   const before=await page.evaluate(product=>window.__ember.getWorld().player.pack[product],product);
   await press(row.getByRole('button',{name:'Make',exact:true}));
   await page.waitForFunction(({product,before})=>window.__ember.getWorld().player.pack[product]===before+1,{product,before});
   steps.push({id,placed,product,before,after:before+1});
   await page.screenshot({path:`${output}/${name}-${id}.png`});
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  verdict.viewports[name]={passed:!overflow&&!errors.length,steps,overflow,errors};
  await page.close();
 }
 verdict.ok=Object.values(verdict.viewports).every(v=>v.passed);
 assert.ok(verdict.ok);
} finally {writeFileSync(`${output}/verdict.json`,JSON.stringify(verdict,null,2));await browser.close();}
console.log(JSON.stringify(verdict,null,2));
