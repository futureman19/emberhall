import fs from 'node:fs';
const root=new URL('../',import.meta.url),p=new URL('art/asset-ledger.json',root);
const ledger=JSON.parse(fs.readFileSync(p,'utf8'));
const m=JSON.parse(fs.readFileSync(new URL('public/art/lanternwood/commons-manifest.json',root),'utf8'));
for(const kind of ['kitchen','tavern','market']){const r=ledger.assets.find(r=>r.id===`building:${kind}`);r.visualApproval={status:'continuation-authorized',scope:'proceed to next review batch; no full acceptance',evidence:'User: Ok continue',preview:'https://emberhall-vale-im01t0obl-andrews-projects-ffe8a9fd.vercel.app'};r.notes='User authorized continuation after hospitality delivery. Full performance acceptance remains unresolved; other placements/states are not globally approved.';}
for(const kind of ['dormitory','yard','farm']){
 const r=ledger.assets.find(r=>r.id===`building:${kind}`);if(!r)throw new Error(`Missing ${kind}`);
 const a=m[kind],b=fs.readFileSync(new URL(`public/art/lanternwood/${kind}.glb`,root)),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 r.source={blend:'art/blender/commons-kit.blend',script:'art/blender/build_commons.py',export:`public/art/lanternwood/${kind}.glb`,parts:a.parts,materials:g.materials.map(m=>m.name),attachments:'Original ground anchor, no-op art raycast, retained original voxel picking; dorm interior, yard target and farm soil beds; open perimeters stay visible on entry',lods:['Shared base kit, no added lights; existing graphics settings retained']};
 r.metrics={bounds:a.bounds,bytes:a.bytes,triangles:a.triangles,materialSlots:a.materials};r.status='integrated';r.batchOwner='phase1-commons';
 r.evidence=[...new Set([...r.evidence,'art/COMMONS-BRIEF.md','art/COMMONS-VERIFICATION.md','public/art/lanternwood/commons-manifest.json'])];
 r.rendererMapping='Explicit commonsKitName: built placements within 18 world units of COURT only';r.notes='Review batch only; not whole-world replacement or performance approval.';
 for(const s of r.states){if(s.id==='exterior'){s.status='integrated';s.evidence=[...r.evidence];s.applicability='Starting-settlement exterior only; art approval pending';}if(s.id==='interior-cutaway'){s.status='retained-by-decision';s.evidence=['art/COMMONS-BRIEF.md'];s.reviewEvidence=['art/COMMONS-BRIEF.md'];s.applicability='User plan explicitly preserves original interior until a separate approved interior batch';}}
}
fs.writeFileSync(p,JSON.stringify(ledger,null,2)+'\n');console.log('Commons metadata updated; hospitality continuation recorded separately from performance.');
