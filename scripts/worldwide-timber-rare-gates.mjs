// Cleared deterministic wild-node gates. Disposable QA only; no live saves.
import assert from 'node:assert/strict';
import { RESOURCE_CATALOG } from '../src/game/resources/catalog.ts';
import { resolveResourceNode } from '../src/game/resources/nodes.ts';

export const rareFixtures = {
  redwood: {seed:111,tx:360,ty:460},
  yew: {seed:405,tx:64,ty:110},
  ghostwood: {seed:2463,tx:64,ty:110},
};
for (const [kind,site] of Object.entries(rareFixtures)) {
  const identity=resolveResourceNode({...site,nodeKind:'tree'}).identity;
  assert.equal(identity.resourceId,kind);
  assert.equal(identity.qualityCeiling,'pristine');
}

export async function runRareGates({page,device,kind,report,check,tick,snapshot}) {
  if(!rareFixtures[kind])return;
  const site=rareFixtures[kind],spawn=RESOURCE_CATALOG[kind].spawn;
  const originalSeed=await page.evaluate(()=>window.__ember.getWorld().seed);
  const results=[];
  report.gates??=[];
  await page.evaluate(({seed,tx,ty})=>{
    const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people[0];
    w.seed=seed;w.resourceNodes={};w.plantedTimber={};w.scars={};w.saplings=[];
    w.player.resources={stacks:{}};w.player.pack.log=0;w.player.rares=[];w.player.wear.charm=null;
    for(let z=ty-10;z<=ty+10;z++)for(let x=tx-10;x<=tx+10;x++)w.tiles[z][x]={h:1,kind:'dirt'};
    w.tiles[ty][tx].kind='tree';p.x=tx;p.z=ty+4;p.path=[];
    w.player.intent.kind='none';w.player.workT=0;w.landRev++;s.tick(.13);
  },site);
  const cases=kind==='ghostwood'?[
    {name:'living-hidden-command',skill:100,ghost:false,tool:'hatchet',message:'You see no tree.',node:false},
    {name:'ghost-below-80',skill:79,ghost:true,tool:'hatchet',message:'A ghost cannot.',node:false},
    {name:'ghost-no-blade',skill:80,ghost:true,tool:null,message:'Hold a blade',node:false},
    {name:'ghost-tier-one-knife',skill:80,ghost:true,tool:'knife',yield:'pristine',quantity:1,node:true},
  ]:[
    {name:'unknown',skill:spawn.identifySkill.minimum-1,ghost:false,tool:'hatchet',message:'You cannot identify this resource node.',node:false},
    {name:'extraction-skill',skill:spawn.extractSkill.minimum-1,ghost:false,tool:'hatchet',message:`need ${spawn.extractSkill.minimum} Lumberjacking`,node:true},
    {name:'discovery-persists',skill:0,ghost:false,tool:'hatchet',message:`need ${spawn.extractSkill.minimum} Lumberjacking`,node:true},
    {name:'wrong-tool',skill:100,ghost:false,tool:'knife',message:'need a tier 2 tool',node:true},
    {name:'minimum-skill-quality-cap',skill:spawn.extractSkill.minimum,ghost:false,tool:'hatchet',yield:'choice',quantity:1,node:true},
  ];
  for(const test of cases){
    await page.evaluate(({site,test})=>{
      const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people[0];
      w.player.skills.lumberjack=test.skill;w.player.ghost=test.ghost;p.ghost=test.ghost;p.hp=test.ghost?0:p.maxHp;
      w.player.wear.main=test.tool;w.player.intent.kind='none';w.player.workT=0;p.path=[];
      s.tick(.13);window.__ember.useGame.setState({toast:null});
      // Command dispatch is intentional: negative hidden/skill cases need not have a visible UI verb.
      s.doVerb('chop',{kind:'tile',id:`${site.tx},${site.ty}`,tx:site.tx,ty:site.ty,label:'tree'});
    },{site,test});
    const before=await snapshot(page,site.tx,site.ty);
    for(let n=0;n<32;n++){if((await snapshot(page,site.tx,site.ty)).intent.kind!=='chop')break;await tick(page,.25);}
    const after=await snapshot(page,site.tx,site.ty);
    const delta=Object.fromEntries(Object.entries(after.stacks).map(([k,v])=>[k,v-(before.stacks[k]??0)]).filter(([,v])=>v!==0));
    const expectedId=resolveResourceNode({...site,nodeKind:'tree'}).identity;
    const row={device,kind,name:test.name,site,test,before,after,delta,expectedId};results.push(row);report.gates.push(row);
    const ok=test.yield?
      after.tile==='dirt'&&delta[`${kind}:log:${test.yield}`]===test.quantity&&Object.keys(delta).length===1&&Number.isFinite(after.node?.depletedAtHour):
      after.tile==='tree'&&Object.keys(delta).length===0&&after.legacyLogs===before.legacyLogs&&after.intent.kind!=='chop'&&String(after.toast).includes(test.message);
    check(`${device}-${kind}-wild-${test.name}`,ok,row);
    check(`${device}-${kind}-wild-${test.name}-identity`,test.node?after.node?.nodeId===expectedId.nodeId:after.node===null,{node:after.node,expectedId});
    if(!test.yield&&test.node)check(`${device}-${kind}-wild-${test.name}-not-depleted`,after.node.depletedAtHour===null);
  }
  await page.evaluate(({originalSeed,site})=>{
    const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people[0];
    w.seed=originalSeed;w.resourceNodes={};w.scars={};w.plantedTimber={};w.saplings=[];w.tiles[site.ty][site.tx].kind='dirt';
    w.player.resources={stacks:{}};w.player.skills.lumberjack=100;w.player.wear.main='hatchet';
    w.player.ghost=false;p.ghost=false;p.hp=p.maxHp;w.player.intent.kind='none';w.player.workT=0;p.path=[];w.landRev++;s.tick(.13);
  },{originalSeed,site});
  return results;
}
