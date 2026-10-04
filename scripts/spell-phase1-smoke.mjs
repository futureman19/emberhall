import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const baseUrl = process.argv[2] ?? "http://127.0.0.1:8080/";
const outputDir = process.argv[3] ?? "screenshots/spell-phase1";
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
async function startGame(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__ember));
  if (process.env.SPELL_QA_SEED) await page.evaluate(seed => {
    window.__spellQaRandom = Math.random;
    Math.random = () => seed / 1e9;
  }, Number(process.env.SPELL_QA_SEED));
  await page.getByRole("button", { name: "New hall" }).click();
  await page.waitForFunction(() => window.__ember?.useGame.getState().phase === "intro");
  if (process.env.SPELL_QA_SEED) await page.evaluate(() => { Math.random = window.__spellQaRandom; delete window.__spellQaRandom; });
  await page.evaluate(() => window.__ember.useGame.getState().introDone());
  await page.locator('[data-testid="look-next"]').evaluate((element) => element.click());
  await page.waitForFunction(() => document.body.innerText.includes("A calling"));
  await page.locator('[data-testid="look-next"]').evaluate((element) => element.click());
  await page.waitForSelector('[data-testid="look-done"]');
  await page.locator('[data-testid="look-done"]').evaluate((element) => element.click());
  await page.waitForFunction(() => window.__ember?.useGame.getState().phase === "playing");
  await page.evaluate(() => {
    const store = window.__ember.useGame.getState();
    store.speed(0);
    if (store.panel !== "none") store.setPanel("none");
    const world = window.__ember.getWorld();
    const self = world.people.find((person) => person.isPlayer);
    if (!self) throw new Error("animation smoke has no player");
    let clearing = null;
    for (let y = 16; y < world.tiles.length - 16 && !clearing; y += 1) {
      for (let x = 16; x < world.tiles[y].length - 24; x += 1) {
        const openRun = Array.from(
          { length: 12 },
          (_, offset) => world.tiles[y]?.[x + offset]?.kind === "grass",
        ).every(Boolean);
        const awayFromBuildings = world.buildings.every(
          (building) => Math.hypot(building.tx - x, building.ty - y) > 18,
        );
        if (openRun && awayFromBuildings) {
          clearing = { x, y };
          break;
        }
      }
    }
    if (!clearing) throw new Error("animation smoke found no open grass clearing");
    for (let y = clearing.y - 12; y <= clearing.y + 12; y += 1) {
      for (let x = clearing.x - 12; x <= clearing.x + 20; x += 1) {
        const tile = world.tiles[y]?.[x];
        if (tile) tile.kind = "grass";
      }
    }
    world.landRev += 1;
    self.x = clearing.x;
    self.z = clearing.y;
    self.path = [];
    store.speed(1);
    store.tick(0.01);
    store.speed(0);
  });
  await page.waitForTimeout(500);
}


