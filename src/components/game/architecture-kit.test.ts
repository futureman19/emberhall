import { keepStairCut, keepPlayerOffset } from "./keep-presentation.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BUILD_SIZE } from "../../game/building-size.ts";
import { ARCHITECTURE_KINDS, RETAINED_ARCHITECTURE, architectureKitName, retainArchitectureInteriorVoxel } from "./architecture-kit.ts";
import { usesBlenderHall } from "./lanternwood-kit.ts";
import { settlementKitName } from "./settlement-kit.ts";
import { hospitalityKitName } from "./hospitality-kit.ts";
import { commonsKitName } from "./commons-kit.ts";
import { signageKitName } from "./signage-kit.ts";
import { INTERIOR_KINDS, interiorKitName } from "./interior-kit.ts";

const root = new URL("../../../", import.meta.url);
const text = (file: string) => readFileSync(new URL(file, root), "utf8");
const manifest = JSON.parse(text("public/art/lanternwood/architecture-manifest.json"));
const load = async (kind: string) => {
  const raw = readFileSync(new URL(`public/art/lanternwood/architecture-${kind}.glb`, root));
  assert.equal(raw.toString("ascii", 0, 4), "glTF");
  assert.equal(raw.readUInt32LE(8), raw.length);
  const gltf = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), "");
  gltf.scene.updateMatrixWorld(true);
  return { ...gltf, raw };
};

test("worldwide coverage is exhaustive over canonical existing kinds; keep is explicitly original", () => {
  const approved = ["hall", "bank", "forge", "kitchen", "tavern", "market", "dormitory", "yard", "farm", "notice", "board"];
  assert.deepEqual([...approved, ...ARCHITECTURE_KINDS, ...Object.keys(RETAINED_ARCHITECTURE)].sort(), Object.keys(BUILD_SIZE).sort());
  assert.deepEqual(Object.keys(manifest).sort(), [...ARCHITECTURE_KINDS].sort());
  const route = (k: string, x: number, z: number) => usesBlenderHall(k, x, z) ? "hall" : settlementKitName(k, x, z) ?? hospitalityKitName(k, x, z) ?? commonsKitName(k, x, z) ?? signageKitName(k, x, z) ?? architectureKitName(k, x, z);
  for (const k of [...approved, ...ARCHITECTURE_KINDS]) {
    const expected = ARCHITECTURE_KINDS.includes(k as typeof ARCHITECTURE_KINDS[number]) ? `architecture-${k}` : k;
    for (const [x,z] of [[0,0], [176,320], [512,512], [-100,900], [274,292], [274.001,292]]) assert.equal(route(k,x,z), expected);
    for (const [x,z] of [[NaN,0], [0,Infinity]]) assert.equal(route(k,x,z), null);
  }
  for (const k of INTERIOR_KINDS) assert.equal(interiorKitName(k, 0, 512), `interior-${k}`);
  for (const k of ["keep", "unknown", ...ARCHITECTURE_KINDS]) assert.equal(interiorKitName(k, 0, 512), null);
  assert.equal(route("keep",176,320), null);
  assert.equal(route("unknown",0,0), null);
});

test("all new GLBs load with measured finite, grounded Y-up bounds and vertex-color batching", async () => {
  assert.equal(readFileSync(new URL("art/blender/architecture-kit.blend", root)).toString("ascii",0,7), "BLENDER");
  for (const kind of ARCHITECTURE_KINDS) {
    const { scene, animations, raw } = await load(kind);
    const m = manifest[kind], b = BUILD_SIZE[kind];
    const bounds = new THREE.Box3().setFromObject(scene);
    assert.equal(animations.length,0);
    assert.equal(raw.length,m.bytes);
    assert.equal(createHash("sha256").update(raw).digest("hex"),m.sha256);
    assert.ok(Math.abs(bounds.min.y) < .001, `${kind} ground pivot`);
    assert.ok(bounds.max.y > 2 && bounds.max.y < 5.6);
    assert.ok(bounds.min.x >= b.x0*.5-.65 && bounds.max.x <= (b.x1+1)*.5+.65, `${kind} fitted x`);
    assert.ok(bounds.min.z >= b.z0*.5-.65 && bounds.max.z <= (b.z1+1)*.5+.65, `${kind} fitted z`);
    let triangles=0, vertices=0, meshes=0, colored=0;
    const materials = new Set<string>();
    scene.traverse(o => {
      assert.ok(!(o instanceof THREE.Light));
      if (!(o instanceof THREE.Mesh)) return;
      meshes++;
      const p=o.geometry.getAttribute("position"), n=o.geometry.getAttribute("normal");
      vertices+=p.count; triangles+=(o.geometry.index?.count ?? p.count)/3;
      assert.ok(n);
      for (const a of [p,n,o.geometry.getAttribute("color")].filter(Boolean)) for(const v of a.array) assert.ok(Number.isFinite(v));
      for(const material of Array.isArray(o.material)?o.material:[o.material]) {
        materials.add(material.name);
        if(material.name.includes("shared vertex palette")) {
          assert.ok(o.geometry.getAttribute("color"));
          assert.ok((material as THREE.MeshStandardMaterial).vertexColors);
          colored++;
        }
      }
      // Every export object is rooted at the building origin; no editing-lineup transform leaks.
      assert.ok(o.getWorldPosition(new THREE.Vector3()).length()<.001);
    });
    assert.ok(colored>0);
    assert.equal(triangles,m.triangles); assert.equal(vertices,m.vertices);
    assert.equal(meshes,m.primitives); assert.equal(materials.size,m.materialSlots);
    assert.ok(meshes<=2 && materials.size<=2 && triangles<4000 && raw.length<250000);
    assert.deepEqual(bounds.min.toArray().map(v=>+v.toFixed(3)), m.boundsYUp[0].map((v:number)=>+v.toFixed(3)));
    assert.deepEqual(bounds.max.toArray().map(v=>+v.toFixed(3)), m.boundsYUp[1].map((v:number)=>+v.toFixed(3)));
  }
});

