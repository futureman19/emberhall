import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const kinds=['hall','dormitory','kitchen','yard','market','forge','tavern','notice','board','farm','bank'];
const ledger=read('art/asset-ledger.json');
const candidate=read('art/verification/phase1/candidate/results.json');
assert.equal(candidate.status,'passed','Do not annotate unverified candidate as verified');
const interiors=read('public/art/lanternwood/interiors-manifest.json').assets;
const signage=read('public/art/lanternwood/signage-manifest.json').assets;
const evidence=['art/PHASE1-FINISH-BRIEF.md','art/PHASE1-VERIFICATION.md','art/PHASE1-COVERAGE.json','art/verification/phase1/candidate/results.json'];
for(const kind of kinds){
 const row=ledger.assets.find(a=>a.id===`building:${kind}`);assert(row,kind);
 row.batchOwner='phase1-finish';row.status='verified';row.reviewEvidence=evidence;
 row.evidence=[...new Set([...row.evidence,...evidence])];
 row.rendererMapping='Starting-settlement built placements only; bounded selectors. Other settlements unchanged.';
 row.notes='Phase1 local presentation checks verified, not user visual approval or global performance/release acceptance. Original floors/walls/cutaways and blueprint ghosts retained intentionally. No new gameplay.';
 const prop=interiors.find(a=>a.kind===kind);
 if(prop)row.interiorSource={blend:'art/blender/interiors-kit.blend',script:'art/blender/build_interiors.py',export:`public/art/lanternwood/${prop.file}`,metrics:prop,contract:'Exact old furniture cells replaced after successful load; original picking proxies retained; source helper interior-kit.ts.'};
 if(signage[kind]){
  const a=signage[kind];row.source={blend:'art/blender/signage-kit.blend',script:'art/blender/build_signage.py',export:`public/art/lanternwood/${kind}.glb`,parts:['Named editable source parts; joined vertex-color export'],materials:['Signage vertex palette'],attachments:'Identity ground anchor; original pick proxies; no-op decorative raycasts',lods:['Shared low-poly base, no lights']};row.metrics={bounds:a.bounds,bytes:a.bytes,triangles:a.triangles,materialSlots:a.materials};
 }
 if(kind==='hall'&&!row.source.export){row.source={...row.source,blend:'art/blender/lanternwood-kit.blend',script:'art/blender/build_lanternwood.py',export:'public/art/lanternwood/hall.glb',attachments:'Preserved approved hall exterior; original interior cutaway plus new furnishings'};}
 for(const state of row.states){
  state.evidence=[...new Set([...state.evidence,...evidence])];state.reviewEvidence=evidence;
  if(state.id==='exterior'){state.status='verified';state.applicability='Local Phase1 starting-settlement exterior; other placements not covered.';}
  else if(state.id==='interior-cutaway'){
   state.status=prop?'verified':'retained-by-decision';state.reviewEvidence=['art/PHASE1-FINISH-BRIEF.md'];
   state.applicability=prop?'Authored original furniture; original floor/walls and room cutaway intentionally retained.':kind==='farm'?'Open farm soil beds retained for landscape phase; no interior furniture.':'Non-enterable civic signage, no room cutaway or invented quest UI.';
  }else if(state.id.startsWith('placement-')){state.status='retained-by-decision';state.reviewEvidence=['art/PHASE1-FINISH-BRIEF.md'];state.applicability='Original blueprint ghost renderer and legal-placement behavior intentionally unchanged; separate fallback/ghost QA evidence.';}
 }
}
assert.equal(new Set(kinds).size,11);
fs.writeFileSync(new URL('art/asset-ledger.json',root),JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({phase1Kinds:kinds.length,ledgerAssets:ledger.assets.length,ledgerStates:ledger.assets.reduce((n,a)=>n+a.states.length,0)}));
