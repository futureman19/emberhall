import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildingBox } from "@/game/building-size";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { resolveResourceNode } from "@/game/resources/nodes";
import { useGame } from "@/game/store";
import { useOakGeometry } from "./oak-renderer-data";
import { usesAuthoredOak } from "./oak-renderer-policy";
import { noArtRaycast } from "./lanternwood-art";

/** A depletion record is the authority. Never invent a harvestable stump node. */
export function OakStumps() {
  const oak=useOakGeometry();
  const snap=useGame(s=>s.snap);
  const world=getWorld();
  const nodes=world.resourceNodes;
  const saplings=snap.saplings;
  const buildings=snap.buildings;
  const land=snap.landKey;
  const mesh=useRef<THREE.InstancedMesh>(null);
  const sites=useMemo(()=>{
    void land;
    return Object.values(nodes).filter(n=>{
      if(n.nodeKind!=="tree" || n.depletedAtHour===null || !usesAuthoredOak("oak",n.tx,n.ty,true))return false;
      if(world.tiles[n.ty]?.[n.tx]?.kind!=="dirt")return false;
      if(saplings.some(s=>s.tx===n.tx && s.ty===n.ty)||world.plots.some(p=>p.tx===n.tx&&p.ty===n.ty))return false;
      if(buildings.some(b=>{const box=buildingBox(b.kind,b.tx,b.ty);return n.tx>=box.x0&&n.tx<=box.x1&&n.ty>=box.z0&&n.ty<=box.z1;}))return false;
      return (world.plantedTimber?.[`${n.tx},${n.ty}`]??resolveResourceNode({seed:world.seed,tx:n.tx,ty:n.ty,nodeKind:"tree"}).identity.resourceId)==="oak";
    }).map(n=>[n.tx,groundY(world,n.tx,n.ty),n.ty] as const);
  },[nodes,saplings,buildings,land,world]);
  useLayoutEffect(()=>{
    if(!mesh.current)return;
    const dummy=new THREE.Object3D();
    sites.forEach((p,i)=>{dummy.position.set(...p);dummy.updateMatrix();mesh.current!.setMatrixAt(i,dummy.matrix);});
    mesh.current.count=sites.length;mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();
  },[sites,oak]);
  if(!oak?.stump || !sites.length)return null;
  return <instancedMesh name="depleted-oak-stumps" ref={mesh} args={[oak.stump,undefined,sites.length]} dispose={null} raycast={noArtRaycast} castShadow receiveShadow>
    <meshStandardMaterial vertexColors roughness={.96} />
  </instancedMesh>;
}