test("exported door corridors and X-running gate passage remain clear; roofs face up", async () => {
  const originalDoors: Record<string,[number,number,number]> = {shop:[-.5,.5,2],townhome:[0,1,2],townhouse:[-.5,.5,2],cottage:[0,.5,1.5],porch:[0,.5,1],hut:[0,.5,1.5],homestead:[-.5,.5,2],gatehouse:[-.5,1,1.5]};
  for(const kind of ARCHITECTURE_KINDS) {
    const {scene}=await load(kind), door=manifest[kind].door;
    if(door) {
      assert.deepEqual([door.min,door.max,door.front],originalDoors[kind]);
      for(const t of [.06,.25,.5,.75,.94]) for(const y of [.56,1,1.5,1.88]) {
        const u=door.min+(door.max-door.min)*t;
        const pos=door.axis==="x"?new THREE.Vector3(door.front+.4,y,u):new THREE.Vector3(u,y,door.front+.8);
        const ray=new THREE.Raycaster(pos,door.axis==="x"?new THREE.Vector3(-1,0,0):new THREE.Vector3(0,0,-1),0,door.axis==="x"?3.4:1.45);
        assert.equal(ray.intersectObject(scene,true).length,0,`${kind} corridor u=${u} y=${y}`);
      }
    }
    if(manifest[kind].roofNormals.sourceSurfaces>0) {
      assert.equal(manifest[kind].roofNormals.upward,true);
      for(const z of [-.2,.25,.55]) {
        const hit=new THREE.Raycaster(new THREE.Vector3(.25,8,z),new THREE.Vector3(0,-1,0)).intersectObject(scene,true)[0];
        assert.ok(hit && hit.point.y>2 && hit.face && hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y>0,`${kind} upward roof at ${z}`);
      }
    }
  }
});

