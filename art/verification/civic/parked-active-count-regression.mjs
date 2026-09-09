import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('src/components/game/terrain.tsx','utf8');
const body=source.slice(source.indexOf('function hideRest('),source.indexOf('function ensureColor('));
const dummy={position:{set(){}},scale:{set(){}},updateMatrix(){},matrix:{hidden:true}};
const hideRest=new Function('dummy',body.replace('mesh: THREE.InstancedMesh | null, from: number, total: number','mesh, from, total')+'; return hideRest;')(dummy);
test('terrain active count shrinks, empties and regrows without reallocating or reindexing',()=>{
 const mesh={count:6,instanceMatrix:{needsUpdate:false},slots:[0,1,2,3,4,5],setMatrixAt(i,m){this.slots[i]=m}};
 const buffer=mesh.instanceMatrix;
 hideRest(mesh,2,6);assert.equal(mesh.count,2);assert.deepEqual(mesh.slots.slice(0,2),[0,1]);
 hideRest(mesh,0,6);assert.equal(mesh.count,0);
 for(let i=0;i<4;i++)mesh.slots[i]=i;
 hideRest(mesh,4,6);assert.equal(mesh.count,4);assert.deepEqual(mesh.slots.slice(0,4),[0,1,2,3]);assert.equal(mesh.instanceMatrix,buffer);assert.equal(buffer.needsUpdate,true);
 hideRest(mesh,6,6);assert.equal(mesh.count,6);
 assert.doesNotThrow(()=>hideRest(null,0,6));
});
