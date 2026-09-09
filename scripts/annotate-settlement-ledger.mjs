import fs from 'node:fs';
const root=new URL('../',import.meta.url),file=new URL('art/asset-ledger.json',root);
const ledger=JSON.parse(fs.readFileSync(file,'utf8'));
const manifest=JSON.parse(fs.readFileSync(new URL('public/art/lanternwood/settlement-manifest.json',root),'utf8'));
for(const kind of ['bank','forge']){
 const row=ledger.assets.find(r=>r.id===`building:${kind}`);if(!row)throw new Error(`Missing ${kind}`);
 const m=manifest[kind],bytes=fs.readFileSync(new URL(`public/art/lanternwood/${kind}.glb`,root));
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 row.source={blend:'art/blender/settlement-kit.blend',script:'art/blender/build_settlement.py',export:`public/art/lanternwood/${kind}.glb`,parts:m.parts,materials:gltf.materials.map(x=>x.name),attachments:'Existing building ground anchor; decorative no-op raycast; original voxel pick proxies and interiors.',lods:['shared base kit; existing graphics settings; no extra dynamic lights']};
 row.metrics={bounds:m.boundsYUp,bytes:m.bytes,triangles:m.triangles,materialSlots:m.materialSlots};
 row.status='integrated';row.batchOwner='phase1-bank-forge-first-batch';
 row.rendererMapping='Explicit bounded dispatch in settlement-kit.ts, tested in settlement-kit.test.ts. Not world-wide.';
 row.notes='Starting-settlement shell only. Local functional/visual and fault-injection checks pass. Full performance acceptance BLOCKED; user art approval pending. Other settlements and placement previews remain original, not falsely completed.';
 row.evidence=[...new Set([...row.evidence,'art/SETTLEMENT-BRIEF.md','art/VERIFICATION.md','public/art/lanternwood/settlement-manifest.json','art/verification/smoke-baseline/candidate/results.json','art/verification/smoke-baseline/candidate-asset-failure/results.json','art/verification/controlled-performance.json'])];
 for(const state of row.states){
  if(state.id==='exterior'){state.status='integrated';state.applicability='Starting-settlement pilot only; functional evidence present, performance clearance and user approval outstanding.';state.evidence=[...row.evidence];}
  else if(state.id==='interior-cutaway'){state.status='retained-by-decision';state.applicability='User explicitly required original interiors/cutaways retained until a later approved interior kit. Entry/exit and roof restoration exercised in desktop/mobile pilot.';state.evidence=['art/SETTLEMENT-BRIEF.md','art/verification/smoke-baseline/candidate/results.json'];state.reviewEvidence=[...state.evidence];}
 }
}
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
console.log('Annotated bank + forge only; neither marked fully verified or approved.');