test("actual canonical specs retain original indoor contents, floors and keep story logic", () => {
  const source=text("src/components/game/building-meshes.tsx");
  const code=ts.transpile(source.slice(source.indexOf("function put("),source.indexOf("function occupant("))+"\nexport {SPECS};",{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
  const exports: {SPECS?:Record<string,{voxels:Array<{x:number;y:number;z:number;cut?:boolean}>}>}={};
  new Function("exports",code)(exports);
  for(const kind of ARCHITECTURE_KINDS) {
    const b=BUILD_SIZE[kind], vox=exports.SPECS![kind].voxels;
    for(const v of vox) {
      if(v.cut) assert.equal(retainArchitectureInteriorVoxel(kind,v),false);
      else if(v.y===0) assert.equal(retainArchitectureInteriorVoxel(kind,v),true);
      else if(!["rampart","rampartV","tower","gatehouse"].includes(kind) && v.x>b.x0 && v.x<b.x1 && v.z>b.z0 && v.z<b.z1) assert.equal(retainArchitectureInteriorVoxel(kind,v),true);
    }
  }
  assert.match(source,/architectureKitName\(b.kind, b.tx, b.ty\)/);
  assert.match(source,/retainArchitectureInteriorVoxel\(b.kind, v\)/);
  assert.match(source,/Boolean\(authored && !inside\)/);
  assert.equal((source.match(/pickOnly=\{exterior\}/g)??[]).length,2);
  assert.match(source,/colorWrite=\{!pickOnly\}/);
  assert.match(source,/depthWrite=\{!pickOnly && fade >= 1\}/);
  assert.match(source,/const cap = inside && b.kind === "keep" \? Math.round\(story\) \* KEEP_STORY_VOX \+ KEEP_STORY_VOX \+ 1 : Infinity/);
  assert.match(source,/if \(v.y > cap\) continue/);
  assert.match(source,/!inside &&\s*KINDS.map/);
  assert.doesNotMatch(source.slice(source.indexOf("function GhostAt(")),/architectureKitName|useArtistKit/);
  const loader=text("src/components/game/lanternwood-kit.ts");
  assert.match(loader,/if \(!active\) return/);
  assert.match(loader,/loaded\?\.name === name \? loaded.scene : null/);
  assert.match(loader,/o.raycast = noArtRaycast/);
  assert.doesNotMatch(text("src/components/game/architecture-kit.ts"),/Math.random|useGame|getWorld|lanternwoodInfluence|COURT/);
});


test("keep cutaway removes ceilings and stair-mouth occluders while retaining walking treads", () => {
  const source = text("src/components/game/building-meshes.tsx");
  const specsCode = ts.transpile(source.slice(source.indexOf("function put("), source.indexOf("function occupant(")) + "\nexport {SPECS};", { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  const exports: { SPECS?: Record<string, { voxels: Array<{ x: number; y: number; z: number; t: string; cut?: boolean }> }> } = {};
  new Function("exports", specsCode)(exports);
  const spec = exports.SPECS!.keep!;
  // Execute the actual renderer's layer loop, not a test-only copy of its filter.
  const loop = source.slice(source.indexOf("    const cap = inside"), source.indexOf("    return { solid, cut, interior, furnitureProxies };"));
  const run = new Function("spec", "inside", "story", "THREE", "kind", "keepStairCut", `
    const b={kind,tx:176,ty:320},y0=.8,B=.5,KEEP_STORY_VOX=4,furnishings=null;
    const names=["timber","dark","cobble","wool","gold","glass","thatch","stone","coal","soil","leaf"];
    const solid=Object.fromEntries(names.map(k=>[k,[]])),cut=Object.fromEntries(names.map(k=>[k,[]]));
    const interior=Object.fromEntries(names.map(k=>[k,[]]));
    const retainSettlementInteriorVoxel=()=>false,retainHospitalityInteriorVoxel=()=>false,retainCommonsInteriorVoxel=()=>false,retainArchitectureInteriorVoxel=()=>false;
    ${loop}
    return {solid,cut};
  `);
  const coords = (v: {x:number;y:number;z:number}) => [176+(v.x+.5)*.5,.8+(v.y+.5)*.5,320+(v.z+.5)*.5].join(",");
  for (const story of [0,.49,.5,1,1.49,1.5,2,2.49,2.5,3]) {
    const actual = run(spec,true,story,THREE,"keep",keepStairCut);
    const visible = Object.values(actual.solid).flat() as THREE.Vector3[];
    const expected = spec.voxels.filter(v=>!v.cut && v.y<=Math.round(story)*4+5 && !(v.t==="timber" && v.y>Math.round(story)*4) && !((v.x>=18 && v.z>=12 && v.y>Math.round(story)*4) || (v.t==="timber" && v.x>=15 && v.x<=18 && v.z>=11 && v.z<=14 && v.y>0)));
    assert.deepEqual(visible.map(v=>v.toArray().join(",")).sort(),expected.map(coords).sort(),`story ${story}: next floor must not cover the player`);
    if(Math.round(story)>0)assert.ok(actual.solid.timber.length>0,`story ${story} retains its own original floor`);
  }
  for (const story of [0,1,2,3]) {
    const actual = run(spec,false,story,THREE,"keep",keepStairCut);
    const visible = [...Object.values(actual.solid).flat(),...Object.values(actual.cut).flat()] as THREE.Vector3[];
    assert.deepEqual(visible.map(v=>v.toArray().join(",")).sort(),spec.voxels.map(coords).sort(),"outside restores the exact original multiset at every story");
  }
  for (const [kind,other] of Object.entries(exports.SPECS!)) {
    if(kind==="keep")continue;
    const actual=run(other,true,3,THREE);
    const visible=Object.values(actual.solid).flat() as THREE.Vector3[];
    assert.deepEqual(visible.map(v=>v.toArray().join(",")).sort(),other.voxels.filter(v=>!v.cut).map(coords).sort(),`${kind} retains its original solid voxels`);
  }
});


function buildingPointerHarness(options: { kind?: string; inside?: boolean; phase?: string; buildKind?: string | null } = {}) {
  const source = text("src/components/game/building-meshes.tsx");
  const file = ts.createSourceFile("building-meshes.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = file.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "OneBuilding");
  assert.ok(component);
  let handler: string | undefined;
  function visit(n: ts.Node) {
    if (ts.isJsxAttribute(n) && n.name.getText(file) === "onPointerDown" && n.initializer && ts.isJsxExpression(n.initializer)) handler = n.initializer.expression?.getText(file);
    ts.forEachChild(n, visit);
  }
  visit(component);
  assert.ok(handler);
  const code = ts.transpile(`exports.make = (env) => { const { b, inside, useGame, getWorld, leftAt, hitAt, stationOf } = env; return ${handler}; };`, {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
  const exports: { make?: (env: Record<string,unknown>) => (e: Record<string,unknown>) => void } = {};
  new Function("exports", code)(exports);
  const calls: Array<{method:string;args:unknown[]}> = [];
  const record = (method:string) => (...args:unknown[]) => calls.push({method,args});
  const state = { phase: options.phase ?? "playing", buildKind: options.buildKind ?? null, select:record("select"), openCtx:record("openCtx"), useStation:record("useStation") };
  const run = exports.make!({ b:{id:"sample",kind:options.kind??"keep",tx:176,ty:320}, inside:options.inside??true, useGame:{getState:()=>state}, getWorld:()=>({people:[{id:"banker",role:"banker",x:176,z:320}]}), leftAt:record("leftAt"), hitAt:record("hitAt"), stationOf:(kind:string)=>kind==="forge"?"forge":null });
  return { calls, fire:(button=0) => run({button,point:{x:181.2,y:7.11,z:320.3},clientX:109,clientY:333,stopPropagation:record("stop")}) };
}

for (const button of [0,2]) test(`inside keep pointer ${button} uses the visible surface once`, () => {
  const h=buildingPointerHarness();h.fire(button);
  assert.deepEqual(h.calls,button===0 ? [{method:"stop",args:[]},{method:"leftAt",args:[181,320]}] : [{method:"stop",args:[]},{method:"hitAt",args:[181,320,109,333]}]);
});

for (const options of [{inside:false},{phase:"looking"},{phase:"menu"},{kind:"shop"}]) test(`keep input does not intercept ${JSON.stringify(options)}`, () => {
  const h=buildingPointerHarness(options);h.fire();assert.deepEqual(h.calls,[]);
});

test("keep middle pointer remains available to camera controls", () => {
  const h=buildingPointerHarness();h.fire(1);assert.deepEqual(h.calls,[]);
});

test("keep build hold retains precedence over ordinary surface dispatch", () => {
  const h=buildingPointerHarness({buildKind:"porch"});h.fire(2);
  assert.deepEqual(h.calls,[{method:"stop",args:[]},{method:"leftAt",args:[181,320]}]);
});

test("other-building bank and crafting dispatch remain intact", () => {
  const bank=buildingPointerHarness({kind:"bank"});bank.fire();assert.deepEqual(bank.calls,[{method:"stop",args:[]},{method:"select",args:["banker"]}]);
  const forge=buildingPointerHarness({kind:"forge"});forge.fire();assert.deepEqual(forge.calls,[{method:"stop",args:[]},{method:"useStation",args:["sample"]}]);
});


test("keep stair presentation preserves treads and exposes the south mouth", () => {
  assert.equal(keepStairCut({x:19,y:7,z:13,t:"stone"},1),true);
  assert.equal(keepStairCut({x:19,y:4,z:13,t:"stone"},1),false);
  assert.equal(keepStairCut({x:17,y:4,z:11,t:"timber"},1),true);
  assert.equal(keepStairCut({x:16,y:1,z:9,t:"stone"},1),false);
  assert.equal(keepStairCut({x:-20,y:9,z:13,t:"stone"},1),false);
});

test("keep visual offset seats floors and treads without changing outside/NPC placement", () => {
  assert.equal(keepPlayerOffset(176,332),0);
  assert.equal(keepPlayerOffset(181,320),.51);
  for (const [z,top] of [[325, 1.01],[324,1.51],[323,2.01],[322,2.51],[319,4.51],[316,6.51]]) {
    const story=(325-z)/3;
    assert.ok(Math.abs(story*2+keepPlayerOffset(184,z)-top)<1e-8,`tread ${z}`);
  }
  const people=text("src/components/game/people-meshes.tsx");
  assert.ok(people.includes("p.isPlayer ? keepPlayerOffset(p.x, p.z) : 0"));
  assert.ok(people.includes("groundAt(you.x, you.z, you.story) + keepPlayerOffset(you.x, you.z)"));
});