const results = [];
try {
for (const viewport of [{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844}]) {
 if (process.env.SPELL_QA_VIEWPORT && process.env.SPELL_QA_VIEWPORT !== viewport.name) continue;
 const page = await browser.newPage({viewport}); const errors=[];
 page.setDefaultTimeout(120000);
 page.on("pageerror", e=>errors.push(e.message));
 page.on("console", m=>{if(m.type()==="error")errors.push(m.text());});
 await startGame(page);
 await page.evaluate(()=>{
   const w=window.__ember.getWorld(); const p=w.people.find(p=>p.isPlayer);
   w.fauna=[{id:"spell-qa",kind:"wolf",x:p.x+3,z:p.z,hp:999,maxHp:999,path:[],task:"idle",taskUntil:w.hour+99,corpseUntil:0,home:{tx:p.x+5,ty:p.z},ownerId:null,loyalty:0,stay:false}];
   Object.assign(w.player.pack,{spellbook:1,pearl:99,mandrake:99,nightshade:99,silk:99,garlic:99,ginseng:99,ash:99,moss:99});
   w.player.skills.magery=100; w.player.mana=999;
 });
 const capture=async name=>{if(process.env.SPELL_QA_DIAG || (process.env.SPELL_QA_SHOTS && !process.env.SPELL_QA_SHOTS.split(",").includes(name)))return null;await page.waitForTimeout(120); const file=`${outputDir}/${viewport.name}-${name}.png`; await page.screenshot({path:file,timeout:60000}); console.log(`Captured ${file}`); return file;};
 const cast=async (spell,seconds)=>page.evaluate(({spell,seconds})=>{
   const w=window.__ember.getWorld(), s=window.__ember.useGame.getState();
   s.cast(spell,{kind:"fauna",id:"spell-qa"});
   const random=Math.random; Math.random=()=>0;
   try {s.speed(1);for(let t=0;t<seconds;t+=0.02)s.tick(Math.min(0.02,seconds-t));s.speed(0);}finally{Math.random=random;}
   return w.fauna[0].hp;
 },{spell,seconds});
 const shots=[];
 assert.equal(await cast("fireball",0.4),999);
 shots.push(await capture("casting"));
 await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);for(let i=0;i<18;i++)s.tick(0.02);s.speed(0);});
 assert.equal(await page.evaluate(()=>window.__ember.getWorld().fauna[0].hp),999);
 shots.push(await capture("flight"));
 await page.evaluate(()=>{const s=window.__ember.useGame.getState(),r=Math.random;Math.random=()=>0;try{s.speed(1);for(let i=0;i<9;i++)s.tick(0.02);s.speed(0);}finally{Math.random=r;}});
 assert.ok(await page.evaluate(()=>window.__ember.getWorld().fauna[0].hp<999));
 shots.push(await capture("impact"));
 // Burst of actual domain casts at one simulation instant exercises overlap,
 // without fake event injection or delayed damage mechanics.
 const overlap=await page.evaluate(async()=>{
   const {castNow,commandCast}=window.__ember.spells;
   const {spellEffects}=window.__ember.spells;
   const w=window.__ember.getWorld(),r=Math.random;Math.random=()=>0;
   // Simulation clamps mana to this character's real maximum. This burst
   // fixture bypasses waiting for regeneration, not the cast validation path.
   w.player.mana = 999;
   const before = spellEffects(w).map(fx => ({ spell: fx.spell, age: (w.hour - fx.at) * 36 }));
   const casts = [];
   try{for(const spell of ["poison","paralyze","curse","bless"]){const command=commandCast(w,spell,{kind:"fauna",id:"spell-qa"});const result=castNow(w);casts.push({spell,command,result,effects:spellEffects(w).map(fx=>fx.spell)});}}finally{Math.random=r;}
   console.log("SPELL OVERLAP DIAGNOSTIC", JSON.stringify({hour:w.hour,before,casts}));
   return {before, casts, effects:spellEffects(w).length,poison:w.fauna[0].poisonUntil>w.hour,paralyze:w.fauna[0].paralyzeUntil>w.hour,curse:w.fauna[0].curseUntil>w.hour,bless:w.player.blessUntil>w.hour};
 });
 console.log(JSON.stringify({overlap}));
 assert.deepEqual(overlap.casts.map(c => c.command), [null, null, null, null]);
 assert.equal(overlap.effects,5); assert.ok(overlap.poison&&overlap.paralyze&&overlap.curse&&overlap.bless);
 shots.push(await capture("overlap"));
 const assertLabel = async text => {
   await page.waitForFunction(text => {
     const labels = [...document.querySelectorAll('[data-testid="spell-label"]')];
     return labels.length === 1 && labels[0].textContent === text && getComputedStyle(labels[0]).display !== "none";
   }, text);
 };
 await assertLabel("Rel Sanct"); // latest bless release, NOT oldest fireball
 assert.equal(await page.evaluate(() => {
   const w = window.__ember.getWorld(); w.player.mana = 999;
   return window.__ember.spells.commandCast(w, "lightning", {kind:"fauna", id:"spell-qa"});
 }), null);
 await assertLabel("Por Ort Grav"); // new windup supersedes every lingering release
 shots.push(await capture("overlap-windup-label"));
 await page.evaluate(() => { window.__ember.getWorld().player.intent.kind = "none"; });
 await assertLabel("Rel Sanct"); // cancellation restores latest live release
 await page.evaluate(()=>{window.__ember.getWorld().hour+=2/36;});
 await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="spell-label"]')).display === "none");
 shots.push(await capture("statuses"));
 const remaining=await page.evaluate(async()=>{const {spellEffects,visitSpellStatuses}=window.__ember.spells;const w=window.__ember.getWorld();let n=0;visitSpellStatuses(w,()=>n++);return {effects:spellEffects(w).length,statuses:n};});
 assert.equal(remaining.effects,0);assert.equal(remaining.statuses,4);
 await page.emulateMedia({reducedMotion:"reduce"});
 shots.push(await capture("reduced-statuses"));
 await page.evaluate(()=>{const w=window.__ember.getWorld();w.fauna[0].task="dead";w.player.blessUntil=0;});
 assert.equal(await page.evaluate(async()=>{const {visitSpellStatuses}=window.__ember.spells;return visitSpellStatuses(window.__ember.getWorld(),()=>{});}),0);
 shots.push(await capture("cleared"));
 // Separate natural-forest pass: do not clear terrain or move trees. Find a
 // walkable lane beside existing canopy, away from buildings.
 await page.emulateMedia({reducedMotion:"no-preference"});
 const forest = await page.evaluate(() => {
   const w=window.__ember.getWorld(), p=w.people.find(p=>p.isPlayer);
   for(let z=20;z<w.tiles.length-20;z++) for(let x=20;x<w.tiles[z].length-20;x++) {
     if(![0,1,2,3].every(dx=>w.tiles[z][x+dx].kind==="grass"))continue;
     if(w.buildings.some(b=>Math.hypot(b.tx-x,b.ty-z)<18))continue;
     let trees=0;
     for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=6;dx++)if(w.tiles[z+dz][x+dx].kind==="tree")trees++;
     if(trees<4)continue;
     p.x=x;p.z=z;p.path=[];
     Object.assign(w.fauna[0],{x:x+3,z,hp:999,task:"idle",taskUntil:w.hour+99,path:[],poisonUntil:0,paralyzeUntil:0,curseUntil:0});
     w.player.mana=999;
     return {x,z,trees};
   }
   throw new Error("No natural forest-edge lane found");
 });
 await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);s.tick(0.01);s.speed(0);});
 await page.waitForTimeout(900);
 assert.ok(await cast("fireball",0.94)<999);
 shots.push(await capture("forest-impact"));
 assert.deepEqual(errors,[]);results.push({viewport:viewport.name,forest,overlap,remaining,errors,shots});await page.close();
}
console.log(JSON.stringify({ok:true,results},null,2));
}finally{await browser.close();}
