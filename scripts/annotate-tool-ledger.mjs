import fs from 'node:fs';import assert from 'node:assert/strict';
const path='art/asset-ledger.json',ledger=JSON.parse(fs.readFileSync(path,'utf8'));
for(const id of ['hatchet','pick','hoe','fishing_rod']){const row=ledger.assets.find(r=>r.id==='item:'+id);assert(row);row.reviewEvidence='art/TOOLS-VERIFICATION.md';row.toolPilot={surface:'held player geometry only',asset:'public/art/lanternwood/tools.glb',source:'art/blender/equipment.blend',acceptance:'review-pilot; performance and full animation/ghost roundtrip unresolved'};}
fs.writeFileSync(path,JSON.stringify(ledger,null,2)+'\n');
