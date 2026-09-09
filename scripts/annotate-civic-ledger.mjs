import fs from 'node:fs';
import assert from 'node:assert/strict';
const path='art/asset-ledger.json';
const ledger=JSON.parse(fs.readFileSync(path,'utf8'));
const evidence='art/CIVIC-VERIFICATION.md';
for(const role of ['banker','provisioner','healer']) {
 const row=ledger.assets.find(a=>a.id===`npc:${role}`);assert(row);
 row.status='integrated';row.batchOwner='civic-pilot';
 row.reviewEvidence=[...new Set([...(row.reviewEvidence??[]),evidence])];
 row.evidence=[...new Set([...(row.evidence??[]),evidence])];
 row.notes='Starting civic NPCs only (home within18 of COURT) reuse approved character.blend/character.glb; original class clothing/materials and animation refs retained. Other settlements/roles remain original. Local runtime and commands verified; performance/full-role coverage NOT accepted.';
 row.civicPilot={source:'art/blender/character.blend',export:'public/art/lanternwood/character.glb',selector:'src/components/game/civic-character.ts',runtimeEvidence:'art/verification/civic/candidate-contracts/results.json'};
}
fs.writeFileSync(path,JSON.stringify(ledger,null,2)+'\n');
